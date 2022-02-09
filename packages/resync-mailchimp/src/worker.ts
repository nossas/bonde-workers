import log, { apmAgent } from "./dbg";
import mailchimp from "./mailchimp-subscribe";
import { queueContacts, dbPool } from "./utils";
import dotenv from "dotenv";
import { clientES, nameIndex } from "./client-elasticsearch";

dotenv.config();

export async function startResyncMailchimp() {

    await queueContacts.process(1, async (job) => {
        let query; 
        let status;
        try {          
            const response = await mailchimp(job.data.contact);
            query = `update ${job.data.contact.table} set mailchimp_status= '${response.mailchimp_status}', 
                    mailchimp_syncronization_at = '${response.updated_at}'
                    where id = ${job.data.contact.id}`;   
            status = 'completed';
            log.info(`Resync contact: ${job.data.contact.email} status: ${response.mailchimp_status}`);      
        }catch(err) {
            log.error(`Failed resync ${err}`);
            apmAgent?.captureError(err);
            const msg = `${err}`
            query = `update ${job.data.contact.table} set 
                    mailchimp_syncronization_error_reason = '${msg.replace(/'/g, '"')}'
                    where id = ${job.data.contact.id}`;
            await job.moveToFailed(new Error(`${err}`));
            status = 'failed';              
        }    
        try{

            //update contact on elasticsearch
            const upContact = {
              ...job.data.contact, 
              status: status,
              action_fields: JSON.stringify(job.data.action_fields),
              finished_at: new Date()
            };

            const posfix = job.id.toString().indexOf('COMMUNITY') !== -1?`community-${upContact.community_id}`
              :`widget-${upContact.widget_id}`; 
            clientES.index({
              index: `${nameIndex}-${posfix}`,
              method: "PUT",
              id: job.id.toString(),
              body: upContact
            });

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