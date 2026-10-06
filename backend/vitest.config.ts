import { defineConfig } from 'vitest/config';

// Tests use a separate database. Create it once (see README, "Run the tests").
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgres://cab:cabpass@localhost:5432/cab_test',
      JWT_SECRET: 'test-access-secret-test-access-secret-1234',
      JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-1234',
      SMS_PROVIDER: 'console',
    },
  },
});
