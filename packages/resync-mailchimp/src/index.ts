import express from "express";
import dotenv from "dotenv";
import { Pool } from "pg";
import QueryStream from "pg-query-stream";
import  es  from "event-stream";
import  Queue  from "bull"; 

//import * as url from "url";
const url = require('url');
const JSONStream = require('JSONStream');

dotenv.config();
const params = url.parse(process.env.DATABASE_URL || "");
const auth = params.auth.split(':');

const config = {
  user: auth[0],
  password: auth[1],
  host: params.hostname,
  port: params.port,
  database: params.pathname.split('/')[1]
};

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
console.log(`Porta: ${PORT}`);

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const queueContacts = new Queue("contacts", REDIS_URL);

app.post('/resync', async (req, res) => {

  // get request input
  const { iscommunity, id } = req.body.input;
 
  //ae
  const pool = new Pool(config);
  //ae
  const client = await pool.connect();
  //ae
  const queryWidget = (iscommunity?`select w.id , 
                                           w.kind from 
                                           communities c , mobilizations m , blocks b , widgets w 
                                           where 
                                           c.id = ${id}
                                           and b.id = w.block_id  
                                           and m.community_id  = c.id 
                                           and b.mobilization_id  = m.id
                                           and w.kind in ('form','donation','pressure-phone','pressure')` 
                                    :`select id, kind from widgets where id = ${id}`);

  //ae
  const widgets = await pool.query(queryWidget).then((result) =>{return result.rows});  
  
  widgets.forEach((w) => {                     
    let table;   
    switch(w.kind) { 
      case 'donation': { 
        table = 'donations'; 
        break; 
      } 
      case 'form': { 
        table = 'form_entries';
        break; 
      } 
      case 'pressure': {
        table = 'activist_pressures';
        break;
      }
      case 'pressure-phone': {
        table = 'activist_pressures';
        break;
      }        
      default: { 
        table = 'form_entries'
        break; 
      } 
    } 
    const query = new QueryStream(`select
        a.id activist_id,
        a.email activist_email, a.first_name
        , a.last_name,
        a.phone,a.city,a.state,      
        w.id widget_id, 
        w.kind widget_kind,
        b.id as block_id,
        m.id mobilization_id , 
        m."name" mobilization_name,
        c.id community_id, 
        c."name" community_name, 
        c.mailchimp_api_key , 
        c.mailchimp_list_id ,
        t.*
        from
        activists a,${table} t 
          left join widgets w on t.widget_id = w.id
          left join blocks b on w.block_id = b.id
          left join mobilizations m on b.mobilization_id = m.id
          left join communities c on m.community_id = c.id
        where a.id = t.activist_id  and w.id = ${w.id}
        -- and fe.mailchimp_syncronization_at is null 
        order by a.id asc 
    `);

    const stream =  client.query(query);
    stream.on('end',async () => {
      console.log("fim",await queueContacts.getJob(await queueContacts.count())); 
      //wmc
      return res.json({
        queue: await queueContacts.getJobCounts()
      });
    
    }); 
    stream.on('error', (err: any) => { console.log("Erro",err)});
                                  
    stream.pipe(JSONStream.stringify())
    .pipe(JSONStream.parse("*"))      
    .pipe(
      es.map((data:any, callback:any) => { 
        let add = async (data: any) => {
          const contact = { 
                            first_name: data.first_name, 
                            email: data.activist_email 
                          }
          return await  queueContacts.add( { contact }, {
            removeOnComplete: true,
          });
        }
        add(data)
        .then((data) => {
          callback(null, JSON.stringify(data));
        })
        .catch((err) => {
          console.log(`ERROR ADD QUEUE: ${err}`);
        });
    }));
  });
});

app.listen(PORT);

