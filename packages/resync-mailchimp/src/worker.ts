import Queue  from "bull"; 
import mailchimp from "./mailchimp-subscribe";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const queueContacts = new Queue(`contacts-mailchimp`, REDIS_URL);
let workers =  1;

export function startResyncMailchimp(){
    queueContacts.process(1, async (job) => {    
       return await mailchimp(job.data.contact); 
    });

    //atualizar mailchimp_syncronization_at mailchimp_syncronization_error_reason?
}
