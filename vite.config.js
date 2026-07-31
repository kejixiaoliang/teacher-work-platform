import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: 'web',
  base: './',
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3210' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
