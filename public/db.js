import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import { Database } from 'sql.js';

// Global absurd object
window.absurd = {
    db: null,
    
    async init() {
        this.db = await SiteDatabase.getInstance();
    },

    getRawAsset(name, type = null) {
        const path = type ? `/${type}/${name}` : name;
        const result = this.db.prepare('SELECT content FROM assets WHERE path = ?').get(path);
        return result ? result.content : null;
    },

    getAsset(name, type = null) {
        const rawAsset = this.getRawAsset(name, type);
        if (!rawAsset) return null;

        if (type) {
            const componentCode = this.getRawAsset(`${type}.js`, 'components');
            if (componentCode) {
                const componentFactory = eval(componentCode);
                return componentFactory(rawAsset);
            }
        }

        return rawAsset;
    },

    getTemplate(name) {
        return this.getAsset(name, 'templates');
    }
};

class SiteDatabase {
  static instance = null;
  
  static async getInstance() {
    if (!this.instance) {
      this.instance = await this.initDatabase();
    }
    return this.instance;
  }

  static async initDatabase() {
    // Initialize absurd-sql
    initBackend();
    
    try {
      // Try to load from IndexedDB first
      const dbFromCache = await this.loadFromIndexedDB();
      if (dbFromCache) {
        return dbFromCache;
      }

      // If not in IndexedDB, fetch from network
      const response = await fetch('/site.db');
      const arrayBuffer = await response.arrayBuffer();
      
      // Create SQL.js database instance
      const db = new Database(new Uint8Array(arrayBuffer));
      
      // Store in IndexedDB for offline access
      await this.saveToIndexedDB(arrayBuffer);
      
      return db;
    } catch (error) {
      console.error('Failed to load database:', error);
      throw error;
    }
  }

  static async loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('absurdsite', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('sqlite')) {
          db.createObjectStore('sqlite');
        }
      };

      request.onsuccess = async (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['sqlite'], 'readonly');
        const store = transaction.objectStore('sqlite');
        const request = store.get('database');
        
        request.onsuccess = () => {
          if (request.result) {
            resolve(new Database(new Uint8Array(request.result)));
          } else {
            resolve(null);
          }
        };
      };

      request.onerror = () => reject(request.error);
    });
  }

  static async saveToIndexedDB(arrayBuffer) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('absurdsite', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['sqlite'], 'readwrite');
        const store = transaction.objectStore('sqlite');
        store.put(arrayBuffer, 'database');
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }
}

// Initialize database when page loads
if (document.readyState === 'complete') {
  SiteDatabase.getInstance();
} else {
  window.addEventListener('load', () => SiteDatabase.getInstance());
}

// Export for use in other scripts
export { SiteDatabase };
