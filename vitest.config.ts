import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['engine/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
});
