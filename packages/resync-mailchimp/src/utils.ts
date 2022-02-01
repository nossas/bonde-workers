import { Pool } from "pg";
import Queue from "bull";
import { Contact, MergeFields } from "./types";

const url = require('url');

export const dbPool = async () => {
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
    return new Pool(config);

}

export const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
export const queueContacts = new Queue(`resync-contacts-mailchimp`, REDIS_URL);

export const actionTable = (kind: string) => {
    switch (kind) {
        case 'donation': {
            return { name: 'donations', action_fields: 'customer', kind: kind };
        }
        case 'form': {
            return { name: 'form_entries', action_fields: 'fields', kind: kind  };
        }
        case 'pressure': {
            return { name: 'activist_pressures', action_fields: 'form_data', kind: kind  };
        }
        case 'pressure-phone': {
            return { name: 'activist_pressures', action_fields: 'form_data', kind: kind  };
        }
        default: return undefined
    }
}

const extractState = (value: string) => {
    const states = {
      acre: "ac",
      alagoas: "al",
      amapá: "ap",
      pernambuco: "pe",
      amazonas: "am",
      paraíba: "pb",
      bahia: "ba",
      ceará: "ce",
      "distrito federal": "df",
      "espírito santo": "es",
      goiás: "go",
      "mato grosso": "mt",
      "mato grosso do sul": "ms",
      roraima: "rr",
      maranhão: "ma",
      "minas gerais": "mg",
      paraná: "pr",
      piauí: "pi",
      "rio de janeiro": "rj",
      "rio grande do norte": "rn",
      "rio grande do sul": "rs",
      rondônia: "ro",
      "santa catarina": "sc",
      "são paulo": "sp",
      sergipe: "se",
      tocantins: "to",
      pará: "pa",
    };
    for (const [name, uf] of Object.entries(states)) {
        // console.log(`${name}: ${uf}`);
        if (value.toLocaleLowerCase().indexOf(uf) >= 0 || value.toLocaleLowerCase().indexOf(name) >= 0) {
          return uf;
        }
      }
    };

export const findMergeFields = (kind: string, action_fields: any) => {

    let mergeFields: MergeFields = {
        first_name: "",
        last_name: "",
        email: ""
    };
    if (action_fields) {
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
                        (key.indexOf("sobrenome") < 0) ? mergeFields.first_name = value : mergeFields.last_name = value;
                   
                    } else if (key.indexOf('telefone') >= 0 || key.indexOf('phone') >= 0 || 
                               key.indexOf('celular') >= 0 || key.indexOf('whatsapp') >= 0 ||
                               key.indexOf('fone') >= 0 ){
                        mergeFields.phone = value;
                                
                    } else if (key.indexOf("estado") >= 0 || key.indexOf("uf") >= 0 || key.indexOf("state") >= 0){
                        mergeFields.state = extractState(value);
                   
                    } else if (key.indexOf("cidade") >= 0 || key.indexOf("city") >= 0){
                        mergeFields.city = value;
                    }
                }
                break;
            }

            case 'donation': {
                const preparedCustomer = JSON.parse('{' + action_fields.replace(/=>/g, ":")
                    .replace(/\\/g, "")
                    .replace(/"{/g, "{")
                    .replace(/}"/g, "}") + '}');

                if (preparedCustomer.name.trim().indexOf(" ") > 0) {
                    mergeFields.first_name = preparedCustomer.name.trim().split(' ').slice(0, -1).join(' ');
                    mergeFields.last_name = preparedCustomer.name.trim().split(' ').slice(-1).join(' ');
                } else {
                    mergeFields.first_name = preparedCustomer.name;
                    mergeFields.last_name = " ";
                }
                mergeFields.email = preparedCustomer.email;
                mergeFields.state = preparedCustomer.address.state;
                mergeFields.city = preparedCustomer.address.city;
                mergeFields.phone = preparedCustomer.phone.ddd + preparedCustomer.phone.number;
                break;
            }

            case 'pressure': {
                mergeFields.first_name = action_fields.name;
                mergeFields.last_name = action_fields.lastname;
                mergeFields.email = action_fields.email;
                mergeFields.city = action_fields.city;
                mergeFields.state = action_fields.state;
                break;
            }

            case 'pressure-phone': {
                mergeFields.first_name = action_fields.name;
                mergeFields.last_name = action_fields.lastname;
                mergeFields.email = action_fields.email;
                mergeFields.city = action_fields.city;
                mergeFields.state = action_fields.state;
                break;
            }
        }
    }

    return mergeFields;
}