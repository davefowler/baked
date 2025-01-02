// Simplified test worker to debug the sql.js module

// run this test worker with the following: 
// const testWorker = new Worker(
//     new URL('/baked/test.worker.js', window.location.href
//     ),
//     { type: 'module' }
//   );
  
//   testWorker.onmessage = (event) => {
//     console.log('🧪 Test Worker Message:', event.data);
//   };
  
//   testWorker.onerror = (error) => {
//     console.error('💥 Worker Error:', error);
//   };
  
console.log('🧪 Test worker');

import initSqlJs from '/baked/sql.js/sql-wasm-es.js';

console.log('🧪 Test worker - initSqlJs:', initSqlJs);
console.log('🧪 Test worker - typeof initSqlJs:', typeof initSqlJs);
console.log('🧪 Test worker - properties of initSqlJs:', Object.keys(initSqlJs));

if (typeof initSqlJs === 'function') {
    initSqlJs({ locateFile: file => `/baked/sql.js/${file}` })
        .then(SQL => {
            console.log('🧪 SQL.js Initialized:', SQL);

            // Create a new in-memory database
            const db = new SQL.Database();
            console.log('🧪 Database created in memory');

            // Execute SQL commands
            db.run(`
                CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);
            `);
            console.log('🧪 Table "test" created');

            db.run(`
                INSERT INTO test (name) VALUES ('Alice'), ('Bob');
            `);
            console.log('🧪 Two rows inserted into "test" table');

            // Query the table
            const result = db.exec(`
                SELECT * FROM test;
            `);
            console.log('🧪 Query result:', result);

            // Close the database
            db.close();
            console.log('🧪 Database closed successfully');
        })
        .catch(err => {
            console.error('🧪 SQL.js Initialization Failed:', err);
        });
} else {
    console.error('💥 initSqlJs is not a function. Actual type:', typeof initSqlJs);
}
