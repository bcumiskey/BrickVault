import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Dev proxy: forward /api/brickeconomy to a local handler
    // In production, Vercel serverless functions handle this
    proxy: {
      '/api/brickeconomy': {
        target: 'https://www.brickeconomy.com',
        changeOrigin: true,
        rewrite: (path) => {
          // Extract the BE path from query params and rewrite
          const url = new URL(path, 'http://localhost');
          const bePath = url.searchParams.get('path') || '';
          url.searchParams.delete('path');
          const remaining = url.searchParams.toString();
          return `/api/v1/${bePath}${remaining ? '?' + remaining : ''}`;
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Add required User-Agent header that browsers strip
            proxyReq.setHeader('User-Agent', 'BrickVault/1.0');
            proxyReq.setHeader('Accept', 'application/json');
          });
        },
      },
    },
  },
})
