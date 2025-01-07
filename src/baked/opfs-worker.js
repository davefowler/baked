// Import SQLite WASM
import sqlite3InitModule from './sqlite-wasm/sqlite3.mjs';

self.onmessage = async (e) => {
  const { action, id, data } = e.data;
  
  try {
    switch (action) {
      case 'init':
        const SQL = await sqlite3InitModule();
        const db = await SQL.OpfsDb.open('site.db');
        self.postMessage({ id, result: 'initialized', db });
        break;
        
      case 'deserialize':
        const { arrayBuffer } = data;
        await db.exec('VACUUM');
        await db.deserialize(new Uint8Array(arrayBuffer));
        self.postMessage({ id, result: 'deserialized' });
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
}; 