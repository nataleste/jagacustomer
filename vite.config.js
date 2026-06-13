import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy API calls to Hosan's link-agent service (run on :8000).
    // Same-origin in dev, so no CORS needed.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
