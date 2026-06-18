import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'checklist'),
  base: './',
  publicDir: path.resolve(__dirname, 'checklist/public'),
  build: {
    outDir: path.resolve(__dirname, 'dist-checklist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'checklist/index.html'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
