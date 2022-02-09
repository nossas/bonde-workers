import { Client } from '@elastic/elasticsearch';
import dotenv from "dotenv";
dotenv.config();

export const clientES =
    new Client({ 
    cloud: {
      id: process.env.ELASTICSEARCH_CLOUD_ID || 'name:bG9jYWxob3N0JGFiY2QkZWZnaA=='
    },
    auth: {
      username: "elastic",
      password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
    },
    context: process.env.NODE_ENV || 'development'
  });

  export const nameIndex = process.env.NODE_ENV === 'development'? `resync-mailchimp-dev`:`resync-mailchimp`;