import QueryStream from "pg-query-stream";
import es, { concat } from "event-stream";
import { queueContacts, actionTable, dbPool } from "./utils";
import { Pool, PoolClient } from "pg";
import log, { apmAgent } from "./dbg";
import { Table,Contact } from "./types";
import { clientES } from "./client-elasticsearch";
const JSONStream = require('JSONStream');

/**
 * Atual Organização da criação da fila 
 * 
 * - No caso da widget, fazemos a "Busca de ações da widget"
 * - No caso da comunidade, fazemos a "Busca de widget por ação"
 * - Enfileiramento dos atvistas das ações por lista de widgets
 * 
 * Nova Organização da criação da fila
 * 
 * - Enfileiramento por ações donations, form_entries e activist_pressures
 * - Filtrar por community_id/widget_id se deve ser enfileirada ou não
 * - 
 * 
 */

export async function startResyncMailchimpHandle(id: number, is_community: boolean) {

    apmAgent?.setCustomContext({
        id,
        is_community
    });
    
    let tables :Table[] = []; 
        
    //search all action tables
    tables.push({ name: 'donations', action_fields: 'customer', kind: 'donation' });
    tables.push({ name: 'activist_pressures', action_fields: 'form_data', kind: 'pressure'});
    tables.push({ name: 'form_entries', action_fields: 'fields', kind: 'form' });
    let pool: Pool;

    try {
        pool = await dbPool();
    } catch (error) {
        log.error(`${error}`);
        apmAgent?.captureError(error);
        throw new Error(`${error}`);
    }

    pool.connect(async (error: Error, client: PoolClient, done) => {
       
            if (error){
                apmAgent?.captureError(error);
                throw new Error(`${error}`);
            }          
        let countTables = 0;  
        log.info(`Search activists-> ID: ${id}, IS_COMMUNITY: ${is_community}`);

        tables.forEach(async (table)=> {
            let condition:string, prefix:string, index:string;
            if(is_community){
                condition  =  `c.id = ${id}`;
                prefix = `COMMUNITY${id}WIDGET`; 
                index =`contact-mailchimp-community-${id}`;
    
            }else{
                condition =  `w.id = ${id}`;
                prefix = `WIDGET`; 
                index = `contact-mailchimp-widget-${id}`; 
            }
           
            const query = new QueryStream(`select 
                    trim(a.first_name) activist_first_name,
                    trim(a.last_name) activist_last_name, 
                    a.city activist_city, 
                    a.state activist_state, 
                    a.phone activist_phone,       
                    a.email activist_email,
                    w.id widget_id, 
                    '${table.kind}' as widget_kind,
                    b.id as block_id,
                    m.id mobilization_id , 
                    m."name" mobilization_name,
                    c.id community_id, 
                    c."name" community_name, 
                    c.mailchimp_api_key , 
                    c.mailchimp_list_id,
                    t.id,
                    t.created_at,
                    t.${table.action_fields} action_fields,
                    '${table.name}' as table
                    from
                    ${table.name} t
                    left join activists a on  a.id = t.activist_id
                    left join widgets w on t.widget_id = w.id
                    left join blocks b on w.block_id = b.id
                    left join mobilizations m on b.mobilization_id = m.id
                    left join communities c on m.community_id = c.id
                    where ${condition}
                    and (t.mailchimp_status is null or t.mailchimp_status <> 'archived')
                    order by t.created_at asc`);
                let stream: QueryStream;
                try {
                    stream = client.query(query);
                } catch (err) {
                    apmAgent?.captureError(err);
                    throw new Error(`${err}`)
                }
        
                stream.on('end', async () => {
                    log.info(`Add activists of ${table.name}`);
                    stream.destroy();
                    countTables++;
                    if(countTables == tables.length){
                        log.info('Finished connection');
                        done();
                        pool.end();
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
                                    const contact : Contact = {
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
                                        action_fields: data.action_fields,
                                        table: data.table,
                                        status: 'waiting',
                                        added_at: new Date()
                                    }
                                   
                                     await clientES.index({
                                        index,
                                        method: "POST",
                                        id: prefix + contact.widget_id + 'ID' + contact.id,
                                        body: contact
                                    });
                                    
                                    return await queueContacts.add({ contact }, {
                                        removeOnComplete: true,
                                        jobId: prefix + contact.widget_id + 'ID' + contact.id
                                    });
                                }
                                add(data).then((data) => {
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
    });
    return "started to add contacts to the queue";
}