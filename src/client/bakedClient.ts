

class ClientApp {
  private dbWorker!: Worker;

  public async init() {
    console.log('🚀 Starting worker initialization...');
    try {
      this.dbWorker = new Worker(
        new URL('/baked/baked.worker.js', import.meta.url),
        { type: 'module' }
      );
      
      // Initialize the worker
      await this.sendWorkerMessage({ action: 'init' });
      
      // run tests if in dev mode
      if (window.location.href.includes('localhost')) {
        console.log('🧪 Running tests...');
        await this.sendWorkerMessage({ action: 'test' });
      }

      console.log('🛣️ Initializing router...');
      this.initializeRouter();
    } catch (error) {
      console.error('💥 Error during initialization:', error);
      throw error;
    }
  }

  private initializeRouter() {
    console.log('🔗 initializing router');
    // // Handle initial page load
    // this.handleRoute(window.location.pathname);

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname);
    });

    console.log('🔗 adding click event listener');
    // Intercept all link clicks
    document.addEventListener('click', (e) => {
      console.log('🔗 click event:', e);
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
    console.log('🔗 tell worker to handle route:', path);
    try {
      const response = await this.sendWorkerMessage({ 
        action: 'handleRoute', 
        path 
      });
      console.log('🔗 worker response:', response);
      if (response.html) {
        
        document.documentElement.innerHTML = response.html;
      } else {
        console.error('❌ No HTML returned for route:', path);
      }
    } catch (error) {
      console.error('💥 Error handling route:', error);
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
}

// Initialize the app when the database is ready
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



