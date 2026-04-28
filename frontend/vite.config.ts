import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { writeFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generate-version',
      buildStart() {
        writeFileSync(
          resolve(__dirname, 'public/version.json'),
          JSON.stringify({ version: Date.now().toString() })
        );
      }
    }
  ],
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    }
  },
  
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
    // Forzar UTF-8 en la compilación
    assetsInlineLimit: 0,
  },
  
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
});