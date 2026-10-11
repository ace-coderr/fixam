import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build can be served from any path inside the game's iframe host.
export default defineConfig({
  base: './',
  plugins: [react()],
});
