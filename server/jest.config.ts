import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: ['**/tests/**/*.test.ts'],
  maxWorkers: 1,
  testTimeout: 15000,
  setupFiles: ['./tests/setup.ts']
};

export default config;
