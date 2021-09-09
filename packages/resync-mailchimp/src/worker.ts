import {queueContacts, dbClient}  from "./utils"; 
import mailchimp from "./mailchimp-subscribe";

let workers =  1;

export async function startResyncMailchimp(){
    const client = await dbClient();
    queueContacts.process(1, async (job) => {    
        try 
        {
          //await mailchimp(job.data.contact);
          const query = `update ${job.data.contact.action} set 
                          mailchimp_syncronization_at = NOW()
                          where id = ${job.data.contact.id}`; 
          await client.query(query).then((result) => {
            console.log(job.data.contact.id)
          }).catch((err)=>{
            console.log(err);
          })
        } 
        catch(err) {
          console.log(err);
        }
            //atualizar mailchimp_syncronization_at mailchimp_syncronization_error_reason?
    });
}
