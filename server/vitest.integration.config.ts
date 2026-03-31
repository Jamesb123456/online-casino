import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Ensure .js imports resolve to .ts source files (not compiled output)
      '../../../server.js': path.resolve(__dirname, 'server.ts'),
      '../../../drizzle/db.js': path.resolve(__dirname, 'drizzle/db.ts'),
      '../../../drizzle/schema.js': path.resolve(__dirname, 'drizzle/schema.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    fileParallelism: false,
    pool: 'threads',
    reporters: ['default'],
  },
});
