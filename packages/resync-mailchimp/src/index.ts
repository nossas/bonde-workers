import express from "express";
import dotenv from "dotenv";
import { resyncMailchimpHandle } from "./resync-mailchimp"

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
console.log(`Porta: ${PORT}`);

app.post('/resync-mailchimp', async (req, res) => {

  // get request input
  const { iscommunity, id } = req.body.input;
  if(!id) {
    
    return res.status(404).json({ error: "Invalid request" });
  }
  
  const queue = await resyncMailchimpHandle(id,iscommunity);
  return res.json({
    queue: queue
  });
});

app.listen(PORT);

