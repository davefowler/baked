import { Baker } from '../baker';
import { Database } from '@vlcn.io/absurd-sql/web';
import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';

class ClientApp {
  private baker: Baker;
  private dbWorker: Worker;

  constructor(baker: Baker) {
    this.baker = baker;
    this.initializeDatabase();
    this.initializeRouter();
  }

  private async initializeDatabase() {
    this.dbWorker = new Worker(new URL('./db.worker.ts', import.meta.url));
    initBackend(this.dbWorker);
    
    // Initialize the database
    await this.sendWorkerMessage({ action: 'init' });
  }

  private sendWorkerMessage(message: any): Promise<any> {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).substr(2, 9);
      
      const handler = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.dbWorker.removeEventListener('message', handler);
          resolve(e.data);
        }
      };
      
      this.dbWorker.addEventListener('message', handler);
      this.dbWorker.postMessage({ ...message, id });
    });
  }

  private initializeRouter() {
    // Handle initial page load
    this.handleRoute(window.location.pathname);

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname);
    });

    // Intercept all link clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      
      if (anchor && anchor.href && anchor.origin === window.location.origin) {
        e.preventDefault();
        const path = anchor.pathname;
        history.pushState({}, '', path);
        this.handleRoute(path);
      }
    });
  }

  private async handleRoute(path: string) {
    // Remove trailing slash except for root path
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // Remove .html extension if present
    path = path.replace(/\.html$/, '');

    // Try to get the page from baker
    const page = this.baker.getPage(path);
    
    if (page) {
      const html = this.baker.renderPage(page);
      document.documentElement.innerHTML = html;
      return;
    }

    // If page not found, try with .html extension
    const htmlPage = this.baker.getPage(`${path}.html`);
    
    if (htmlPage) {
      const html = this.baker.renderPage(htmlPage);
      document.documentElement.innerHTML = html;
      return;
    }

    // Handle 404
    console.error(`Page not found: ${path}`);
    // You might want to render a 404 page here
  }
}

// Initialize the app when the database is ready
declare global {
  interface Window {
    baker: Baker;
    clientApp: ClientApp;
  }
}

window.addEventListener('load', async () => {
  try {
    // Initialize AbsurdSQL database
    const db = new Database('baked/db.sql');
    await db.init(); // Wait for database to initialize

    if (window.baker) {
      window.clientApp = new ClientApp(window.baker);
    } else {
      console.error('Baker not initialized');
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
});

