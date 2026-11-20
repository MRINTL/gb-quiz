import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app uses HashRouter, so a relative base works for any GitHub Pages URL
// (https://user.github.io/repo/ or a custom domain). Override with VITE_BASE if needed.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
