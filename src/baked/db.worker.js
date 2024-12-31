import initSqlJs from './sql.js/sql-wasm.js';
import { SQLiteFS } from './absurd-sql/index.js';
import IndexedDBBackend from './absurd-sql/indexeddb-backend.js';

console.log('db - 🚀 Worker script starting...');

let db = null;

async function initDatabase() {
  console.log('db - 🏗️ Initializing SQL.js...');
  
  try {
    const SQL = await initSqlJs({ 
      locateFile: file => file
    });
    console.log('db - ✅ SQL.js initialized');

    const sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
    SQL.register_for_idb(sqlFS);

    SQL.FS.mkdir('/sql');
    SQL.FS.mount(sqlFS, {}, '/sql');

    const bakedDbPath = '/baked/site.db';
    console.log('db - 📚 Opening database at:', bakedDbPath);

    // Handle Safari fallback
    if (typeof SharedArrayBuffer === 'undefined') {
      console.log('db - ⚠️ SharedArrayBuffer not available, using fallback...');
      const stream = SQL.FS.open(bakedDbPath, 'r');
      await stream.node.contents.readIfFallback();
      SQL.FS.close(stream);
    }

    db = new SQL.Database(bakedDbPath, { filename: true });
    db.exec(`
      PRAGMA journal_mode=MEMORY;
      PRAGMA page_size=8192;
    `);

    return db;
  } catch (error) {
    console.error('db - 💥 Error initializing database:', error);
    throw error;
  }
}

// Message handler
self.onmessage = async (e) => {
  const { id, action, payload } = e.data;
  console.log('db - 📥 Received message:', { id, action, payload });

  try {
    switch (action) {
      case 'init':
        console.log('db - 🚀 Starting database initialization...');
        db = await initDatabase();
        self.postMessage({ id, result: 'initialized' });
        break;

      case 'query':
        if (!db) throw new Error('Database not initialized');
        const stmt = db.prepare(payload.sql);
        const results = stmt.all(payload.params);
        stmt.free();
        self.postMessage({ id, result: results });
        break;

      case 'get':
        if (!db) throw new Error('Database not initialized');
        const getStmt = db.prepare(payload.sql);
        const result = getStmt.get(payload.params);
        getStmt.free();
        self.postMessage({ id, result });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('db - 💥 Error in worker:', error);
    self.postMessage({ id, error: error.message });
  }
}; 