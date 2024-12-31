console.log('db - 🚀 Worker script starting...');

// Import all dependencies as ES modules
import { SQLiteFS } from '/baked/absurd-sql/index.js';
import IndexedDBBackend from '/baked/absurd-sql/indexeddb-backend.js';

// Now we can use the imported modules
async function initDatabase() {
  console.log('db - 🏗️ Initializing SQL.js...');
  
  try {
    // Load SQL.js dynamically
    await import('./sql.js/sql-wasm.js');
    console.log('db - 📦 SQL.js module loaded, checking for global initSqlJs:', {
      hasInitSqlJs: typeof self.initSqlJs === 'function'
    });

    if (typeof self.initSqlJs !== 'function') {
      throw new Error('SQL.js loaded but initSqlJs not found in global scope');
    }

    // Initialize SQL.js using the global function
    const SQL = await self.initSqlJs({
      locateFile: file => {
        console.log('db - 📍 Locating file:', file);
        return new URL(`./sql.js/${file}`, import.meta.url).href;
      }
    });

    console.log('db - ✅ SQL.js initialized');

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
        absurdDB = await initDatabase();
        console.log('db - ✅ Database initialized');
        baker = new Baker(absurdDB, true);
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

