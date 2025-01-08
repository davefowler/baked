// Import SQLite WASM
import sqlite3InitModule from './sqlite-wasm/sqlite3.mjs';

let db = null; // Store database instance

self.onmessage = async (e) => {
  const { action, id, data } = e.data;
  
  try {
    switch (action) {
      case 'init':
        const SQL = await sqlite3InitModule({
          // Specify proper location for wasm file
          locateFile: file => `/baked/sqlite-wasm/${file}`,
          // Print debug info
          print: console.log,
          printErr: console.error
        });

        // Check if OPFS is available
        if (!SQL.OpfsDb) {
          console.error('SQL.OpfsDb not available:', SQL);
          throw new Error('OPFS support not available in SQLite module');
        }

        try {
          // Try to open the database
          db = await SQL.OpfsDb.open('site.db');
          console.log('Successfully opened OPFS database');
          self.postMessage({ id, result: 'initialized', db });
        } catch (dbError) {
          console.error('Failed to open OPFS database:', dbError);
          throw dbError;
        }
        break;
        
      case 'deserialize':
        if (!db) {
          throw new Error('Database not initialized');
        }
        const { arrayBuffer } = data;
        await db.exec('VACUUM');
        await db.deserialize(new Uint8Array(arrayBuffer));
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