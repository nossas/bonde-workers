import QueryStream from "pg-query-stream";
import es from "event-stream";
import { queueContacts, actionTable, dbPool } from "./utils";
import { Pool, PoolClient } from "pg";
import log, { apmAgent } from "./dbg";
import { nextDay } from "date-fns";
const JSONStream = require('JSONStream');

export async function startResyncMailchimpHandle(id: number, is_community: boolean) {

    apmAgent?.setCustomContext({
        id,
        is_community
    });

    const queryWidget = (is_community ? `select w.id , 
    w.kind
    from widgets w 
        left join blocks b on w.block_id = b.id
        left join mobilizations m on b.mobilization_id = m.id
        left join communities c on m.community_id = c.id
    where 
    c.id = ${id} order by w.created_at asc
    order by w.created_at asc`
        : `select id, kind from widgets where id = ${id}`);

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

        const widgets = await client.query(queryWidget)
            .then((result) => {
                return result.rows
            }).catch(async(error) => {
                client.release();
                await pool.end();
                apmAgent?.captureError(error);
                throw new Error(`Error search widgets: ${error}`);
            });

        const widgetsLength = widgets.length;
        if (widgetsLength == 0) {
            client.release();
            await pool.end();
            const status = is_community ? `No widgets found for community id ${id}`
                : `Widget ${id} not found`;
            log.info(status);
            return status;
        }

        apmAgent?.setCustomContext({
            widgetsCount: widgetsLength 
        });

        let countWidgets = 0;

        widgets?.forEach(async (w) => {

            let table;
            table = actionTable(w.kind);
            if(!table) {
                const queryAction = `select 
                (select count(1) from activist_pressures ap where ap.widget_id = w.id) as pressure,
                (select count(1) from form_entries f where f.widget_id = w.id) as form,
                (select count(1) from donations d where d.widget_id = w.id) as donation
                from widgets w where w.id = ${w.id}`
                
                const countActions = await client.query(queryAction)
                .then((result) => {
                    return result.rows
                }).catch(async(error) => {
                    client.release();
                    await pool.end();
                    apmAgent?.captureError(error);
                    throw new Error(`Error search action kind: ${error}`);
                });
                if (countActions[0].pressure > 0) {
                    table = {name: 'activist_pressures', action_fields: 'form_data', kind: 'pressure'};
                } else if (countActions[0].donation >0 ) {
                    table =  { name: 'donations', action_fields: 'customer', kind: 'dontation' };
                } else if (countActions[0].form >0 ) {
                    table = { name: 'form_entries', action_fields: 'fields', kind: 'form'};
                } else {
                    const msg = `Not found action kind for widget ${w.id}`
                    log.info(msg);
                    return;
                } 
            }

            const prefix = is_community? `COMMUNITY${id}IDW${w.id}`: `WIDGET${id}`; 
            log.info(`Search contacts widget ${JSON.stringify(w)}`);
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
            where w.id = ${w.id} 
            and (t.mailchimp_status is null or t.mailchimp_status <> 'archived')
            and (select count(*) from ${table?.name} t2 where t2.activist_id = t.activist_id 
                 and t2.widget_id = t.widget_id  and t2.mailchimp_status = 'archived') = 0
            order by t.created_at asc`);

            let stream: QueryStream;
            try {
                stream = client.query(query);
            } catch (err) {
                apmAgent?.captureError(err);
                throw new Error(`${err}`)
            }
            stream.on('end', async () => {
                log.info(`Add activists of Widget ${w.id}`);
                countWidgets = countWidgets + 1;
                if (widgetsLength == countWidgets) {
                    stream.destroy();
                    done();
                    await pool.end();
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
                                action_fields: data.action_fields,
                                table: data.table
                            }
                            return await queueContacts.add({ contact }, {
                                removeOnComplete: false,
                                jobId: prefix + 'ID' + contact.id
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