import Queue  from "bull"; 
import mailchimp from "./mailchimp";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const queueContacts = new Queue(`contacts-mailchimp`, REDIS_URL);

export function startResyncMailchimp(){
    //queueContacts.on("add", async (job) => {
    queueContacts.process(1, async (job) => {    
        console.log(job.data);
        //mailchimp(job.data);
        //return "status"
    });
}