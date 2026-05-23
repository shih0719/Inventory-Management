import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, '.', '');
    // Dev-only proxy: requests to /api/* are forwarded to the backend so the browser
    // doesn't hit CORS. In production, set VITE_API_BASE_URL to your backend origin
    // and the proxy is bypassed entirely.
    var proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';
    return {
        plugins: [react()],
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
