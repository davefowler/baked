import { Baker } from '../baker';
export interface DbProxy {
  exec: (sql: string, bind?: any[]) => Promise<any>;
  prepare: (sql: string) => any;
  transaction: (fn: () => void) => void;
  pragma: (sql: string, value?: any) => any;
  migrate: (migrations: any) => void;
}

class ClientApp {
  private worker: Worker | null = null;
  private baker: Baker | null = null;
  private dbProxy: DbProxy | null = null;

  public async init() {
    console.log('🚀 Starting initialization...');
    try {
      await this.initDatabase();
      
      // run tests if in dev mode
      if (window.location.href.includes('localhost')) {
        console.log('🧪 Running tests...');
        await this.runTests();
      }

      console.log('🛣️ Initializing router...');
      this.initializeRouter();
      
      // Handle initial route
      await this.handleRoute(window.location.pathname);
    } catch (error) {
      console.error('💥 Error during initialization:', error);
      throw error;
    }
  }

  private async initDatabase() {
    console.log('db - 🏗️ Initializing SQLite...');
    
    try {
      // Initialize OPFS worker
      this.worker = new Worker('/baked/opfs-worker.js', { type: 'module' });
      
      // Initialize the database in the worker
      await this.sendWorkerMessage('init');

      // Check for OPFS support
      if (!('storage' in navigator && 'getDirectory' in navigator.storage)) {
        throw new Error('OPFS is not supported in this browser');
      }

      // Get OPFS root directory for existence check
      const root = await navigator.storage.getDirectory();
      const dbDir = await root.getDirectoryHandle('sqlite-db', { create: true });
      
      // If this is first run, we need to fetch and load the initial database
      const isFirstRun = !(await this.dbExists(dbDir));
      if (isFirstRun) {
        // Fetch initial database
        const response = await fetch('/baked/site.db');
        const arrayBuffer = await response.arrayBuffer();
        
        // Send the database to the worker
        await this.sendWorkerMessage('deserialize', { arrayBuffer });
      }

      // Create a proxy object that forwards SQL operations to the worker
      this.dbProxy = {
        exec: async (sql: string, bind?: any[]) => {
          return this.sendWorkerMessage('execute', { sql, bind });
        },
        prepare: async (sql: string) => {
          return this.sendWorkerMessage('prepare', { sql });
        },
        transaction: async (fn: () => void) => {
          await this.sendWorkerMessage('transaction', fn);
        },
        pragma: async (sql: string, value?: any) => {
          return this.sendWorkerMessage('pragma', { sql, value });
        },
        migrate: async (migrations: any) => {
          await this.sendWorkerMessage('migrate', { migrations });
        }
      };

      this.baker = new Baker(this.dbProxy, true);
      console.log('db - ✅ Database and Baker initialized');
    } catch (error) {
      console.error('db - 💥 Error initializing database:', error);
      throw error;
    }
  }

  private async sendWorkerMessage(action: string, data?: any) {
    return new Promise((resolve, reject) => {
      if (!this.worker) return reject(new Error('Worker not initialized'));
      
      const id = Math.random().toString(36).slice(2);
      
      const handler = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.worker!.removeEventListener('message', handler);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.result);
        }
      };
      
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ action, id, data });
    });
  }

  private async dbExists(dbDir: FileSystemDirectoryHandle): Promise<boolean> {
    try {
      await dbDir.getFileHandle('site.db');
      return true;
    } catch {
      return false;
    }
  }

  private async runTests() {
    if (!this.dbProxy || !this.baker) return;
    // Use relative path for TypeScript
    const { runDbTests, runBakerTests } = await import('../baked/clientTests.js');
    await runDbTests(this.dbProxy);
    await runBakerTests(this.dbProxy, this.baker);
  }

  private initializeRouter() {
    console.log('🔗 initializing router');

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname);
    });

    // Intercept all link clicks
    document.addEventListener('click', (e) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (anchor && anchor.href && anchor.origin === window.location.origin) {
        e.preventDefault();
        console.log('🔗 Clicked link:', anchor.href);
        const path = anchor.pathname;
        history.pushState({}, '', path);
        this.handleRoute(path);
      }
    });
  }

  private async handleRoute(path: string) {
    console.log('🔗 handling route:', path);
    try {
      if (!this.baker) throw new Error('Baker not initialized');
      
      // Get the page
      let html: string;
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

      let page = this.baker.getPage(path);
      
      // Try index if needed
      if (!page && (path.endsWith('/') || path === '')) {
        const indexPath = path === '' ? 'index' : `${path}/index`;
        page = this.baker.getPage(indexPath);
      }
      
      if (page) {
        html = this.baker.renderPage(page);
      } else {
        // Try with .html extension
        const htmlPath = path === '' ? 'index.html' : `${path}.html`;
        page = this.baker.getPage(htmlPath);
        
        if (page) {
          html = this.baker.renderPage(page);
        } else {
          // 404
          html = `
            <html>
              <head><title>404 - Not Found</title></head>
              <body>
                <h1>Page Not Found</h1>
                <p>The requested page "${path}" could not be found.</p>
              </body>
            </html>
          `;
        }
      }

      document.documentElement.innerHTML = html;
    } catch (error) {
      console.error('💥 Error handling route:', error);
    }
  }
}

// Initialize the app when the page loads
declare global {
  interface Window {
    clientApp: ClientApp;
  }
}

window.addEventListener('load', async () => {
  console.log('🌟 Loading Baked Client app');
  try {
    window.clientApp = new ClientApp();
    console.log('📦 Client app created, initializing...');
    await window.clientApp.init();
    console.log('✨ Initialization complete!');
  } catch (error) {
    console.error('💥 Failed to initialize:', error);
  }
});



