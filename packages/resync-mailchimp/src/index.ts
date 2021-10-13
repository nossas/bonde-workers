import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { addResyncMailchimpHandle } from "./add-resync-mailchimp"
import log from "./dbg";
import { queueContacts } from "./utils";
import { Queue } from "bull";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/add-resync-mailchimp', async (req, res) => {

    if (!req.body.input || !req.body.input.id) {
        log.error(`Invalid request ${req.body}`);
        return res.status(404).json({ error: "Invalid request" });
    }     
    const { iscommunity, id } = req.body.input;
    try{
        const status= await addResyncMailchimpHandle(id, iscommunity);
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
        return res.json({
            status: `Resumed queue: ${JSON.stringify(status)}`
         });
       
    } catch(err){
        return res.status(500).json(`${err}`);
    }   
});

app.post('/remove-resync-mailchimp', async (req, res) => {
    if (!req.body.input || !req.body.input.id) {
        log.error(`Invalid request ${req.body}`);
        return res.status(404).json({ error: "Invalid request" });
    }     
    const { iscommunity, id } = req.body.input;
    try{
        const prefix = iscommunity? `COMMUNITY${id}`: `WIDGET${id}`;
              
        const getKeys = async (q: Queue) => {
            const multi = q.multi();
            multi.keys('*');
            const keys = await multi.exec();
            console.log(keys);
            return keys[0][1]
          }
          
          const filterQueueKeys = (q: any , keys: any, name:string) => {
            const prefix = `${q.keyPrefix}:${q.name}`;
            return keys.filter((k:any) => (k.includes(prefix)));
          }
          
          const emptyQueue = async (q: Queue, name: string) => {  
            const keys = await getKeys(q);
            const queueKeys = await filterQueueKeys(q, keys, name);
            const multi = q.multi();
            keys.forEach((k: any) => {
              if(k.indexOf(name) > 0){
                console.log(k)  
                multi.del(k);
              }
            }); 
          }
          
        await emptyQueue(queueContacts,prefix)
        const status = await queueContacts.getJobCounts();
        return res.json({
            status: `Remove jobs ${prefix} queue: ${JSON.stringify(status)}`
         });
        
    } catch(err){
        return res.status(500).json(`${err}`);
    }   
});

app.listen(Number(PORT), "0.0.0.0", () => {
    log.info(`Server listen on port ${PORT}`);
  });