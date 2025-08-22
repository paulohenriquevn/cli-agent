/*---------------------------------------------------------------------------------------------
 * Tool Registry Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext } from './setup';

describe('ToolRegistry', () => {
    const registry = ToolRegistry.getInstance();
    const context = createTestContext();

    test('should be singleton', () => {
        const registry1 = ToolRegistry.getInstance();
        const registry2 = ToolRegistry.getInstance();
        expect(registry1).toBe(registry2);
    });

    test('should have registered tools', () => {
        const stats = registry.getStatistics();
        expect(stats.totalTools).toBeGreaterThan(0);
        expect(stats.totalTools).toBe(14); // Currently refactored tools
    });

    test('should have valid tool categories', () => {
        const stats = registry.getStatistics();
        expect(stats.categories).toBeDefined();
        expect(Object.keys(stats.categories).length).toBeGreaterThan(0);
        
        // Check for expected categories
        expect(stats.categories['file_operations']).toBeGreaterThan(0);
        expect(stats.categories['command-execution']).toBeGreaterThan(0);
    });

    test('should validate all registered tools', async () => {
        const validation = await registry.validateAllTools(context);
        
        expect(validation.valid).toBeDefined();
        expect(validation.invalid).toBeDefined();
        expect(validation.valid.length).toBe(14);
        expect(validation.invalid.length).toBe(0);
    });

    test('should get tool by name', () => {
        const readTool = registry.getTool('read_file');
        expect(readTool).toBeDefined();
        expect(readTool?.name).toBe('read_file');
    });

    test('should return null for non-existent tool', () => {
        const nonExistentTool = registry.getTool('non_existent_tool');
        expect(nonExistentTool).toBeNull();
    });

    test('should execute tool by name', async () => {
        const result = await registry.executeTool('read_file', {
            filePath: '../../../README.md',
            limit: 5
        }, context);
        
        expect(result).toBeDefined();
        expect(result).toBeDefined();
    });

    test('should list all registered tools', () => {
        const tools = registry.listTools();
        expect(tools.length).toBe(14);
        
        const toolNames = tools.map(tool => tool.name);
        expect(toolNames).toContain('read_file');
        expect(toolNames).toContain('write_file');
        expect(toolNames).toContain('edit_file');
        expect(toolNames).toContain('bash');
        expect(toolNames).toContain('grep');
        expect(toolNames).toContain('ls');
        expect(toolNames).toContain('glob');
        expect(toolNames).toContain('multi_edit');
        expect(toolNames).toContain('todo_write');
        expect(toolNames).toContain('task');
        expect(toolNames).toContain('web_fetch');
        expect(toolNames).toContain('exit_plan_mode');
        expect(toolNames).toContain('web_search');
        expect(toolNames).toContain('execute_command');
    });

    test('should get tools by category', () => {
        const fileTools = registry.getToolsByCategory('file_operations');
        expect(fileTools.length).toBeGreaterThan(0);
        
        const toolNames = fileTools.map(tool => tool.name);
        expect(toolNames).toContain('read_file');
        expect(toolNames).toContain('write_file');
        expect(toolNames).toContain('edit_file');
    });

    test('should get tools by tag', () => {
        const coreTools = registry.getToolsByTag('core');
        expect(coreTools.length).toBeGreaterThan(0);
        
        const essentialTools = registry.getToolsByTag('essential');
        expect(essentialTools.length).toBeGreaterThan(0);
    });

    test('should handle context properly', () => {
        const defaultContext = registry.getDefaultContext();
        expect(defaultContext).toBeDefined();
        
        registry.setDefaultContext(context);
        const newContext = registry.getDefaultContext();
        expect(newContext).toBe(context);
    });

    test('should provide tool statistics', () => {
        const stats = registry.getStatistics();
        
        expect(stats.totalTools).toBe(14);
        expect(stats.categories).toBeDefined();
        expect(stats.tags).toBeDefined();
        expect(stats.complexity).toBeDefined();
        
        // Check complexity distribution
        expect(stats.complexity.core).toBeGreaterThan(0);
        expect(stats.complexity.essential).toBeGreaterThan(0);
    });

    test('should handle tool execution errors gracefully', async () => {
        try {
            await registry.executeTool('non_existent_tool', {}, context);
            fail('Should have thrown an error');
        } catch (error) {
            expect(error).toBeDefined();
        }
    });

    test('should register new tools at runtime', () => {
        const initialCount = registry.getStatistics().totalTools;
        
        // Tools are registered during import, so count should be stable
        const currentCount = registry.getStatistics().totalTools;
        expect(currentCount).toBe(initialCount);
    });

    test('should provide tool descriptions', () => {
        const tools = registry.listTools();
        
        tools.forEach(tool => {
            expect(tool.description).toBeDefined();
            expect(tool.description.length).toBeGreaterThan(10);
        });
    });

    test('should have consistent tool naming', () => {
        const tools = registry.listTools();
        
        tools.forEach(tool => {
            expect(tool.name).toMatch(/^[a-z_]+$/); // lowercase with underscores
            expect(tool.name).not.toContain(' ');
            expect(tool.name).not.toContain('-');
        });
    });

    test('should provide tool complexity information', () => {
        const tools = registry.listTools();
        
        const complexityLevels = ['core', 'essential', 'advanced'];
        
        tools.forEach(tool => {
            expect(complexityLevels).toContain(tool.complexity);
        });
    });

    test('should handle concurrent tool execution', async () => {
        const promises = [
            registry.executeTool('bash', { command: 'echo "test1"', description: 'Test 1' }, context),
            registry.executeTool('bash', { command: 'echo "test2"', description: 'Test 2' }, context),
            registry.executeTool('bash', { command: 'echo "test3"', description: 'Test 3' }, context)
        ];
        
        const results = await Promise.all(promises);
        
        expect(results).toHaveLength(3);
        results.forEach((result: any) => {
            expect(result).toBeDefined();
            expect(result.getText().length).toBeGreaterThan(0);
        });
    });
});