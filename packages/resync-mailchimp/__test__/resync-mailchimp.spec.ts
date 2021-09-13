import { resyncMailchimpHandle } from "../src/resync-mailchimp";
import pgmock, { getPool } from 'pgmock2';
import Redis from "ioredis-mock";
import Queue from "bull";

const pg = new pgmock();
const pool = getPool(pg);
pg.add('select id, kind from widgets where id = 1234', ['string'], {
    rowCount: 1,
    rows: [
        { id: 1234, kind: 'donation' }
    ]
});

const utils = require('../src/utils');
jest.mock('../src/utils');
const redisMockClient = new Redis();
const mockQueue = new Queue("contacts-mailchimp", { createClient: () => redisMockClient });
const client = pool.connect();
utils.dbClient.mockResolvedValue(client);
utils.queueContacts = mockQueue;
const spyonQuery = jest.spyOn(pg, "query");

describe("resyncMailchimpHandle search with widget", () => {

    it("should return id queue", async () => {
        const id = await resyncMailchimpHandle(1234, false);
        expect(id).toBe("bull:contacts-mailchimp:id");
    });

    it("should call query 2 times", () => {
        expect(spyonQuery).toHaveBeenCalledWith('select id, kind from widgets where id = 1234', undefined);
        expect(spyonQuery).toBeCalledTimes(2);
    });
    ;
})