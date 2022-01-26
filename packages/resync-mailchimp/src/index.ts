import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { startResyncMailchimpHandle } from "./start-resync-mailchimp";
import { statusResyncMailchimpHandle } from "./status-resync-mailchimp";
import log from "./dbg";
import { queueContacts } from "./utils";

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

app.post('/status-resync-mailchimp', async (req, res) => {
    if (!req.body.input || !req.body.input.id) {
        log.error(`Invalid request ${req.body}`);
        return res.status(404).json({ error: "Invalid request" });
    } 
    const { is_community, id } = req.body.input;
    const posfix = is_community? `community-${id}`: `widget-${id}`;
    
    try{
         
        const status = await statusResyncMailchimpHandle(posfix);
        return res.json(status);
       
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

app.listen(Number(PORT), "0.0.0.0", () => {
    log.info(`Server listen on port ${PORT}`);
  });