import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function safePublicCopy(): import('vite').Plugin {
  return {
    name: 'safe-public-copy',
    apply: 'build',
    async writeBundle(options) {
      const outDir = options.dir || 'dist';
      const srcDir = path.resolve(__dirname, 'public_safe');
      if (!fs.existsSync(srcDir)) return;
      const files = fs.readdirSync(srcDir);
      for (const file of files) {
        const src = path.join(srcDir, file);
        const dest = path.join(path.resolve(__dirname, outDir), file);
        try {
          fs.accessSync(src, fs.constants.R_OK);
          fs.copyFileSync(src, dest);
        } catch {
          // skip locked/inaccessible files
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), safePublicCopy()],
  publicDir: false,
  resolve: {
    alias: {
      'xlsx-js-style': path.resolve(__dirname, 'node_modules/xlsx-js-style/dist/xlsx.min.js'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['xlsx-js-style'],
  },
});
