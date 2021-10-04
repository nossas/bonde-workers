import { addResyncMailchimpHandle } from "../src/add-resync-mailchimp";
import pgmock, { getPool } from 'pgmock2';
import Redis from "ioredis-mock";
import Queue from "bull";

const pg = new pgmock();
const pool = getPool(pg);

const utils = require('../src/utils');
jest.mock('../src/utils');
jest.mock('bull');
const redisMockClient = new Redis();
const mockQueue = new Queue("resync-contacts-mailchimp", { createClient: () => redisMockClient });

const client = pool.connect();
utils.dbClient.mockResolvedValue(client);
utils.queueContacts = mockQueue;
const spyonQuery = jest.spyOn(pg, "query");

describe("addResyncMailchimpHandle search with widget", () => {
    
    pg.add(`select id, kind from widgets where id = 1234 and kind in ('form','donation','pressure-phone','pressure')`,
        ['string'], {
        rowCount: 1,
        rows: [
            { id: 1234, kind: 'donation' }
        ]
    });
    it("should return id queue", async () => {
        const id = await addResyncMailchimpHandle(1234, false);
        expect(id).toBe("started to add contacts to the queue");
    });

    it("should call query 2 times", () => {
        expect(spyonQuery).toHaveBeenCalledWith(`select id, kind from widgets where id = 1234 and kind in ('form','donation','pressure-phone','pressure')`,
                                                 undefined);
        expect(spyonQuery).toBeCalledTimes(2);
    });
    ;
}); 