/*---------------------------------------------------------------------------------------------
 * Edit File Tool Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext, TEST_FILES_DIR } from './setup';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('EditFileTool', () => {
    // const registry = ToolRegistry;
    const context = createTestContext();

    beforeEach(async () => {
        // Reset test file before each test
        await fs.writeFile(
            path.join(TEST_FILES_DIR, 'edit-test.txt'),
            'Hello World\nThis is a test file\nLine 3\nAnother line'
        );
    });

    test('should edit single occurrence', async () => {
        const testFile = path.join(TEST_FILES_DIR, 'edit-test.txt');

        const result = await ToolRegistry.executeTool('edit_file', {
            filePath: testFile,
            oldText: 'Hello World',
            newText: 'Hello Universe'
        }, context);

        expect(result.getText()).toContain('Edited file');
        expect(result.getText()).toContain('1 occurrence');

        const fileContent = await fs.readFile(testFile, 'utf-8');
        expect(fileContent).toContain('Hello Universe');
        expect(fileContent).not.toContain('Hello World');
    });

    test('should replace all occurrences', async () => {
        const testFile = path.join(TEST_FILES_DIR, 'edit-test.txt');
        await fs.writeFile(testFile, 'test\nAnother test\nFinal test line');

        const result = await ToolRegistry.executeTool('edit_file', {
            filePath: testFile,
            oldText: 'test',
            newText: 'example',
            replaceAll: true
        }, context);

        expect(result.getText()).toContain('Edited file');
        expect(result.getText()).toContain('occurrences');

        const fileContent = await fs.readFile(testFile, 'utf-8');
        expect(fileContent).toBe('example\nAnother example\nFinal example line');
    });

    test('should handle multiline replacement', async () => {
        const testFile = path.join(TEST_FILES_DIR, 'edit-test.txt');

        const result = await ToolRegistry.executeTool('edit_file', {
            filePath: testFile,
            oldText: 'This is a test file\nLine 3',
            newText: 'This is an edited file\nModified line 3'
        }, context);

        expect(result.getText()).toContain('Edited file');

        const fileContent = await fs.readFile(testFile, 'utf-8');
        expect(fileContent).toContain('This is an edited file');
        expect(fileContent).toContain('Modified line 3');
    });

    test('should handle text not found', async () => {
        const testFile = path.join(TEST_FILES_DIR, 'edit-test.txt');

        const result = await ToolRegistry.executeTool('edit_file', {
            filePath: testFile,
            oldText: 'Non-existent text',
            newText: 'Replacement'
        }, context);

        expect(result.hasErrors()).toBe(true);
    });

    test('should handle non-existent file', async () => {
        const result = await ToolRegistry.executeTool('edit_file', {
            filePath: path.join(TEST_FILES_DIR, 'nonexistent.txt'),
            oldText: 'anything',
            newText: 'replacement'
        }, context);

        expect(result.hasErrors()).toBe(true);
    });

    test('should preserve file encoding', async () => {
        const testFile = path.join(TEST_FILES_DIR, 'encoding-test.txt');
        const content = 'Ação com acentos e çedilhas';
        await fs.writeFile(testFile, content, 'utf-8');

        const result = await ToolRegistry.executeTool('edit_file', {
            filePath: testFile,
            oldText: 'Ação',
            newText: 'Operação'
        }, context);

        expect(result.getText()).toContain('Edited file');

        const fileContent = await fs.readFile(testFile, 'utf-8');
        expect(fileContent).toContain('Operação com acentos e çedilhas');
    });
});