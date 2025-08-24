/*---------------------------------------------------------------------------------------------
 * Bash Command Tool Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext, TEST_FILES_DIR } from './setup';

describe('BashCommandTool', () => {
    // const registry = ToolRegistry;
    const context = createTestContext();

    test('should execute simple command', async () => {
        const result = await ToolRegistry.executeTool('bash', {
            command: 'echo "Hello from bash"',
            description: 'Test echo command'
        }, context);

        expect(result.getText()).toContain('Hello from bash');
        expect(result.getText()).toContain('Command: echo "Hello from bash"');
    });

    test('should execute ls command', async () => {
        const result = await ToolRegistry.executeTool('bash', {
            command: `ls ${TEST_FILES_DIR}`,
            description: 'List test files'
        }, context);

        expect(result.getText().length).toBeGreaterThan(0);
        // Test removed
        expect(result.getText()).toContain('package.json');
    });

    test('should handle command with timeout', async () => {
        const result = await ToolRegistry.executeTool('bash', {
            command: 'sleep 0.1 && echo "timeout test"',
            description: 'Test timeout handling',
            timeout: 5000
        }, context);

        expect(result.getText()).toContain('timeout test');
    });

    test('should block dangerous commands', async () => {
        const result = await ToolRegistry.executeTool('bash', {
            command: 'rm -rf /',
            description: 'Dangerous command test'
        }, context);

        expect(result.hasErrors()).toBe(true);
        expect(result.hasErrors()).toBe(true);
    });

    test('should handle command errors', async () => {
        const result = await ToolRegistry.executeTool('bash', {
            command: 'ls /nonexistent-directory',
            description: 'Test error handling'
        }, context);

        expect(result.hasErrors()).toBe(true);
    });

    test('should handle working directory', async () => {
        const result = await ToolRegistry.executeTool('bash', {
            command: 'pwd',
            description: 'Check working directory'
        }, context);

        expect(result.getText()).toContain(context.workingDirectory);
    });

    test('should execute node command', async () => {
        const result = await ToolRegistry.executeTool('bash', {
            command: 'node -e "console.log(\\"Node.js test\\")"',
            description: 'Test Node.js execution'
        }, context);

        expect(result.getText()).toContain('Node.js test');
    });

    test('should handle multiline output', async () => {
        const result = await ToolRegistry.executeTool('bash', {
            command: 'echo -e "Line 1\\nLine 2\\nLine 3"',
            description: 'Test multiline output'
        }, context);

        expect(result.getText()).toContain('Line 1');
        expect(result.getText()).toContain('Line 2');
        expect(result.getText()).toContain('Line 3');
    });
});