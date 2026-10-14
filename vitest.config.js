import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit-*.test.js', 'test/app-*.test.js', 'test/site-*.test.js'],
    environment: 'node',
    setupFiles: ['test/setup.js'],
  },
});
