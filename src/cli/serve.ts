import express from 'express';
import path from 'path';

export default function startServer(port: number = 4242, indexonly: boolean = false) {
  const app = express();

  // Set correct MIME types
  express.static.mime.define({
    'application/javascript': ['mjs'],
    'application/wasm': ['wasm']
  });

  // Serve static files from dist directory with custom headers
  app.use((req, res, next) => {
    // Add security headers required for SharedArrayBuffer
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    
    // Add CORS headers for development
    res.header('Access-Control-Allow-Origin', '*');
    
    // Add specific headers for .mjs files
    if (req.path.endsWith('.mjs')) {
      res.header('Content-Type', 'application/javascript');
    }
    // Add specific headers for .wasm files
    else if (req.path.endsWith('.wasm')) {
      res.header('Content-Type', 'application/wasm');
    }
    next();
  });

  app.use(express.static('dist'));

  // Handle requests that might need .html extension or index.html
  app.use((req, res, next) => {
    let url = req.url;

    if (indexonly && url !== '/') {
      return res.status(404).send('Not Found');
    }
    
    // Try these patterns in order:
    // 1. Original URL (already handled by express.static)
    // 2. URL + .html
    // 3. URL + /index.html (for directory roots)
    
    // Remove trailing slash if present (except for root)
    if (url.length > 1 && url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    // Try with .html extension
    if (!url.endsWith('.html')) {
      const htmlPath = path.join(process.cwd(), 'dist', `${url}.html`);
      res.sendFile(htmlPath, (err) => {
        if (!err) return;
        
        // If .html didn't work, try /index.html
        const indexPath = path.join(process.cwd(), 'dist', `${url}/index.html`);
        res.sendFile(indexPath, (err) => {
          if (err) {
            next(); // Continue to 404 if none of the attempts worked
          }
        });
      });
    } else {
      next();
    }
  });

  // Fallback for all other routes
  app.use((req, res) => {
    res.status(404).send('Not Found');
  });

  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });

  return server;
}
