import { Client } from '@elastic/elasticsearch';
import dotenv from "dotenv";
dotenv.config();
export const clientES =
    new Client({
    cloud: {
      id: process.env.ELASTICSEARCH_CLOUD_ID || 'http://localhost:9200'
    },
    auth: {
      username: "elastic",
      password: process.env.ELASTICSEARCH_PASSWORD || ''
    }
  });