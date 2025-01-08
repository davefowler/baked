import sqlite3InitModule from '/baked/sqlite-wasm/sqlite3.mjs';

let db = null;

self.onmessage = async (e) => {
  const { action, id, data } = e.data;
  
  try {
    switch (action) {
      case 'init':
        const SQL = await sqlite3InitModule({
          locateFile: (file) => `/baked/sqlite-wasm/${file}`
        });
        db = await SQL.OpfsDb.open('site.db');
        self.postMessage({ id, result: 'initialized' });
        break;
        
      case 'execute':
        if (!db) throw new Error('Database not initialized');
        const result = await db.exec(data.sql, data.bind);
        self.postMessage({ id, result });
        break;
        
      case 'deserialize':
        if (!db) throw new Error('Database not initialized');
        await db.exec('VACUUM');
        await db.deserialize(new Uint8Array(data.arrayBuffer));
        self.postMessage({ id, result: 'deserialized' });
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('OPFS Worker Error:', error);
    self.postMessage({ id, error: error.message });
  }
};

// Handle worker errors
self.onerror = (error) => {
  console.error('OPFS Worker Global Error:', error);
}; 