import Mailchimp from 'mailchimp-api-v3';
import crypto from 'crypto';
import { Contact, Tag } from "./types"


interface MailchimpResolve {
  subscribe: () => Promise<any>
  merge: () => Promise<any>
}

export const tags = (contact: Contact): Tag[] => {
  
  const status = 'active';
  return [
    // TAG COMMUNITY
    { name: `C${contact.community_id} - ${contact.community_name}`, status },
    // TAG MOBILIZATION
    { name: `M${contact.mobilization_id} - ${contact.mobilization_name}`, status },
    // TAG WIDGET KIND
    { name: contact.kind.toUpperCase().substring(0, 1) + '' + contact.widget_id, status }
  ];
};

export const hash = (email: string): string => crypto
  .createHash('md5')
  .update(email.toLowerCase())
  .digest('hex')
;

export default (contact:Contact): MailchimpResolve => {

  const client = new Mailchimp(contact.mailchimp_api_key || '');
  const listID = contact.mailchimp_list_id;

  // Mailchimp Functions
  return {
    subscribe: async (): Promise<any> => {
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
      await client.post({ path: path + '/tags', body: { tags: tags(contact) } });

      return { updated_at: response.last_changed };
    },
    merge: async (): Promise<any> => {
      const form: any = {
        tag: 'CITY',
        name: 'City',
        type: 'text',
        required: false,
        public: true
      }

      await client.post({
        path: `/lists/${listID}/merge-fields`,
        body: form
      })
      return { status: 'ok' }
    }
  };
};
