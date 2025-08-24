/*---------------------------------------------------------------------------------------------
 * Tool Registry Tests - LLM-Friendly API
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext } from './setup';

describe('ToolRegistry - LLM-Friendly API', () => {
    const context = createTestContext();

    test('should be accessible with core methods', () => {
        expect(ToolRegistry).toBeDefined();
        expect(ToolRegistry.listTools).toBeDefined();
        expect(ToolRegistry.executeTool).toBeDefined();
        expect(ToolRegistry.getTool).toBeDefined();
    });

    test('should list registered tools', () => {
        const tools = ToolRegistry.listTools();
        expect(tools.length).toBeGreaterThan(0);
        
        // Test that tools are BaseTool instances
        tools.forEach(tool => {
            expect(typeof tool).toBe('object');
            expect(tool.name).toBeDefined();
            expect(tool.description).toBeDefined();
        });
    });

    test('should have tools in expected categories', () => {
        const fileTools = ToolRegistry.getToolsByCategory('file_operations');
        const commandTools = ToolRegistry.getToolsByCategory('command-execution');
        
        expect(fileTools.length).toBeGreaterThan(0);
        expect(commandTools.length).toBeGreaterThan(0);
    });

    test('should get tool by name', () => {
        const readTool = ToolRegistry.getTool('read_file');
        expect(readTool).toBeDefined();
        
        if (readTool) {
            expect(readTool.name).toBe('read_file');
        }
    });

    test('should return undefined for non-existent tool', () => {
        const nonExistentTool = ToolRegistry.getTool('non_existent_tool');
        expect(nonExistentTool).toBeUndefined();
    });

    test('should execute tool by name', async () => {
        const result = await ToolRegistry.executeTool('read_file', {
            filePath: 'files/package.json',
            limit: 5
        }, context);
        
        expect(result).toBeDefined();
        expect(result.getText().length).toBeGreaterThan(0);
    });

    test('should list all registered tools', () => {
        const tools = ToolRegistry.listTools();
        expect(tools.length).toBeGreaterThan(0);
        
        // Get tool names from instances
        const toolNames = tools.map(tool => tool.name);
        
        console.log('Available tool names:', toolNames);
        
        // Check for some expected core tools
        expect(toolNames).toContain('read_file');
        expect(toolNames).toContain('write_file');
        expect(toolNames).toContain('bash');
    });

    test('should get tools by category', () => {
        const fileTools = ToolRegistry.getToolsByCategory('file_operations');
        expect(fileTools.length).toBeGreaterThan(0);
        
        // Verify these are file operation tools
        const toolNames = fileTools.map(tool => tool.name);
        
        console.log('File operation tool names:', toolNames);
        expect(toolNames).toContain('read_file');
    });

    test('should get tools by tag', () => {
        const coreTools = ToolRegistry.getToolsByTag('core');
        expect(coreTools.length).toBeGreaterThan(0);
        
        const essentialTools = ToolRegistry.getToolsByTag('essential');
        expect(essentialTools.length).toBeGreaterThan(0);
    });

    test('should handle tool execution errors gracefully', async () => {
        try {
            await ToolRegistry.executeTool('nonexistent_tool', {}, context);
            fail('Should have thrown error for nonexistent tool');
        } catch (error) {
            expect((error as Error).message).toContain('not found');
        }
    });

    test('should provide basic statistics', () => {
        const stats = ToolRegistry.getStats();
        
        expect(stats.totalTools).toBeGreaterThan(0);
        expect(stats.toolsByCategory).toBeDefined();
        expect(stats.toolsByTag).toBeDefined();
        expect(stats.toolsByComplexity).toBeDefined();
        
        // Check complexity distribution
        expect(stats.toolsByComplexity.core).toBeGreaterThanOrEqual(0);
        expect(stats.toolsByComplexity.essential).toBeGreaterThanOrEqual(0);
    });

    test('should handle tool execution errors gracefully', async () => {
        try {
            await ToolRegistry.executeTool('non_existent_tool', {}, context);
            fail('Should have thrown an error');
        } catch (error) {
            expect(error).toBeDefined();
        }
    });

    test('should maintain stable tool count', () => {
        const initialCount = ToolRegistry.getStats().totalTools;
        
        // Tools are registered during import, so count should be stable
        const currentCount = ToolRegistry.getStats().totalTools;
        expect(currentCount).toBe(initialCount);
    });

    test('should provide tool descriptions', () => {
        const tools = ToolRegistry.listTools();
        
        tools.forEach(tool => {
            expect(tool.description).toBeDefined();
            expect(tool.description.length).toBeGreaterThan(5);
        });
    });

    test('should have consistent tool naming', () => {
        const tools = ToolRegistry.listTools();
        
        tools.forEach(tool => {
            expect(tool.name).toMatch(/^[a-z_]+$/); // lowercase with underscores
            expect(tool.name).not.toContain(' ');
            expect(tool.name).not.toContain('-');
        });
    });

    test('should provide tool complexity information', () => {
        const tools = ToolRegistry.listTools();
        
        const complexityLevels = ['core', 'essential', 'advanced'];
        
        tools.forEach(tool => {
            expect(complexityLevels).toContain(tool.complexity);
        });
    });

    test('should handle concurrent tool execution', async () => {
        const promises = [
            ToolRegistry.executeTool('bash', { command: 'echo "test1"', description: 'Test 1' }, context),
            ToolRegistry.executeTool('bash', { command: 'echo "test2"', description: 'Test 2' }, context),
            ToolRegistry.executeTool('bash', { command: 'echo "test3"', description: 'Test 3' }, context)
        ];
        
        const results = await Promise.all(promises);
        
        expect(results).toHaveLength(3);
        results.forEach((result: any) => {
            expect(result).toBeDefined();
            expect(result.getText().length).toBeGreaterThan(0);
        });
    });
});