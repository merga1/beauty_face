import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Local dev: proxy /api to the Express backend so VITE_API_BASE can stay empty.
    // Production (separate Render services): VITE_API_BASE = https://beauty-face-api.onrender.com
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    // Raise the size warning threshold slightly (Supabase + React 19 is ~525 kB minified)
    chunkSizeWarningLimit: 600,
  },
});
