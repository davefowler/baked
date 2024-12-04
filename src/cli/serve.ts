import express from 'express';
import path from 'path';

export default function startServer(port: number = 4242) {
  const app = express();

  // Serve static files from dist directory
  app.use(express.static('dist'));

  // Serve index.html for root path
  app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
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
