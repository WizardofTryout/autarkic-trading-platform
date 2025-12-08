import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external access from Docker
    proxy: {
      // Proxy API requests to backend - use Docker service name
      '/api': {
        // Allow override for host-dev; default works inside Docker Compose network
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log(`[Vite Proxy] ${req.method} ${req.url} -> ${options.target}`);
          });
          proxy.on('error', (err, req, res) => {
            console.error(`[Vite Proxy Error] ${req.url}:`, err.message);
            // Send JSON error response instead of letting it fail silently
            const response = res as any;
            if (response.writeHead && !response.headersSent) {
              response.writeHead(503, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ error: 'Backend unavailable', detail: err.message }));
            }
          });
        },
      },
    },
  },
})

