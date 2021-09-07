import { Pool } from "pg";
import Queue from "bull";
const url = require('url');

export const dbClient = async () => {
       
    const params = url.parse(process.env.DATABASE_URL || "");
    const auth = params.auth.split(':');

    const config = {
        user: auth[0],
        password: auth[1],
        host: params.hostname,
        port: params.port,
        database: params.pathname.split('/')[1]
      };
    const pool = new Pool(config);
    return await pool.connect();   
}

export function contactQueue ()  {
  const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  return  new Queue(`contacts-mailchimp`, REDIS_URL);
}