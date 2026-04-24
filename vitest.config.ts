import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Minimal Vitest config that avoids loading Svelte dev HMR plugins from the
// project's Vite config. Run tests with `vitest --config=vitest.config.ts` or
// via npm script `npm run test` (after updating package.json).

export default defineConfig({
  test: {
  globals: true,
  // Use 'node' to avoid Vitest trying to auto-install jsdom. We polyfill
  // localStorage in the setup file so unit tests relying on it still work.
  environment: 'node',
  // only include test files with `.test.ts` to avoid picking up setup files
  include: ['src/lib/__tests__/**/*.test.ts'],
  isolate: true,
  setupFiles: ['src/lib/__tests__/test-setup.ts']
  },
  // Minimal alias mapping so `$lib/...` imports resolve during tests.
  resolve: {
    alias: [
      { find: '$lib', replacement: path.resolve(__dirname, 'src/lib') },
      { find: '$routes', replacement: path.resolve(__dirname, 'src/routes') }
    ]
  }
});
