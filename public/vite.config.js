import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    minify: 'terser',
    target: 'es2022'
  }
});
