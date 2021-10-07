import QueryStream from "pg-query-stream";
import es from "event-stream";
import { dbClient, queueContacts, actionTable } from "./utils";
import { PoolClient } from "pg";
import log, { apmAgent } from "./dbg";
const JSONStream = require('JSONStream');

export async function addResyncMailchimpHandle(id: number, iscommunity: boolean) {
    
    apmAgent?.setCustomContext({
        id,
        iscommunity
    });
    let client: PoolClient; 
    try{
        client = await dbClient();
    } catch (error) {
        log.error(`${error}`);
        apmAgent?.captureError(error);
        throw new Error(`Database connection failed`);
    }
    const queryWidget = (iscommunity ? `select w.id , 
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
        : `select id, kind from widgets where id = ${id} and kind in ('form','donation','pressure-phone','pressure')`);

    const widgets = await client.query(queryWidget)
        .then((result) => {          
            return result.rows
        }).catch(error => {
            client.release();
            apmAgent?.captureError(error);
            throw new Error(`Error search widgets: ${error}`);        
        });

    const widgetsLength = widgets.length;     
    if (widgetsLength == 0){   
        client.release(); 
        const status = iscommunity? `No widgets found for community id ${id}` 
                               : `Widget ${id} not found`;
        log.info(status); 
        return status;   
    }
    
    apmAgent?.setCustomContext({
       widgets: widgets
    });
    let table;
    let countWidgets = 0;
    widgets?.forEach(async (w) => {

        table = actionTable(w.kind);
        
        log.info(`Search contacts widget ${ JSON.stringify(w)}`);
        const query = new QueryStream(`select
            trim(a.first_name) activist_first_name,
            trim(a.last_name) activist_last_name, 
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
            t.id,
            t.${table?.action_fields} action_fields
            from
            ${table?.name} t
            left join activists a on  a.id = t.activist_id
            left join widgets w on t.widget_id = w.id
            left join blocks b on w.block_id = b.id
            left join mobilizations m on b.mobilization_id = m.id
            left join communities c on m.community_id = c.id
            where w.id = ${w.id} 
            order by t.id asc`);
        
        let stream : QueryStream;
        try{
            stream = client.query(query);
        } catch(err){
            apmAgent?.captureError(err);
            throw new Error(`${err}`)   
        }              
        stream.on('end', async () => {
            log.info(`Add activists of Widget ${w.id}`);
            countWidgets = countWidgets + 1;
            if(widgetsLength == countWidgets){
                client.release();
            }
        });
        stream.on('error', (err: any) => {
            log.error(`${err}`);
            apmAgent?.captureError(err);
        });
                            
        stream.pipe(JSONStream.stringify())
        .pipe(JSONStream.parse("*"))
        .pipe(
            es.map((data: any, callback: any) => {
                let add = async (data: any) => {                
                    const contact = {
                            id: data.id,
                            first_name: data.activist_first_name,
                            last_name: data.activist_last_name,
                            email: data.activist_email,
                            state: data.activist_state,
                            phone: data.activist_phone,
                            city: data.activist_city,
                            widget_id: data.widget_id,
                            kind: data.widget_kind,
                            mobilization_id: data.mobilization_id,
                            mobilization_name: data.mobilization_name,
                            community_id: data.community_id,
                            community_name: data.community_name,
                            mailchimp_api_key: data.mailchimp_api_key,
                            mailchimp_list_id: data.mailchimp_list_id,
                            action_fields: data.action_fields
                        }
                        return await queueContacts.add({ contact }, {
                            removeOnComplete: true,
                        });    
                    }
                    add(data)
                    .then((data) => {
                        callback(null, JSON.stringify(data));
                    })
                    .catch((err) => {
                        log.error(`ERROR ADD QUEUE: ${err}`);
                        apmAgent?.captureError(err);
                    });
                }
            )
        );        
    });
    return "started to add contacts to the queue";
}