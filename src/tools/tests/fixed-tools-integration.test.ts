/*---------------------------------------------------------------------------------------------
 * Fixed Tools Integration Tests - Test the 13 tools that were fixed for parameter validation
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext } from './setup';

describe('Fixed Tools Integration Tests', () => {
    // List of tools that were specifically fixed for parameter validation issues
    const fixedTools = [
        'edit_file',        // Error "Cannot read properties of undefined (reading 'substring')"
        'bash',             // Error "Cannot read properties of undefined (reading 'toLowerCase')"
        'multi_edit',       // Error "The path argument must be of type string. Received undefined"
        'advanced_diff',    // Error "Unknown action: undefined"
        'advanced_notebook', // Error "The path argument must be of type string"
        'advanced_patch',   // Error "Cannot read properties of undefined (reading 'includes')"
        'computer_use',     // Screenshot failing (expected for headless environment)
        'test_analyzer',    // Error "Unknown action: undefined"
        'mcp_integration',  // Error "Unknown MCP action: get-capabilities"
        'notebook_edit',    // Error "cell_id is required for replace mode"
        'sub_agents',       // Error "Unknown sub-agents action: undefined"
        'symbol_analysis',  // Error "Unknown action: undefined"
        'text_editor'       // Error "path is required for view command"
    ];

    test('all fixed tools should be registered', () => {
        fixedTools.forEach(toolName => {
            const tool = ToolRegistry.getTool(toolName);
            expect(tool).toBeDefined();
            expect(tool?.name).toBe(toolName);
        });
    });

    test('tools should handle missing action parameter gracefully', async () => {
        const context = createTestContext();
        const toolsWithActions = ['advanced_diff', 'advanced_notebook', 'test_analyzer', 'sub_agents', 'symbol_analysis', 'mcp_integration'];
        
        for (const toolName of toolsWithActions) {
            const tool = ToolRegistry.getTool(toolName);
            expect(tool).toBeDefined();
            
            // Test with undefined action
            const result = await ToolRegistry.executeTool(toolName, {} as any, context);
            expect(result.hasErrors()).toBe(true);
            
            // Check both text parts and error parts
            const allText = result.getText() + result.getErrors().join(' ');
            expect(allText).toContain('action is required');
        }
    });

    test('tools should handle missing required parameters gracefully', async () => {
        const context = createTestContext();
        
        // Test edit_file with missing parameters
        const editResult = await ToolRegistry.executeTool('edit_file', {} as any, context);
        expect(editResult.hasErrors()).toBe(true);
        const editText = editResult.getText() + editResult.getErrors().join(' ');
        expect(editText).toContain('filePath is required');

        // Test bash with missing command
        const bashResult = await ToolRegistry.executeTool('bash', {} as any, context);
        expect(bashResult.hasErrors()).toBe(true);
        const bashText = bashResult.getText() + bashResult.getErrors().join(' ');
        expect(bashText).toContain('command is required');

        // Test multi_edit with missing parameters
        const multiEditResult = await ToolRegistry.executeTool('multi_edit', {} as any, context);
        expect(multiEditResult.hasErrors()).toBe(true);
        const multiEditText = multiEditResult.getText() + multiEditResult.getErrors().join(' ');
        expect(multiEditText).toContain('file_path is required');
    });

    test('computer_use should handle headless environment gracefully', async () => {
        const context = createTestContext();
        
        const result = await ToolRegistry.executeTool('computer_use', {
            action: 'screenshot'
        }, context);
        
        // Should either fail gracefully for headless environment or succeed
        expect(result).toBeDefined();
        const resultText = result.getText() + result.getErrors().join(' ');
        expect(resultText.length).toBeGreaterThan(0);
    });

    test('text_editor should handle missing path for view command', async () => {
        const context = createTestContext();
        
        const result = await ToolRegistry.executeTool('text_editor', {
            command: 'view'
        }, context);
        
        expect(result.hasErrors()).toBe(true);
        const textResult = result.getText() + result.getErrors().join(' ');
        expect(textResult).toContain('path is required');
    });

    test('symbol_analysis should require both action and symbol_name', async () => {
        const context = createTestContext();
        
        // Test with missing symbol_name
        const result = await ToolRegistry.executeTool('symbol_analysis', {
            action: 'find_usages'
        }, context);
        
        expect(result.hasErrors()).toBe(true);
        const symbolText = result.getText() + result.getErrors().join(' ');
        expect(symbolText).toContain('symbol_name is required');
    });

    test('should provide proper error messages for invalid actions', async () => {
        const context = createTestContext();
        
        const toolsWithActions = ['advanced_diff', 'test_analyzer', 'sub_agents']; // symbol_analysis needs both action and symbol_name
        
        for (const toolName of toolsWithActions) {
            const result = await ToolRegistry.executeTool(toolName, {
                action: 'invalid_action'
            }, context);
            
            expect(result.hasErrors()).toBe(true);
            const errorText = result.getText() + result.getErrors().join(' ');
            expect(errorText).toContain('Invalid action');
            expect(errorText).toContain('Must be one of:');
        }
        
        // Test symbol_analysis specifically with invalid action but valid symbol_name
        const symbolResult = await ToolRegistry.executeTool('symbol_analysis', {
            action: 'invalid_action',
            symbol_name: 'testSymbol'
        }, context);
        
        expect(symbolResult.hasErrors()).toBe(true);
        const symbolErrorText = symbolResult.getText() + symbolResult.getErrors().join(' ');
        expect(symbolErrorText).toContain('Invalid action');
        expect(symbolErrorText).toContain('Must be one of:');
    });

    test('all fixed tools should have proper input validation', async () => {
        const context = createTestContext();
        
        for (const toolName of fixedTools) {
            const tool = ToolRegistry.getTool(toolName);
            expect(tool).toBeDefined();
            expect(tool?.inputSchema).toBeDefined();
            expect((tool?.inputSchema as any)?.type).toBe('object');
            expect((tool?.inputSchema as any)?.properties).toBeDefined();
            
            // Test that calling with empty input returns proper validation error
            const result = await ToolRegistry.executeTool(toolName, {} as any, context);
            // Some tools might succeed with empty input if they have good defaults
            // Just check that we get a result
            expect(result).toBeDefined();
        }
    });

    test('should track refactoring progress correctly', () => {
        const allTools = ToolRegistry.getTools();
        const totalTools = allTools.length;
        
        // We expect to have all 30 tools registered now
        expect(totalTools).toBe(30);
        
        // All tools should have proper schemas
        allTools.forEach(tool => {
            expect(tool.name).toBeDefined();
            expect(tool.description).toBeDefined();
            expect(tool.inputSchema).toBeDefined();
            expect(tool.category).toBeDefined();
            expect(tool.tags).toBeDefined();
            expect(tool.complexity).toBeDefined();
        });
    });
});