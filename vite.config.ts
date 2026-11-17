import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyStaticContentPlugin(): Plugin {
  return {
    name: 'copy-static-assets-and-sources',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      copyDirRecursive(path.resolve(__dirname, 'assets'), path.join(distDir, 'assets'));
      copyDirRecursive(path.resolve(__dirname, 'sources'), path.join(distDir, 'sources'));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), copyStaticContentPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/sources': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
