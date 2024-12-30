/// <reference lib="webworker" />
import initSqlJs from '@jlongster/sql.js';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';

console.log('db - 🚀 Worker script starting...');

let db: any = null;

// Add error handler for uncaught errors
self.addEventListener('error', (error) => {
  console.error('db - 💥 Uncaught worker error:', {
    message: error.message,
    filename: error.filename,
    lineno: error.lineno,
    colno: error.colno
  });
});

// Add unhandled rejection handler
self.addEventListener('unhandledrejection', (event) => {
  console.error('db - 💥 Unhandled rejection in worker:', event.reason);
});

self.onmessage = async (e) => {
  const { id, action, payload } = e.data;
  console.log('db - 📥 Received message:', { id, action, payload });
  
  try {
    switch (action) {
      case 'init':
        console.log('db - 🚀 Starting database initialization...');
        db = await initDatabase();
        // Wait for db initialization to complete before sending response
        if (!db) {
          throw new Error('Database initialization failed');
        }
        console.log('db - ✅ Database initialized successfully');
        self.postMessage({ id, result: 'initialized', type: 'init-complete' });
        break;

      case 'query':
        if (!db) {
          throw new Error('Database not initialized');
        }
        console.log('db - 🔍 Executing query:', payload.sql);
        const { sql, params } = payload;
        const result = db.prepare(sql).all(...(params || []));
        console.log('db - ✅ Query complete, rows:', result?.length);
        self.postMessage({ id, result });
        break;

      case 'get':
        if (!db) {
          throw new Error('Database not initialized');
        }
        console.log('db - 🔍 Executing get:', payload.sql);
        const { sql: getSql, params: getParams } = payload;
        const getResult = db.prepare(getSql).get(...(getParams || []));
        console.log('db - ✅ Get complete, result:', getResult ? 'found' : 'not found');
        self.postMessage({ id, result: getResult });
        break;
    }
  } catch (error: unknown) {
    console.error('db - 💥 Error in worker:', error);
    if (error instanceof Error) {
      self.postMessage({ id, error: error.message });
    } else {
      self.postMessage({ id, error: String(error) });
    }
  }
};

async function initDatabase() {
  console.log('db - 🏗️ Initializing SQL.js...');
  
  try {
    const SQL = await initSqlJs({ 
      locateFile: (file: string) => `/node_modules/@jlongster/sql.js/dist/${file}`
    });
    console.log('db - ✅ SQL.js initialized');

    console.log('db - 🔧 Setting up SQLiteFS...');
    const sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
    SQL.register_for_idb(sqlFS);

    console.log('db - 📁 Creating SQL directory...');
    SQL.FS.mkdir('/sql');
    SQL.FS.mount(sqlFS, {}, '/sql');

    const bakedDbPath = '/baked/site.db';
    console.log('db - 📚 Opening database at:', bakedDbPath);

    if (typeof SharedArrayBuffer === 'undefined') {
      console.log('db - ⚠️ SharedArrayBuffer not available, using fallback...');
      const stream = SQL.FS.open(bakedDbPath, 'r');
      await stream.node.contents.readIfFallback();
      SQL.FS.close(stream);
      console.log('db - ✅ Fallback read complete');
    }

    console.log('db - 🔌 Creating database connection...');
    const db = new SQL.Database(bakedDbPath, { filename: true });
    
    console.log('db - ⚙️ Setting PRAGMA values...');
    db.exec(`
      PRAGMA journal_mode=MEMORY;
      PRAGMA page_size=8192;
    `);

    console.log('db - ✨ Database initialization complete');
    return db;
  } catch (error) {
    console.error('db - 💥 Error initializing database:', error);
    throw error;
  }
} 