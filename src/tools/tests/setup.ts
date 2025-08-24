/*---------------------------------------------------------------------------------------------
 * Test Setup for CLI Tools
 *--------------------------------------------------------------------------------------------*/

import { promises as fs } from 'fs';
import * as path from 'path';
// ToolRegistry is imported via tool implementations
import { CliExecutionContext } from '../types/cliTypes';

// Import all tools to register them
import '../implementations/readFileTool';
import '../implementations/writeFileTool';
import '../implementations/editFileTool';
import '../implementations/bashCommandTool';
import '../implementations/grepTool';
import '../implementations/listDirectoryTool';
import '../implementations/globTool';
import '../implementations/multiEditTool';
import '../implementations/todoWriteTool';
import '../implementations/taskTool';
import '../implementations/webFetchTool';
import '../implementations/exitPlanModeTool';
import '../implementations/webSearchTool';
import '../implementations/executeCommandTool';

// Test directories
export const TEST_DIR = path.join(__dirname, 'test-workspace');
export const TEST_FILES_DIR = path.join(TEST_DIR, 'files');

// Test context
export const createTestContext = (): CliExecutionContext => ({
    workingDirectory: TEST_DIR,
    environment: { ...process.env, NODE_ENV: 'test' },
    sessionId: 'test-session',
    timeout: 5000,
    verbose: false
});

// Setup and teardown helpers
export const setupTestWorkspace = async (): Promise<void> => {
    try {
        await fs.mkdir(TEST_DIR, { recursive: true });
        await fs.mkdir(TEST_FILES_DIR, { recursive: true });
        
        // Create test files
        await fs.writeFile(
            path.join(TEST_FILES_DIR, 'test.txt'),
            'Hello World\nThis is a test file\nLine 3'
        );
        
        await fs.writeFile(
            path.join(TEST_FILES_DIR, 'test.js'),
            'console.log("Hello from JavaScript");\nfunction test() { return true; }'
        );
        
        await fs.writeFile(
            path.join(TEST_FILES_DIR, 'package.json'),
            JSON.stringify({ name: 'test-package', version: '1.0.0' }, null, 2)
        );
        
        // Create subdirectory
        await fs.mkdir(path.join(TEST_FILES_DIR, 'subdir'), { recursive: true });
        await fs.writeFile(
            path.join(TEST_FILES_DIR, 'subdir', 'nested.txt'),
            'Nested file content'
        );
        
    } catch (error) {
        console.warn('Setup workspace warning:', error);
    }
};

export const cleanupTestWorkspace = async (): Promise<void> => {
    try {
        await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
        console.warn('Cleanup workspace warning:', error);
    }
};

// Global setup
beforeAll(async () => {
    await setupTestWorkspace();
    // ToolRegistry é um singleton direto, não precisa de getInstance()
    // registry.setDefaultContext(createTestContext());
});

// Global cleanup
afterAll(async () => {
    await cleanupTestWorkspace();
});

// Reset between tests
beforeEach(() => {
    jest.clearAllMocks();
});