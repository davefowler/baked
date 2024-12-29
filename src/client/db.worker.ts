import initSqlJs from '@jlongster/sql.js';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';

let db: any = null;

self.onmessage = async (e) => {
  const { id, action, payload } = e.data;
  
  try {
    switch (action) {
      case 'init':
        db = await initDatabase();
        self.postMessage({ id, type: 'init-complete' });
        break;

      case 'query':
        const { sql, params } = payload;
        const result = db.prepare(sql).all(...(params || []));
        self.postMessage({ id, result });
        break;

      case 'get':
        const { sql: getSql, params: getParams } = payload;
        const getResult = db.prepare(getSql).get(...(getParams || []));
        self.postMessage({ id, result: getResult });
        break;
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      self.postMessage({ id, error: error.message });
    } else {
      self.postMessage({ id, error: String(error) });
    }
  }
};

async function initDatabase() {
  const SQL = await initSqlJs({ 
    locateFile: file => `/baked/${file}`
  });

  const sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
  SQL.register_for_idb(sqlFS);

  SQL.FS.mkdir('/sql');
  SQL.FS.mount(sqlFS, {}, '/sql');

  const bakedDbPath = '/baked/site.db';

  if (typeof SharedArrayBuffer === 'undefined') {
    const stream = SQL.FS.open(bakedDbPath, 'r'); // 'a+' later for writing/updating
    await stream.node.contents.readIfFallback();
    SQL.FS.close(stream);
  }

  const db = new SQL.Database(bakedDbPath, { filename: true });
  
  db.exec(`
    PRAGMA journal_mode=MEMORY;
    PRAGMA page_size=8192;
  `);

  return db;
} 