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

    // Now fetch the initial data
    const response = await fetch('/baked/site.sqlite');
    const arrayBuffer = await response.arrayBuffer();
    
    // Create a new database directly from the downloaded file
    const db = new SQL.Database(new Uint8Array(arrayBuffer));
    
    // Test that we can query the database
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('db - ✅ Database initialized', tables[0]);
    const npages = db.exec("SELECT count(*) FROM pages");
    console.log('db - number of pages', npages[0].values[0][0]);
    const nassets = db.exec("SELECT count(*) FROM assets");
    console.log('db - number of assets', nassets[0].values[0][0]);

    return db;
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
        absurdDB = await initDatabase();
        console.log('db - ✅ Database initialized', absurdDB);

        console.log('db - properties of absurdDB', Object.keys(absurdDB));

        // test the database querying for 1+2
        const result = absurdDB.exec('SELECT 1+2 as sum');
        console.log('db - 🧪 Test result: 1+1 = ', result, result[0].values[0][0]);
        
        baker = new Baker(absurdDB, true);
        console.log('db - ✅ Baker initialized', baker);
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

