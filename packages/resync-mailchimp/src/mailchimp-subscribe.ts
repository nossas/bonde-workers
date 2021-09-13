import Mailchimp from 'mailchimp-api-v3';
import crypto from 'crypto';
import { Contact, Tag, TagFields } from "./types";
interface MailchimpResolve {
    subscribe: () => Promise<any>
};

export const tags = (fields: TagFields): Tag[] => {

    const status = 'active';
    return [
        // TAG COMMUNITY
        { name: `C${fields.community_id} - ${fields.community_name}`, status },
        // TAG MOBILIZATION
        { name: `M${fields.mobilization_id} - ${fields.mobilization_name}`, status },
        // TAG WIDGET KIND
        { name: fields.kind.toUpperCase().substring(0, 1) + '' + fields.widget_id, status }
    ];
};

export const hash = (email: string): string => crypto
    .createHash('md5')
    .update(email.toLowerCase())
    .digest('hex');

export default async (contact: Contact): Promise<any> => {

    const { mailchimp_api_key, mailchimp_list_id } = { ...contact };
    const tagFields: TagFields = {
        community_id: contact.community_id,
        community_name: contact.community_name,
        mobilization_id: contact.mobilization_id,
        mobilization_name: contact.mobilization_name,
        widget_id: contact.widget_id,
        kind: contact.kind
    };
    const client = new Mailchimp(mailchimp_api_key || '');
    const listID = mailchimp_list_id;
    const body: any = {
        "email_address": contact.email,
        "status": "subscribed",
        "merge_fields": {
            "FNAME": contact.first_name,
            "LNAME": contact.last_name
        }
    }

    if (contact.city) {
        body.merge_fields['CITY'] = contact.city;
    }
    if (contact.phone) {
        body.merge_fields['PHONE'] = contact.phone;
    }
    if (contact.state) {
        body.merge_fields['STATE'] = contact.state;
    }

    const path = `/lists/${listID}/members/${hash(contact.email)}`;
    // Create or Update Member
    const response = await client.put({ path, body });
    // Add tags
    await client.post({ path: path + '/tags', body: { tags: tags(tagFields) } });
    return { updated_at: response.last_changed };
};
