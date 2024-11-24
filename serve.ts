import { serve } from "bun";

export default function startServer() {
  const server = serve({
    port: 4242,
    fetch(req) {
      const url = new URL(req.url);
      let path = url.pathname;
      
      // Serve index.html for root path
      if (path === '/') {
        path = '/index.html';
      }
      
      // Remove leading slash and join with dist directory
      const filePath = `dist${path}`;
      
      try {
        // Try to serve the file from dist directory
        const file = Bun.file(filePath);
        return new Response(file);
      } catch (error) {
        // Return 404 if file not found
        return new Response('Not Found', { status: 404 });
      }
    },
  });

  console.log(`Server running at http://localhost:${server.port}`);
  return server;
}
