import initSqlJs from '@jlongster/sql.js';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';

// Set up message handling for database operations
self.onmessage = async (e) => {
  const { id, action, payload } = e.data;
  
  switch (action) {
    case 'init':
      const db = await initDatabase();
      // You might want to load your baked/site.db file here
      self.postMessage({ id, type: 'init-complete' });
      break;
    // Add other database operations here
  }
};

async function initDatabase() {
  const SQL = await initSqlJs({ locateFile: file => file });
  const sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
  SQL.register_for_idb(sqlFS);

  SQL.FS.mkdir('/sql');
  SQL.FS.mount(sqlFS, {}, '/sql');

  const path = '/sql/db.sqlite';
  if (typeof SharedArrayBuffer === 'undefined') {
    const stream = SQL.FS.open(path, 'a+');
    await stream.node.contents.readIfFallback();
    SQL.FS.close(stream);
  }

  const db = new SQL.Database(path, { filename: true });
  return db;
} 