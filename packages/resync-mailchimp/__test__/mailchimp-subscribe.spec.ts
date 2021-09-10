import { mocked } from 'ts-jest/utils';
import Mailchimp from 'mailchimp-api-v3';
import crypto from 'crypto';
import { Contact, TagFields } from '../src/types';
import mailchimp, { tags, hash } from '../src/mailchimp-subscribe';

const mockPut = jest.fn();
const mockPost = jest.fn();
jest.mock('mailchimp-api-v3', () =>
  jest.fn().mockImplementation(() => {
    return {
      put: mockPut,
      post: mockPost
    }
  })
);
mocked(Mailchimp, true);

describe('mailchimp function tests', () => {
  const contact: Contact = {
    id: 345,
    email: 'email@email.org',
    first_name: 'Name',
    last_name: 'Sobrenome',
    phone: "9999999999" ,
    city: "City",
    state: "State",
    community_id: 12,
    community_name: "Community",
    mobilization_id: 34,
    mobilization_name: "Mobilization",
    widget_id: 5678,
    kind: "pressure",
    action: "activist_pressures",
    mailchimp_api_key: 'xxx-us10',
    mailchimp_list_id: 'xxx'
  }

  const contact_2: Contact = {
    id: 346,
    email: 'email@email.org',
    first_name: 'Name',
    last_name: 'Sobrenome',
    phone: undefined ,
    city: undefined,
    state: undefined,
    community_id: 12,
    community_name: "Community",
    mobilization_id: 34,
    mobilization_name: "Mobilization",
    widget_id: 5678,
    kind: "pressure",
    action: "activist_pressures",
    mailchimp_api_key: 'xxx-us10',
    mailchimp_list_id: 'xxx'
  }
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('hash function should be return a md5 of email with lower case', () => {
    const email = 'email@email.org';
    expect(hash(email)).toEqual(
      crypto
        .createHash('md5')
        .update(email.toLowerCase())
        .digest('hex')
    );
  });

  it('tags function should be return a COMMUNITY, MOBILIZATION and ACTION tags', () => {
    const tagsFields: TagFields = {...contact};
    const expected = [
      { name: `C${tagsFields.community_id} - ${tagsFields.community_name}` , status: 'active' },
      { name: `M${tagsFields.mobilization_id} - ${tagsFields.mobilization_name}`, status: 'active' },
      { name: tagsFields.kind.toUpperCase().substring(0, 1) + '' + tagsFields.widget_id, status: 'active' }
    ];

    expect(tags(tagsFields)).toEqual(expected);
  });

  it('merge fields name', async () => {
    mockPut.mockResolvedValue({ last_changed: '' });

    const {mailchimp_api_key, mailchimp_list_id} = { ...contact_2 }; 

    const expected = {
      path: `/lists/${mailchimp_list_id}/members/${hash(contact_2.email)}`,
      body: {
        email_address: contact.email,
        status: "subscribed",
        merge_fields: {
          FNAME: contact_2.first_name,
          LNAME: contact_2.last_name
        }
      }
    };
   
    return mailchimp(contact_2)
      .then(() => {
        expect(mockPut).toBeCalledWith(expected);
      });
  });

  it('merge_fields city , phone, state', async () => {
    mockPut.mockResolvedValue({ last_changed: '' });
    const {mailchimp_api_key, mailchimp_list_id} = { ...contact }; 
    const expected = {
      path: `/lists/${mailchimp_list_id}/members/${hash(contact.email)}`,
      body: {
        email_address: contact.email,
        status: "subscribed",
        merge_fields: {
          FNAME: contact.first_name,
          LNAME: contact.last_name,
          CITY:  contact.city,
          PHONE: contact.phone,
          STATE: contact.state
        }
      }
    };
  
    return mailchimp(contact)
      .then(() => {
        expect(mockPut).toBeCalledWith(expected);
      });
  });

});