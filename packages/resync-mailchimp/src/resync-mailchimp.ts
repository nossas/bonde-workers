import QueryStream from "pg-query-stream";
import es  from "event-stream";
import Queue  from "bull"; 
import { Pool,PoolClient } from "pg";
import {startResyncMailchimp} from "./worker"
const JSONStream = require('JSONStream');
const url = require('url');

const dbClient = async () => {
       
    const params = url.parse(process.env.DATABASE_URL || "");
    const auth = params.auth.split(':');

    const config = {
        user: auth[0],
        password: auth[1],
        host: params.hostname,
        port: params.port,
        database: params.pathname.split('/')[1]
      };
    
    const pool = new Pool(config);
    return await pool.connect();     
}
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const queueContacts = new Queue(`contacts-mailchimp`, REDIS_URL);

export async function resyncMailchimpHandle (id: number, iscommunity: boolean) {
    
    let client: PoolClient;
    client = await dbClient(); 

    const queryWidget = (iscommunity?`select w.id , 
    w.kind
    from widgets w 
        left join blocks b on w.block_id = b.id
        left join mobilizations m on b.mobilization_id = m.id
        left join communities c on m.community_id = c.id
    where 
    c.id = ${id}
    and b.id = w.block_id  
    and m.community_id  = c.id 
    and b.mobilization_id  = m.id
    and w.kind in ('form','donation','pressure-phone','pressure')` 
    :`select id, kind from widgets where id = ${id}`);

    const widgets = await client.query(queryWidget)
                                .then((result) =>{
                                    return result.rows
                                 });
    //nf 
    let table: string;                           
    widgets.forEach((w) => {

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
            table = 'form_entries';
            break; 
        } 
        } 
        //nf
        const query = new QueryStream(`select
            a.first_name activist_first_name,
            a.last_name activist_last_name, 
            a.city activist_city, 
            a.state activist_state, 
            a.phone activist_phone,       
            a.email activist_email,
            w.id widget_id, 
            w.kind widget_kind,
            b.id as block_id,
            m.id mobilization_id , 
            m."name" mobilization_name,
            c.id community_id, 
            c."name" community_name, 
            c.mailchimp_api_key , 
            c.mailchimp_list_id,
            t.id
            from
            ${table} t 
            left join activists a on  a.id = t.activist_id
            left join widgets w on t.widget_id = w.id
            left join blocks b on w.block_id = b.id
            left join mobilizations m on b.mobilization_id = m.id
            left join communities c on m.community_id = c.id
            where w.id = ${w.id}
            order by t.id asc
        `);

        const stream =  client.query(query);

        stream.on('end',async () => {
            const total = await queueContacts.count();
           // console.log(total);
            console.log(`Queue Widget ${w.id}:`,await queueContacts.getJobCounts());
           

        }); 
        stream.on('error',(err: any) => { 
            console.log(err);
        });
        
        //                              
        stream.pipe(JSONStream.stringify())
        .pipe(JSONStream.parse("*"))      
        .pipe(
            es.map((data:any, callback:any) => { 
                let add = async (data: any) => {
                const contact = {
                            id: data.id,
                            first_name: data.activist_first_name,
                            last_name: data.activist_last_name,
                            email: data.activist_email,
                            state: data.activist_state,
                            city: data.activist_city,
                            widget_id: data.widget_id,
                            kind: data.widget_kind,
                            action: table,
                            mobilization_id: data.mobilization_id,
                            mobilization_name: data.mobilization_name,
                            community_id: data.community_id,
                            community_name: data.community_name,
                            mailchimp_api_key: data.mailchimp_api_key,
                            mailchimp_list_id: data.mailchimp_list_id
                        }        
                return await queueContacts.add( { contact }, {
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
            })
        );
    });
    return queueContacts.toKey("id");
}