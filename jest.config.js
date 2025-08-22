module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  testPathIgnorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.real.test.ts',
    'real-functionality.test.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        module: 'commonjs',
        target: 'es2019'
      }
    }]
  },
  collectCoverageFrom: [
    'src/tools/**/*.ts',
    '!src/tools/**/*.test.ts',
    '!src/tools/**/__tests__/**',
    '!src/**/*.d.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/tools/__tests__/setup.ts'],
  testTimeout: 15000, // Increased for comprehensive tests
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^vscode$': '<rootDir>/src/tools/__tests__/__mocks__/vscode.ts'
  },
  verbose: false, // Less verbose for cleaner consolidated output
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  collectCoverage: false, // Disable initially to focus on test fixes
  moduleDirectories: ['node_modules', '<rootDir>/src']
};