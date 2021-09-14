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
    queueContacts.process(1, async (job) => {
        try {
            await mailchimp(job.data.contact);
            const query = `update ${job.data.contact.action} set
                          synchronized = true, 
                          mailchimp_syncronization_at = NOW()
                          where id = ${job.data.contact.id}`;
            await client.query(query).then((result) => {
                log.info(`Activist updated id ${job.data.contact.id}`)
            }).catch((err) => {
                log.error(`${err}`);
                apmAgent?.captureError(err);
            })
        }
        catch (err) {
            log.error(`${err}`);
            apmAgent?.captureError(err);
        }
    });
}

startResyncMailchimp();