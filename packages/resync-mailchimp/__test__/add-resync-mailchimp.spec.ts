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
utils.dbPool.mockResolvedValue(pool);
utils.queueContacts = mockQueue;
const spyonConnect = jest.spyOn(pg, "connect");

describe("addResyncMailchimpHandle search with widget", () => {

    it("should return id queue", async () => {
        const id = await addResyncMailchimpHandle(1234, false);
        expect(id).toBe("started to add contacts to the queue");
    });

    it("should call query 1 times", () => {
         expect(spyonConnect).toBeCalledTimes(1);
    });
    ;
}); 