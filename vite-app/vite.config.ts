import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Dev-only proxy: requests to /api/* are forwarded to the backend so the browser
  // doesn't hit CORS. In production, set VITE_API_BASE_URL to your backend origin
  // and the proxy is bypassed entirely.
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Listen on all interfaces so phones on the LAN can open http://<this-pc-ip>:5173
      host: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
