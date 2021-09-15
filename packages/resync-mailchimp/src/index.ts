import express from "express";
import dotenv from "dotenv";
import { addResyncMailchimpHandle } from "./add-resync-mailchimp"
import log, { apmAgent } from "./dbg";
import Mailchimp from 'mailchimp-api-v3';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/add-resync-mailchimp', async (req, res) => {

    if (!req.body.input || !req.body.input.id) {
        log.error(`Invalid request id`);
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

app.listen(Number(PORT), "0.0.0.0", () => {
    log.info(`Server listen on port ${PORT}`);
  });