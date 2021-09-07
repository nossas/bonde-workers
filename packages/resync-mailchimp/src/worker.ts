import {contactQueue, dbClient}  from "./utils"; 
import mailchimp from "./mailchimp-subscribe";

const queueContacts = contactQueue();
let workers =  1;

export function startResyncMailchimp(){
    queueContacts.process(1, async (job) => {    
        await mailchimp(job.data.contact); 
        //atualizar mailchimp_syncronization_at mailchimp_syncronization_error_reason?
    });
}
