import { queueContacts, dbClient, actionTable } from "./utils";
import mailchimp from "./mailchimp-subscribe";
import log, { apmAgent } from "./dbg";
import { PoolClient } from "pg";
import dotenv from "dotenv";

dotenv.config();
let workers = 1;
export async function startResyncMailchimp() {
    
    await queueContacts.process(1, async (job) => {
        const table =  actionTable(job.data.contact.kind);
        let query; 
        try {
            const date = await mailchimp(job.data.contact);
            query = `update ${table} set 
                    mailchimp_syncronization_at = '${date.updated_at}'
                    where id = ${job.data.contact.id}`;
        }catch(err) {
            log.error(`Failed resync ${err}`);
            apmAgent?.captureError(err);
            const msg = `${err}`
            query = `update ${table} set 
                    mailchimp_syncronization_error_reason = '${msg.replace(/'/g, '"')}'
                    where id = ${job.data.contact.id}`;
            console.log(query);
        }    
    
        let client: PoolClient;
        try{
            client = await dbClient();
        } catch (error) {
            apmAgent?.captureError(error);
            throw new Error(`Database connection failed`);
        }
                
        await client.query(query).then((result) => {
            log.info(`updated ${table} id ${job.data.contact.id}`)
        }).catch((err) => {
            log.error(`Failed update ${err}`);
            apmAgent?.captureError(err);
        });
        client.release();
    });
}

startResyncMailchimp();