import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { addResyncMailchimpHandle } from "./add-resync-mailchimp"
import log from "./dbg";
import { queueContacts } from "./utils";

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

app.post('/stop-resync-mailchimp', async (req, res) => {
    try{
        const status = await queueContacts.getJobCounts();
        await queueContacts.empty();
        return res.json({
            status: `Stoped queue: ${JSON.stringify(status)}`
         });
       
    } catch(err){
        return res.status(500).json(`${err}`);
    }   
});

app.listen(Number(PORT), "0.0.0.0", () => {
    log.info(`Server listen on port ${PORT}`);
  });