import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  // Ensure Vite pre-bundles lightweight-charts so the correct ESM build is used at runtime.
  optimizeDeps: {
    include: ['lightweight-charts'],
  },
  // Force Vite dev server to use a single, fixed port and fail if it's taken.
  // This prevents Vite from auto-incrementing to 5174 when 5173 is already
  // in use which was causing the project to sometimes appear on 5174.
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Forward API requests to the local Express service so relative `/api/*`
      // calls from the SPA hit the Docker stack instead of the Vite dev server.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
