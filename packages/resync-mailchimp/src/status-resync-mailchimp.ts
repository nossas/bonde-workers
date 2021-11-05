
import { queueContacts } from "./utils";
import { Job }  from "bull";
import  { format } from "date-fns";


export const statusResyncMailchimpHandle = async (prefix: string) => {
    const allCompleted = await queueContacts.getCompleted();
    const completed = allCompleted.filter(j => { return j.id.toString().indexOf(prefix) >= 0 }) 
    
    const allWaiting = await queueContacts.getWaiting();
    const waiting = allWaiting.filter(j => { return j.id.toString().indexOf(prefix) >= 0 }) 

    const allFailed = await queueContacts.getFailed();
    const failed = allFailed.filter(j => { return j.id.toString().indexOf(prefix) >= 0 }) 
 
    const allActive = await queueContacts.getActive();
    const active = allActive.filter(j => { return j.id.toString().indexOf(prefix) >= 0 }) 
    
    //last sync
    let date;
    if(completed.length > 0){
        const lastJob = completed.reduce(function (a:Job, b: Job) { 
            if(a.finishedOn && b.finishedOn){
                return a.finishedOn > b.finishedOn? a : b;
            }
            return b
        });
    
        if(lastJob.finishedOn){
         date = new Date(lastJob.finishedOn);
        }
    }
    
    let status = 'Parada';
    if (active.length == 0) {
        if (waiting.length > 0) {
           status = 'Em espera'
        } else{
            if ((completed.length >0 || failed.length > 0)){
                status = 'Finalizada';
            }
        }
    } else {
        status = 'Em andamento';
    }
   
    return {
            completed: completed.length,
            waiting: waiting.length,
            failed: failed.length,
            active: active.length,
            last_sync: date? format(date, 'dd/MM/yyyy HH:mm:ss'): "",
            status: status
        };
}