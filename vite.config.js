import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5338,
    proxy: {
      '/api': 'http://localhost:5337',
      '/uploads': 'http://localhost:5337',
      '/o': 'http://localhost:5337',
      '/ws': { target: 'ws://localhost:5337', ws: true }
    }
  }
});
