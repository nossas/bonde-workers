import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { startResyncMailchimpHandle } from "./start-resync-mailchimp"
import log from "./dbg";
import { queueContacts } from "./utils";
import { Job }  from "bull";
import moment from "moment";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/start-resync-mailchimp', async (req, res) => {

    if (!req.body.input || !req.body.input.id) {
        log.error(`Invalid request ${req.body}`);
        return res.status(404).json({ error: "Invalid request" });
    }     
    const { is_community, id } = req.body.input;
    try{
        const status= await startResyncMailchimpHandle(id, is_community);
        return res.json({
           status: status
        });
    } catch(err){
        return res.status(500).json(`${err}`);
    }   
});

app.post('/empty-resync-mailchimp', async (req, res) => {
    try{
        await queueContacts.empty();
        const status = await queueContacts.getJobCounts();
        log.info(`Empty queue: ${JSON.stringify(status)}`);
        return res.json({
            status: `Empty queue: ${JSON.stringify(status)}`
         });
       
    } catch(err){
        return res.status(500).json(`${err}`);
    }   
});

app.post('/pause-resync-mailchimp', async (req, res) => {
    try{
        await queueContacts.pause(false,true);
        const status = await queueContacts.getJobCounts();
        log.info(`Pause queue: ${JSON.stringify(status)}`);
        return res.json({
            status: `Paused queue: ${JSON.stringify(status)}`
         });
       
    } catch(err){
        return res.status(500).json(`${err}`);
    }   
});

app.post('/resume-resync-mailchimp', async (req, res) => {
    try{
        await queueContacts.resume();
        const status = await queueContacts.getJobCounts();
        log.info(`Resume queue: ${JSON.stringify(status)}`);
        return res.json({
            status: `Resumed queue: ${JSON.stringify(status)}`
         });
       
    } catch(err){
        return res.status(500).json(`${err}`);
    }   
});

app.post('/status-resync-mailchimp', async (req, res) => {
    if (!req.body.input || !req.body.input.id) {
        log.error(`Invalid request ${req.body}`);
        return res.status(404).json({ error: "Invalid request" });
    } 
    const { is_community, id } = req.body.input;
    const prefix = is_community? `COMMUNITY${id}ID`: `WIDGET${id}ID`;
    
    try{
         
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

        return res.json({
                completed: completed.length,
                waiting: waiting.length,
                failed: failed.length,
                active: active.length,
                last_sync: date? moment(date).format('DD/MM/YYYY hh:mm:ss'): "",
                status: status
            });
       
    } catch(err){
        return res.status(500).json(`${err}`);
    }   
});

//WIP - dont use this endpoint
app.post('/remove-resync-mailchimp', async (req, res) => {
    if (!req.body.input || !req.body.input.id) {
        log.error(`Invalid request ${req.body}`);
        return res.status(404).json({ error: "Invalid request" });
    }     
    const { is_community, id } = req.body.input;
    try{
        const prefix = is_community? `COMMUNITY${id}ID`: `WIDGET${id}ID`;
        const getKeys = async (q:any) => {
            const multi = q.multi();
            multi.keys('*');
            const keys = await multi.exec();
            return keys[0][1]
        }
          
        const filterQueueKeys = (q:any, keys:any) => {
            const prefix = `${q.keyPrefix}:${q.name}`;
            return keys.filter((k:any) => k.includes(prefix));
        }
          
        const deleteKeys = async (q:any, keys:any) => {
            const multi = q.multi();
            keys.forEach(async (k:any) => {
              
              if (k.indexOf(prefix) >= 0) { 
                await multi.del(k)}
            });
            await multi.exec();
        }   
        const keys = await getKeys(queueContacts);
        const queueKeys = filterQueueKeys(queueContacts, keys);
        await deleteKeys(queueContacts, queueKeys);

        const status = await queueContacts.getJobCounts();
         return res.json({
            status: `Remove jobs queue: ${JSON.stringify(status)}`
         });
        
    } catch(err){
        return res.status(500).json(`${err}`);
    }   
});

app.listen(Number(PORT), "0.0.0.0", () => {
    log.info(`Server listen on port ${PORT}`);
  });