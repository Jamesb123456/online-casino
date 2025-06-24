import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss({
      content: ['./src/**/*.{js,jsx,ts,tsx}', './index.html']
    })
  ],
  server: {
    port: 5173,
    host: true,
    open: false
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});