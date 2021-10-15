import { REDIS_URL, queueContacts } from "./utils"; 
import Queue from "bull";
import log, { apmAgent } from "./dbg";
export const queueClean = new Queue(`clean-resync-mailchimp`, REDIS_URL);

queueClean.add( { repeat: { cron: '17 3 * * *' } });

const worker = 1;
queueClean.process(1, async () => {

    queueContacts.clean(1000, 'completed');
    queueContacts.clean(1000, 'failed');
} );

queueClean.on('completed', async () => {

   log.info('Clean completed and failed jobs');
} );

queueClean.on('error', async (err) => {
    apmAgent.captureError(err);
    log.error(`Failed to clean ${err}`);

} );