import dotenv from 'dotenv';
import  { Pool } from "pg";

dotenv.config();
const url = require('url')

const params = url.parse(process.env.DATABASE_URL || "");
const auth = params.auth.split(':');

const config = {
  user: auth[0],
  password: auth[1],
  host: params.hostname,
  port: params.port,
  database: params.pathname.split('/')[1]
};

export async function queryContacts(widget_id: string) {
  const pool = new Pool(config);
  //ae
  const client = await pool.connect();
  //ae
  const kind = await pool.query('SELECT kind from widgets where id = '+ widget_id)
                         .then((result) =>{
                           return result.rows[0].kind
                          });
  let table;   
  switch(kind) { 
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

  const QueryStream = require('pg-query-stream');
  const JSONStream = require('JSONStream');
  const es = require("event-stream");
  const query = await pool.query(
        `select
        a.id activist_id, a.email, a.first_name, a.last_name,
        a.phone,a.city,a.state,
        fe.* as fe,
        w.id widget_id, w.kind widget_kind,
        b.id as block_id,
        m.id mobilization_id , m."name" mobilization_name,
        c.id community_id, c."name" community_name, c.mailchimp_api_key , c.mailchimp_list_id 
        from
         activists a, ${table} fe 
         left join widgets w on fe.widget_id = w.id
            left join blocks b on w.block_id = b.id
            left join mobilizations m on b.mobilization_id = m.id
            left join communities c on m.community_id = c.id
        where a.id = fe.activist_id  and w.id = ${widget_id}
        -- and fe.mailchimp_syncronization_at is null 
        order by fe.created_at asc 
        `);
  return query.rows
 
}

export async function streamContacts(widget_id: string) {
  const pool = new Pool(config);
  //ae
  const client = await pool.connect();
  //ae
  const kind = await pool.query('SELECT kind from widgets where id = '+ widget_id)
                         .then((result) =>{
                           return result.rows[0].kind
                          });
  let table;   
  switch(kind) { 
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

  const QueryStream = require('pg-query-stream');
  const JSONStream = require('JSONStream');
 
  const query = new QueryStream(
        `select
        a.id activist_id, a.email, a.first_name, a.last_name,
        a.phone,a.city,a.state,
        fe.* as fe,
        w.id widget_id, w.kind widget_kind,
        b.id as block_id,
        m.id mobilization_id , m."name" mobilization_name,
        c.id community_id, c."name" community_name, c.mailchimp_api_key , c.mailchimp_list_id 
        from
         activists a, ${table} fe 
         left join widgets w on fe.widget_id = w.id
            left join blocks b on w.block_id = b.id
            left join mobilizations m on b.mobilization_id = m.id
            left join communities c on m.community_id = c.id
        where a.id = fe.activist_id  and w.id = ${widget_id}
        -- and fe.mailchimp_syncronization_at is null 
        order by fe.created_at asc 
        `);
  const stream = await client.query(query);
  stream.on('end',() => {console.log("fim")}); 
  stream.on('error', (err: any) => { console.log("AQUI",err)});
  stream.on('data',function(data: Uint8Array){
    let string = "";
    string += data.toString();
    console.log('stream data ' + { data });
  });
  stream.pipe(process.stdout);
}

