/*---------------------------------------------------------------------------------------------
 * Write File Tool Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext, TEST_FILES_DIR } from './setup';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('WriteFileTool', () => {
    const registry = ToolRegistry.getInstance();
    const context = createTestContext();

    test('should write new file', async () => {
        const testFile = path.join(TEST_FILES_DIR, 'new-file.txt');
        const content = 'This is new content\nWith multiple lines';

        const result = await registry.executeTool('write_file', {
            filePath: testFile,
            content
        }, context);

        expect(result.getText()).toContain('Created file');
        expect(result.getText()).toContain('new-file.txt');

        const fileContent = await fs.readFile(testFile, 'utf-8');
        expect(fileContent).toBe(content);
    });

    test('should overwrite existing file', async () => {
        const testFile = path.join(TEST_FILES_DIR, 'overwrite-test.txt');
        await fs.writeFile(testFile, 'Original content');

        const newContent = 'New content that replaces old';

        const result = await registry.executeTool('write_file', {
            filePath: testFile,
            content: newContent
        }, context);

        expect(result.getText()).toContain('Updated file');
        expect(result.getText()).toContain('overwrite-test.txt');

        const fileContent = await fs.readFile(testFile, 'utf-8');
        expect(fileContent).toBe(newContent);
    });

    test('should create directories if they do not exist', async () => {
        const testFile = path.join(TEST_FILES_DIR, 'deep', 'nested', 'file.txt');
        const content = 'Deep nested content';

        const result = await registry.executeTool('write_file', {
            filePath: testFile,
            content
        }, context);

        expect(result.getText()).toContain('Created file');

        const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        const fileContent = await fs.readFile(testFile, 'utf-8');
        expect(fileContent).toBe(content);
    });

    test('should handle empty content', async () => {
        const testFile = path.join(TEST_FILES_DIR, 'empty.txt');

        const result = await registry.executeTool('write_file', {
            filePath: testFile,
            content: ''
        }, context);

        expect(result.getText()).toContain('Created file');

        const fileContent = await fs.readFile(testFile, 'utf-8');
        expect(fileContent).toBe('');
    });

    test('should handle large content', async () => {
        const testFile = path.join(TEST_FILES_DIR, 'large.txt');
        const content = 'Large content\n'.repeat(1000);

        const result = await registry.executeTool('write_file', {
            filePath: testFile,
            content
        }, context);

        expect(result.getText()).toContain('Created file');
        expect(result.getText()).toContain('KB');

        const fileContent = await fs.readFile(testFile, 'utf-8');
        expect(fileContent).toBe(content);
    });
});