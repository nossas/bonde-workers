import { clientES, nameIndex } from "./client-elasticsearch";
import  { format } from "date-fns";

export const statusResyncMailchimpHandle = async (posfix: string) => {
    let counters = { completed : 0, waiting: 0, failed: 0, active: 0 } ; 
    const index = `${nameIndex}-${posfix}`
    console.log(index)
    const max_finished_at = await clientES
    .search({
        index,
        body: 
          {
            "aggs": {
              "max_finished_at": { "max": { "field": "finished_at" } }
            }
          }
        
      })
      .then((data) =>{
        const { body } = data; 
        return body.aggregations.max_finished_at;
      })
      
      let { body } = await clientES.sql.query({
        body: {
          query: `SELECT status, count(*) total FROM \"${index}\" group by status`
        }
      })  

      const rows = body.rows;
      
      for (var i = 0; i < body.rows.length; i++) {
        
        switch (rows[i][0]) {
            case 'waiting': {
              counters.waiting = rows[i][1];
              break;
            }
            case 'completed': {
              counters.completed = rows[i][1];
              break;
            }
            case 'failed': {
              counters.failed = rows[i][1];
              break;
            }
            case 'active': {
              counters.active = rows[i][1];
              break;
            }
        }  

      }
     
      let status = 'Parada';
      if (counters.waiting == 0) {
        if ((counters.completed >0 || counters.failed > 0)){
            status = 'Finalizada';
        }
      } else {
        if ((counters.completed >0 || counters.failed > 0)){
          status = 'Em andamento';
        }
      }

      return {
        status,
        last_sync: max_finished_at.value !== null? format( new Date(max_finished_at.value), 'dd/MM/yyyy HH:mm:ss'): "",
        ...counters
      }

}