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
    }
  });

  export const nameIndex = process.env.NODE_ENV === 'production'? `resync-mailchimp`:`resync-mailchimp-dev`;