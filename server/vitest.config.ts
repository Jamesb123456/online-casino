import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
      include: [
        'src/**/*.ts',
        'routes/**/*.ts',
        'middleware/**/*.ts',
        'drizzle/models/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        'dist/**',
        'scripts/**',
        'drizzle/db.ts',
        'drizzle/schema.ts',
        'lib/auth.ts',
      ],
      thresholds: {
        lines: 50,
        functions: 45,
        branches: 40,
        statements: 50,
      },
    },
    testTimeout: 10000,
    pool: 'forks',
    reporters: ['default'],
  },
});
