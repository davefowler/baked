import { Baker } from '../baker';
import { ClientDatabase } from './clientDb';
import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';


class ClientApp {
  public baker!: Baker;
  private dbWorker!: Worker;
  private clientDb!: ClientDatabase;

  // Setup the client app 
  // including: database, baker and router
  public async init() {
    console.log('🚀 Starting database and baker initialization...');
    try {
      this.dbWorker = new Worker(new URL('./db.worker.js', import.meta.url), {
        type: 'module'
      });
      initBackend(this.dbWorker);
      
      console.log('📨 Sending init message to worker...');
      const workerResponse = await this.sendWorkerMessage({ action: 'init' });
      console.log('✅ Worker response:', workerResponse);
      
      console.log('🗄️ Creating client database wrapper...');
      this.clientDb = new ClientDatabase(this.dbWorker);
      
      console.log('🔨 Initializing baker...');
      this.baker = new Baker(this.clientDb as any, true);
      
      // Debug: Check what pages are available in baker
      console.log('📚 Available pages:', this.baker.getLatestPages?.(999999));
      
      console.log('🛣️ Initializing router...');
      this.initializeRouter();
      console.log('✅ Router initialized');
    } catch (error) {
      console.error('💥 Error during initialization:', error);
      throw error;
    }
  }


  private sendWorkerMessage(message: any): Promise<any> {
    console.log('📤 Sending worker message:', message);
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9);
      const timeout = setTimeout(() => {
        console.error('⏰ Worker message timeout for id:', id);
        this.dbWorker.removeEventListener('message', handler);
        reject(new Error('Worker message timeout'));
      }, 5000); // 5 second timeout

      const handler = (e: MessageEvent) => {
        console.log('📥 Raw worker message received:', e.data);
        if (e.data.id === id) {
          clearTimeout(timeout);
          this.dbWorker.removeEventListener('message', handler);
          console.log('✅ Matched response for message:', id);
          resolve(e.data);
        } else {
          console.log('⏭️ Skipping message with non-matching id:', e.data.id, 'expected:', id);
        }
      };
      
      // Add error handler
      const errorHandler = (error: ErrorEvent) => {
        console.error('💥 Worker error:', error);
        this.dbWorker.removeEventListener('error', errorHandler);
        reject(error);
      };

      this.dbWorker.addEventListener('error', errorHandler);
      this.dbWorker.addEventListener('message', handler);
      
      try {
        this.dbWorker.postMessage({ ...message, id });
        console.log('📨 Message posted to worker with id:', id);
      } catch (error) {
        console.error('💥 Error posting message to worker:', error);
        clearTimeout(timeout);
        this.dbWorker.removeEventListener('message', handler);
        this.dbWorker.removeEventListener('error', errorHandler);
        reject(error);
      }
    });
  }

  private initializeRouter() {
    // Debug: Log when router is being initialized
    console.log('🛣️ Router initialization starting...');

    // Handle initial page load
    console.log('📍 Initial route:', window.location.pathname);
    this.handleRoute(window.location.pathname);

    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      console.log('⏪ Popstate event triggered:', e);
      console.log('Current pathname:', window.location.pathname);
      this.handleRoute(window.location.pathname);
    });

    // Intercept all link clicks
    document.addEventListener('click', (e) => {
      console.log('🖱️ Click event:', e.target);
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      
      if (anchor) {
        console.log('📌 Anchor found:', {
          href: anchor.href,
          origin: anchor.origin,
          pathname: anchor.pathname,
          currentOrigin: window.location.origin
        });
      }
      
      if (anchor && anchor.href && anchor.origin === window.location.origin) {
        console.log('🔗 Internal link clicked:', anchor.href);
        e.preventDefault();
        const path = anchor.pathname;
        history.pushState({}, '', path);
        this.handleRoute(path);
      }
    });

    console.log('🛣️ Router initialization complete');
  }

  private async handleRoute(path: string) {
    console.log('🎯 Handling route:', path, 'Baker initialized:', !!this.baker);

    if (!this.baker) {
        console.error('❌ Baker not initialized when handling route!');
        return;
    }

    // Remove trailing slash except for root path
    if (path !== '/' && path.endsWith('/')) {
        path = path.slice(0, -1);
        console.log('📝 Removed trailing slash:', path);
    }

    // Remove .html extension if present
    if (path.endsWith('.html')) {
        path = path.replace(/\.html$/, '');
        console.log('📝 Removed .html extension:', path);
    }

    // Try to get the page from baker
    console.log('🔍 Looking for page:', path);
    let page = this.baker.getPage(path);
    
    // If no page found and path ends with '/' or is root, try with 'index'
    if (!page && (path.endsWith('/') || path === '')) {
        const indexPath = path === '' ? 'index' : `${path}/index`;
        console.log('🔍 Trying index path:', indexPath);
        page = this.baker.getPage(indexPath);
    }
    
    if (page) {
        console.log('✅ Page found!:', path, 'page', page);
        const html = this.baker.renderPage(page);
        document.documentElement.innerHTML = html;
        return;
    }

    // If page not found, try with .html extension
    const htmlPath = path === '' ? 'index.html' : `${path}.html`;
    console.log('🔍 Page not found, trying with .html extension:', htmlPath);
    const htmlPage = this.baker.getPage(htmlPath);
    
    if (htmlPage) {
        console.log('✅ HTML page found:', htmlPath);
        const html = this.baker.renderPage(htmlPage);
        document.documentElement.innerHTML = html;
        return;
    }

    // Handle 404
    console.error('❌ Page not found:', path);
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
  console.log('🌟 Loading Baked Client app');
  try {
    window.clientApp = new ClientApp();
    console.log('📦 Client app created, initializing...');
    await window.clientApp.init();
    window.baker = window.clientApp.baker;
    console.log('✨ Initialization complete!');
  } catch (error) {
    console.error('💥 Failed to initialize:', error);
  }
});



