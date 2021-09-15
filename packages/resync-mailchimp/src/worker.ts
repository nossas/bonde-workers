import { queueContacts, dbClient } from "./utils";
import mailchimp from "./mailchimp-subscribe";
import log, { apmAgent } from "./dbg";
import { PoolClient } from "pg";
import dotenv from "dotenv";

dotenv.config();
let workers = 1;
export async function startResyncMailchimp() {
    
    let client: PoolClient;
    try{
        client = await dbClient();
    } catch (error) {
        apmAgent?.captureError(error);
        throw new Error(`Database connection failed`);
    }

    await queueContacts.process(1, async (job) => {
        const table = job.data.contact.action;
        let query; 
        try {
            const date = await mailchimp(job.data.contact);
            query = `update ${table} set 
                    mailchimp_syncronization_at = '${date.updated_at}'
                    where id = ${job.data.contact.id}`;
        }catch(err) {
            log.error(`Failed resync ${err}`);
            apmAgent?.captureError(err);
            query = `update ${table} set 
                    mailchimp_syncronization_error_reason = '${err}'
                    where id = ${job.data.contact.id}`;
        }    
                
        await client.query(query).then((result) => {
            log.info(`updated ${table} id ${job.data.contact.id}`)
        }).catch((err) => {
            log.error(`${err}`);
            apmAgent?.captureError(err);
        });
    });
}

startResyncMailchimp();