export type Contact = {
    id: number;
    email: string,
    first_name: string,
    last_name: string,
    phone?: string,
    city?: string,
    state?: string,
    community_id: number,
    community_name: string,
    mobilization_id: number,
    mobilization_name: string,
    widget_id: number,
    kind: string,
    mailchimp_api_key: string,
    mailchimp_list_id: string, 
    action_fields: string,
    table: string
}

export type Tag = {
    name: string
    status: string
}

export type TagFields = {
    community_id: number,
    community_name: string,
    mobilization_id: number,
    mobilization_name: string,
    widget_id: number,
    kind: string
}

export type MergeFields = {
    first_name: string,
    last_name: string,
    email: string,
    phone?: string,
    city?: string,
    state?: string,
    
}