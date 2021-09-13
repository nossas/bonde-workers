import { queueContacts, dbClient } from "./utils";
import mailchimp from "./mailchimp-subscribe";
import log, { apmAgent } from "./dbg";
let workers = 1;
export async function startResyncMailchimp() {
    const client = await dbClient();
    console.log("teste",
    await queueContacts.getJobCounts());
    queueContacts.process(1, async (job) => {
        try {
            await mailchimp(job.data.contact);
            const query = `update ${job.data.contact.action} set
                          synchronized = true, 
                          mailchimp_syncronization_at = NOW()
                          where id = ${job.data.contact.id}`;
            await client.query(query).then((result) => {
                log.info(`Contact updated id ${job.data.contact.id}`)
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