import { resyncMailchimpHandle } from "../src/resync-mailchimp"; 
import pgmock, { getPool } from 'pgmock2';
import Redis from "ioredis-mock";
import Queue from "bull";

afterEach(() => {
  jest.clearAllMocks();
});

const pg = new pgmock();
const pool = getPool(pg);
pg.add('select id, kind from widgets where id = 1234', ['number'], {
  rowCount: 1,
  rows: [
      { id: 1234, kind: 'donation' }
  ]
});

const utils = require('../src/utils');
jest.mock('../src/utils');
const redisMockClient = new Redis();
const mockQueue = new Queue("contacts-mailchimp", { createClient: () => redisMockClient });
const client =  pool.connect();
utils.dbClient.mockResolvedValue(client);
utils.queueContacts = mockQueue;

describe("resyncMailchimpHandle", () => {

  it("should return id queue", async()=>{
    const spyonQuery = jest.spyOn(pg,"query" );
    const id = await resyncMailchimpHandle(1234,false);
    expect(id).toBe("bull:contacts-mailchimp:id");
    expect(spyonQuery).toBeCalledTimes(2);
  });
;})