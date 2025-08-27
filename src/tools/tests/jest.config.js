/*---------------------------------------------------------------------------------------------
 * Jest Configuration for CLI Tools Testing
 *--------------------------------------------------------------------------------------------*/

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '../../../',
    testMatch: ['<rootDir>/src/tools/tests/**/*.test.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        '<rootDir>/src/tools/implementations/*.ts',
        '<rootDir>/src/tools/base/*.ts',
        '<rootDir>/src/tools/registry/*.ts',
        '!**/*.d.ts',
    ],
    setupFilesAfterEnv: ['<rootDir>/src/tools/tests/setup.ts'],
    testTimeout: 10000,
    verbose: true,
    clearMocks: true,
    restoreMocks: true,
    maxWorkers: 1 // Sequential execution for file system tests
};