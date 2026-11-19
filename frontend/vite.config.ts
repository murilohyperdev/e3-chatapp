import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The browser only ever talks to the Vite origin; /api and /sanctum are proxied
// to Laravel. Same origin means no CORS and first-party cookies, which is what
// session-based (Sanctum SPA) authentication needs later on.
const target = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/sanctum': { target, changeOrigin: true },
    },
  },
})
