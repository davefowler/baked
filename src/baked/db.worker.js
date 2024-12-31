import { Baker } from '../baker';

let baker = null;
let db = null;


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

// Message handler
self.addEventListener('message', async (e) => {
  const { id, action, path } = e.data;
  
  try {
    switch (action) {
      case 'init':
        db = await initDatabase();
        baker = new Baker(db, true);
        await baker.init();
        self.postMessage({ id, result: 'initialized' });
        break;

      case 'handleRoute':
        const html = await handleRoute(path);
        self.postMessage({ id, html });
        break;
    }
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({ id, error: error.message });
  }
});

async function handleRoute(path) {
  // Remove trailing slash except for root path
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  // Remove .html extension if present
  if (path.endsWith('.html')) {
    path = path.replace(/\.html$/, '');
  }

  // Try to get the page
  let page = baker.getPage(path);
  
  // Try index if needed
  if (!page && (path.endsWith('/') || path === '')) {
    const indexPath = path === '' ? 'index' : `${path}/index`;
    page = baker.getPage(indexPath);
  }
  
  if (page) {
    return baker.renderPage(page);
  }

  // Try with .html extension
  const htmlPath = path === '' ? 'index.html' : `${path}.html`;
  page = baker.getPage(htmlPath);
  
  if (page) {
    return baker.renderPage(page);
  }

  // 404
  return `
    <html>
      <head><title>404 - Not Found</title></head>
      <body>
        <h1>Page Not Found</h1>
        <p>The requested page "${path}" could not be found.</p>
      </body>
    </html>
  `;
}

// ... keep existing initialization code ...