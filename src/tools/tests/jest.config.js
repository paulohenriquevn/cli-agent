/*---------------------------------------------------------------------------------------------
 * Jest Configuration for CLI Tools Testing
 *--------------------------------------------------------------------------------------------*/

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        '../implementations/*.ts',
        '../base/*.ts',
        '../registry/*.ts',
        '!**/*.d.ts',
    ],
    setupFilesAfterEnv: ['<rootDir>/setup.ts'],
    testTimeout: 10000,
    verbose: true,
    clearMocks: true,
    restoreMocks: true,
    maxWorkers: 1 // Sequential execution for file system tests
};