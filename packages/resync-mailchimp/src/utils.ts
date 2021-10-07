import { Pool } from "pg";
import Queue from "bull";
import { MergeFields } from "./types";
const url = require('url');

export const dbClient = async () => {
    const params = url.parse(process.env.DATABASE_URL || "");
    const auth = params.auth.split(':');

    const config = {
        user: auth[0],
        password: auth[1],
        host: params.hostname,
        port: params.port,
        database: params.pathname.split('/')[1],
        idleTimeoutMillis: 0,
         connectionTimeoutMillis: 0
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
    if(!action_fields) {
        throw new Error('Fields are empty!');  
    }
    
    let mergeFields: MergeFields = {
        first_name: "",
        last_name: "",
        email: ""
    };

    switch (kind) {
        case 'form': {    
            let preparedFields: string[] = []; 
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
                    mergeFields.email = value;
                } else if (key.indexOf("nome") >= 0) {
                    (key.indexOf("sobrenome") < 0)? mergeFields.first_name = value: mergeFields.last_name = value;  
                }
            }
            break;
        } 

        case 'donation':{
            const preparedCustomer = JSON.parse('{'+ action_fields.replace(/=>/g, ":")
            .replace(/\\/g,"")
            .replace(/"{/g, "{")
            .replace(/}"/g, "}")+ '}');
              
            if(preparedCustomer.name.trim().indexOf(" ")>0){
                mergeFields.first_name = preparedCustomer.name.trim().split(' ').slice(0, -1).join(' ');
                mergeFields.last_name  = preparedCustomer.name.trim().split(' ').slice(-1).join(' ');
            } else {
                mergeFields.first_name = preparedCustomer.name;
                mergeFields.last_name = " ";
            }
         
            mergeFields.email = preparedCustomer.email; 
            break;
        }

        case 'pressure' :{
            mergeFields.first_name = action_fields.name;
            mergeFields.last_name = action_fields.lastname;
            mergeFields.email = action_fields.email; 
            break;
        }

        case 'pressure-phone':{
            mergeFields.first_name = action_fields.name;
            mergeFields.last_name = action_fields.lastname;
            mergeFields.email = action_fields.email; 
            break;
        }
    }

    if(!mergeFields.first_name || !mergeFields.last_name){
        throw new Error('Fields not found!');     
    }
    return mergeFields;
}

