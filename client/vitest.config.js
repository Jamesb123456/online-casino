import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}', 'src/**/*.spec.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/test/**',
        '**/*.test.*',
        '**/*.spec.*',
        'src/main.jsx',
      ],
      thresholds: {
        lines: 30,
        functions: 25,
        branches: 20,
        statements: 30,
      },
    },
    testTimeout: 10000,
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
