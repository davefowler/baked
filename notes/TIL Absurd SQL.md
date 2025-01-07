Things I learned with Absurd SQL:


- some sort of module issue with sql.js
   - have to do two changes:
      comment out "module = undefined" in sql.js/sql-wasm.js
      add "export default initSqlJs" in sql.js/sql-wasm-es.js

- can just copy sql-wasm.js and sql-wasm.wasm out of @jlongster/sql.js/dist/sql-wasm.js and use that


 - can load a pre-existing database with:

     const response = await fetch('/baked/site.db');
    const arrayBuffer = await response.arrayBuffer();
    
    // Create a new database directly from the downloaded file
    const db = new SQL.Database(new Uint8Array(arrayBuffer));
    

  - 

  SQLite3 WASM and OPFS is better than Absurd SQL...