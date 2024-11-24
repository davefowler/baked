import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import { Database } from 'sql.js';

async function initDatabase() {
  // Initialize absurd-sql
  initBackend();
  
  try {
    const response = await fetch('/site.db');
    const arrayBuffer = await response.arrayBuffer();
    
    // Create SQL.js database instance
    const db = new Database(new Uint8Array(arrayBuffer));
    
    // Store in IndexedDB for offline access
    const request = indexedDB.open('absurdsite', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('sqlite')) {
        db.createObjectStore('sqlite');
      }
    };
    
    return db;
  } catch (error) {
    console.error('Failed to load database:', error);
  }
}

// Load database after page load
if (document.readyState === 'complete') {
  initDatabase();
} else {
  window.addEventListener('load', initDatabase);
}
