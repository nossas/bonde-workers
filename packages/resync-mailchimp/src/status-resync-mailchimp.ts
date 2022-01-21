
import { queueContacts } from "./utils";
import { Job }  from "bull";
import  { format } from "date-fns";

export const statusResyncMailchimpHandle = async (prefix: string) => {
    const allJobs = await queueContacts.getJobs(['waiting', 'active', 'completed', 'failed']);
    const jobs :Job[] =  allJobs.filter(j => { return j.id.toString().indexOf(prefix) >= 0 }); 
    let counters = { completed : 0, waiting: 0, failed: 0, active: 0 } ;     
    let last = 0;
    for (var i = 0; i < jobs.length; i++) {
        if(await jobs[i].isCompleted()){
            counters.completed++;
            const finishedOn = jobs[i].finishedOn; 
            if (finishedOn && last < finishedOn){
                last = finishedOn;
            }
        }else if(await jobs[i].isWaiting()){
            counters.waiting++;
        }else if (await jobs[i].isFailed()){
            counters.failed++;
        } else if (await jobs[i].isActive()){
            counters.active++;
        }
    }
   
    let status = 'Parada';
    if (counters.active == 0) {
        if (counters.waiting > 0) {
           status = 'Em espera'
        } else{
            if ((counters.completed >0 || counters.failed > 0)){
                status = 'Finalizada';
            }
        }
    } else {
        status = 'Em andamento';
    }
   
    return {
            ...counters,
            last_sync: last>0? format( new Date(last), 'dd/MM/yyyy HH:mm:ss'): "",
            status: status
        };
}