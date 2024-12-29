import express from 'express';
import path from 'path';

export default function startServer(port: number = 4242, indexonly: boolean = false) {
  const app = express();

  // Serve static files from dist directory
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
