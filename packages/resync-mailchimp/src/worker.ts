import { queueContacts, actionTable, dbPool } from "./utils";
import mailchimp from "./mailchimp-subscribe";
import log, { apmAgent } from "./dbg";
import dotenv from "dotenv";

dotenv.config();

export async function startResyncMailchimp() {

    await queueContacts.process(1, async (job) => {
        let query; 
        try {          
            const response = await mailchimp(job.data.contact);
            query = `update ${job.data.contact.table} set mailchimp_status= '${response.mailchimp_status}', 
                    mailchimp_syncronization_at = '${response.updated_at}'
                    where id = ${job.data.contact.id}`;   
            log.info(`Resync contact: ${job.data.contact.email} status: ${response.mailchimp_status}`);      
        }catch(err) {
            log.error(`Failed resync ${err}`);
            apmAgent?.captureError(err);
            const msg = `${err}`
            query = `update ${job.data.contact.table} set 
                    mailchimp_syncronization_error_reason = '${msg.replace(/'/g, '"')}'
                    where id = ${job.data.contact.id}`;
            await job.moveToFailed(new Error(`${err}`));              
        }    
        try{
            const pool = await dbPool();
            const client = await pool.connect();
            await client.query(query).then((result) => {
                log.info(`updated ${job.data.contact.table} id ${job.data.contact.id}`)
            });
            client.release();
            await pool.end();

        }catch(err) {
            log.error(`Failed update ${err}`);
            apmAgent?.captureError(err);
        }
 
    });
}

startResyncMailchimp();