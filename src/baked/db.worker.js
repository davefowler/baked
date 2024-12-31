console.log('db - 🚀 Worker script starting...');

// Modify the response format to match what the client expects
self.addEventListener('message', async (e) => {
  console.log('db - 📨 Basic message received:', e.data);
  const { id, action } = e.data;
  
  if (action === 'init') {
    try {
      console.log('db - 🏗️ Starting database initialization...');
      db = await initDatabase();
      console.log('db - ✅ Database initialized, sending response');
      self.postMessage({ id, result: 'initialized' });  // Correct response format
    } catch (error) {
      console.error('db - 💥 Database init error:', error);
      self.postMessage({ id, error: error.message });
    }
  }
});

try {
  const [sqlJs, { SQLiteFS }, IndexedDBBackend] = await Promise.all([
    import('/baked/sql.js/sql-wasm.js'),
    import('/baked/absurd-sql/index.js'),
    import('/baked/absurd-sql/indexeddb-backend.js')
  ]);
  
  console.log('db - ✅ All modules imported successfully');
  // Rest of your worker code...
  
} catch (error) {
  console.error('db - 💥 Failed to import modules:', error);
}

console.log('db - 🚀 Worker script starting - after imports...');
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

console.log('db - ✅ Message handler setup complete');