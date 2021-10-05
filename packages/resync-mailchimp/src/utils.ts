import { Pool } from "pg";
import Queue from "bull";
import {ActionFields} from "./types";
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
    let client = await pool.connect();
    return client;
}

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
export const queueContacts = new Queue(`resync-contacts-mailchimp`, REDIS_URL);


export const actionTable = ( kind: string) =>{
    switch (kind) {
        case 'donation': {
            return { name: 'donations', action_fields: 'customer'};
        }
        case 'form': {
            return {name:'form_entries', action_fields:'fields'};
        }
        case 'pressure': {
            return {name:'activist_pressures', action_fields:'form_data'};
        }
        case 'pressure-phone': {
            return {name: 'activist_pressures',action_fields: 'form_data'};
        }
        default: return undefined
    }
}

export const findMergeFields = (kind: string, action_fields: any) => {

    console.log(kind)
    let merge_fields : ActionFields = {
        first_name: "",
        last_name: "",
        email: ""
    };

    let preparedFields: string[] = []; 
    switch (kind) {
        case 'form': {    
            JSON.parse(action_fields).forEach((field: any) => {
                preparedFields[
                    field.label
                    .toLowerCase()
                    .replace(/ /g, "_")
                    .replace(/[^\w-]+/g, "")
                ] = field.value !== undefined ? field.value : " ";
            });
            const re =
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    

            for (const [key, value] of Object.entries(preparedFields)) {
                if (re.test(String(value).toLowerCase())) {
                    merge_fields.email = value;
                } else if (key.indexOf("nome") >= 0) {
                    (key.indexOf("sobrenome") < 0)? merge_fields.first_name = value: merge_fields.last_name = value;  
                }
            }
        } 

        case 'donation' :{
            let preparedCustomer = JSON.parse('{'+ action_fields.replace(/=>/g, ":")
            .replace(/\\/g,"")
            .replace(/"{/g, "{")
            .replace(/}"/g, "}")+ '}');
            
            merge_fields.first_name = preparedCustomer.name;
            merge_fields.last_name = " ";
            merge_fields.email = preparedCustomer.email; 
        }

        case ('pressure' || 'pressure-phone') :{

            let preparedFormData = JSON.parse(JSON.stringify(action_fields)); 
            merge_fields.first_name = preparedFormData.name;
            merge_fields.last_name = preparedFormData.last_name;
            merge_fields.email = preparedFormData.email; 
        }
    }
    return merge_fields;
}

