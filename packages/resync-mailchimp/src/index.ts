import express from "express";
import dotenv from "dotenv";
import { resyncMailchimpHandle } from "./resync-mailchimp"
import log, { apmAgent } from "./dbg";
import { Logger } from "pino";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/resync-mailchimp', async (req, res) => {

    // get request input
    const { iscommunity, id } = req.body.input;
    if (!id) {
        log.error(`Invalid request id = ${id}`);
        return res.status(404).json({ error: "Invalid request" });
    } 
    let queue   
    try{
        queue = await resyncMailchimpHandle(id, iscommunity);

        return res.json({
            queue: queue
        });
    } catch(err){
        return res.status(500).json(`${err}`);
    }
    
});

app.listen(Number(PORT), "0.0.0.0", () => {
    log.info(`Server listen on port ${PORT}`);
  });