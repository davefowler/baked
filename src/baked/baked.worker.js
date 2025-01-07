console.log('db - 🚀 Worker script starting...');

// Import dependencies
import { Baker } from '/baked/baker.js';
import { DatabaseWrapper } from '/baked/sqlite-opfs-wrapper.js';

async function initDatabase() {
  console.log('db - 🏗️ Initializing SQLite...');
  
  try {
    // Initialize SQLite3 WASM
    const sqlite3 = await import('@sqlite.org/sqlite-wasm');
    const SQL = await sqlite3.default();
    
    // Check for OPFS support
    if (!('storage' in navigator && 'getDirectory' in navigator.storage)) {
      throw new Error('OPFS is not supported in this browser');
    }

    // Get OPFS root directory
    const root = await navigator.storage.getDirectory();
    const dbDir = await root.getDirectoryHandle('sqlite-db', { create: true });
    
    // Initialize the database
    const db = await SQL.OpfsDb.open('site.db');
    
    // If this is first run, we need to fetch and load the initial database
    const isFirstRun = !(await dbExists(dbDir));
    if (isFirstRun) {
      // Fetch initial database
      const response = await fetch('/baked/site.db');
      const arrayBuffer = await response.arrayBuffer();
      
      // Write the database to OPFS
      await db.exec('VACUUM');  // Ensure clean slate
      await db.deserialize(new Uint8Array(arrayBuffer));
    }
    
    return db;
  } catch (error) {
    console.error('db - 💥 Error initializing database:', error);
    throw error;
  }
}

// Helper to check if database exists
async function dbExists(dbDir) {
  try {
    await dbDir.getFileHandle('site.db');
    return true;
  } catch {
    return false;
  }
}

let baker = null;
let db = null;

// Message handler
self.addEventListener('message', async (e) => {
  console.log('db - 📥 Received message:', e.data);
  const { id, action, path } = e.data;
  
  try {
    console.log('db - 🎯 Processing action:', action);
    switch (action) {
      case 'init':
        console.log('db - 🏗️ Starting initialization...');
        db = await initDatabase();
        console.log('db - ✅ Database initialized', db);

        baker = new Baker(db, true);
        console.log('db - ✅ Baker initialized', baker);

        self.postMessage({ id, result: 'initialized' });
        break;

      case 'test':
        console.log('db - 🧪 Running tests...', db, baker);
        const { runDbTests, runBakerTests } = await import('/baked/clientTests.js');
        await runDbTests(db);
        await runBakerTests(db, baker);
        self.postMessage({ id, result: 'tests completed' });
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
  console.log('db - 🎯 handleRoute', path);
  // Remove trailing slash except for root path

  if (path === '/') {
    path = 'index';
  }

  if (path.startsWith('/')) {
    path = path.slice(1);
  }

  if (path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  // Remove .html extension if present
  if (path.endsWith('.html')) {
    path = path.replace(/\.html$/, '');
  }

  console.log('db - getting page', path);
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

