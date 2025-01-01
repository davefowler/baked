console.log('db - 🚀 Worker script starting...');

// Import dependencies
import initSqlJs from '/baked/sql.js/sql-wasm-es.js';
import { Baker } from '/baked/baker.js';

async function initDatabase() {
  console.log('db - 🏗️ Initializing SQL.js...');
  
  try {
    // First initialize SQL.js
    const SQL = await initSqlJs({
      locateFile: (filename) => {
        console.log('db - 📍 Locating file:', filename);
        return `/baked/sql.js/${filename}`;
      }
    });
    console.log('db - ✅ SQL.js initialized');

    // Then import and setup absurd-sql
    const { SQLiteFS } = await import('/baked/absurd-sql/index.js');
    const { default: IndexedDBBackend } = await import('/baked/absurd-sql/indexeddb-backend.js');

    // Setup filesystem
    const sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
    SQL.register_for_idb(sqlFS);

    SQL.FS.mkdir('/sql');
    SQL.FS.mount(sqlFS, {}, '/sql');

    return SQL;
  } catch (error) {
    console.error('db - 💥 Error initializing database:', error);
    throw error;
  }
}

let baker = null;
let absurdDB = null;

// Message handler
self.addEventListener('message', async (e) => {
  console.log('db - 📥 Received message:', e.data);
  const { id, action, path } = e.data;
  
  try {
    console.log('db - 🎯 Processing action:', action);
    switch (action) {
      case 'init':
        console.log('db - 🏗️ Starting initialization...');
        const SQL = await initDatabase();
        const db = new SQL.Database();
        console.log('db - ✅ Database initialized', db);
        baker = new Baker(db, true);
        await baker.init();
        console.log('db - ✅ Baker initialized');
        self.postMessage({ id, result: 'initialized' });
        break;

      case 'handleRoute':
        const html = await handleRoute(path);
        self.postMessage({ id, html });
        break;
    }
  } catch (error) {
    console.error('db - 💥 Worker error:', error);
    self.postMessage({ id, error: error.message });
  }
});

console.log('db - 🎧 Message listener registered');

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

