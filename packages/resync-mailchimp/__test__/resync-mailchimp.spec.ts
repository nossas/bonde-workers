import { resyncMailchimpHandle } from "../src/resync-mailchimp"; 


jest.resetModules(); // Most important - it clears the cache
process.env.PORT = "3002";
process.env.REDIS_URL = "redis://127.0.0.1:6379";
process.env.DATABASE_URL= "postgres://monkey_user:monkey_pass@localhost:49153/bonde";
 
describe("resyncMailchimpHandle", () => {

  it("should return id queue", async()=>{
    
  });
  
  it("should return undefined", async()=>{
  
  });
;})
