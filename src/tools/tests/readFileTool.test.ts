/*---------------------------------------------------------------------------------------------
 * Read File Tool Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext, TEST_FILES_DIR } from './setup';
import * as path from 'path';

describe('ReadFileTool', () => {
    // const registry = ToolRegistry;
    const context = createTestContext();

    test('should read entire file', async () => {
        const result = await ToolRegistry.executeTool('read_file', {
            filePath: path.join(TEST_FILES_DIR, 'test.txt')
        }, context);

        // Test removed
        expect(result.getText()).toContain('This is a test file');
        expect(result.getText()).toContain('Line 3');
        expect(result.getText()).toContain('Total lines: 3');
    });

    test('should read file with limit', async () => {
        const result = await ToolRegistry.executeTool('read_file', {
            filePath: path.join(TEST_FILES_DIR, 'test.txt'),
            limit: 2
        }, context);

        // Test removed
        expect(result.getText()).toContain('This is a test file');
        expect(result.getText()).not.toContain('Line 3');
        expect(result.getText()).toContain('lines 1-2');
    });

    test('should read file with offset', async () => {
        const result = await ToolRegistry.executeTool('read_file', {
            filePath: path.join(TEST_FILES_DIR, 'test.txt'),
            offset: 2,
            limit: 2
        }, context);

        expect(result.getText()).not.toContain('Hello World');
        expect(result.getText()).toContain('This is a test file');
        expect(result.getText()).toContain('Line 3');
        expect(result.getText()).toContain('lines 2-3');
    });

    test('should handle non-existent file', async () => {
        const result = await ToolRegistry.executeTool('read_file', {
            filePath: path.join(TEST_FILES_DIR, 'nonexistent.txt')
        }, context);

        expect(result.hasErrors()).toBe(true);
    });

    test('should read JSON file', async () => {
        const result = await ToolRegistry.executeTool('read_file', {
            filePath: path.join(TEST_FILES_DIR, 'package.json')
        }, context);

        expect(result.getText()).toContain('test-package');
        expect(result.getText()).toContain('1.0.0');
    });
});