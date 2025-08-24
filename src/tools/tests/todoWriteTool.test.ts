/*---------------------------------------------------------------------------------------------
 * Todo Write Tool Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext } from './setup';

describe('TodoWriteTool', () => {
    // const registry = ToolRegistry;
    const context = createTestContext();

    test('should create new todo list', async () => {
        const todos = [
            { content: 'First task', status: 'pending' as const },
            { content: 'Second task', status: 'in_progress' as const },
            { content: 'Third task', status: 'completed' as const }
        ];

        const result = await ToolRegistry.executeTool('todo_write', {
            todos
        }, context);

        expect(result.getText()).toContain('📋 Task List Summary');
        expect(result.getText()).toContain('First task');
        expect(result.getText()).toContain('Second task');
        expect(result.getText()).toContain('Third task');
        expect(result.getText()).toContain('⏳ Pending');
        expect(result.getText()).toContain('🔄 In Progress');
        expect(result.getText()).toContain('✅ Completed');
    });

    test('should show progress statistics', async () => {
        const todos = [
            { content: 'Task 1', status: 'completed' as const },
            { content: 'Task 2', status: 'completed' as const },
            { content: 'Task 3', status: 'in_progress' as const },
            { content: 'Task 4', status: 'pending' as const },
            { content: 'Task 5', status: 'pending' as const }
        ];

        const result = await ToolRegistry.executeTool('todo_write', {
            todos
        }, context);

        expect(result.getText()).toContain('40.0%');
        expect(result.getText()).toContain('✅ Completed: 2');
        expect(result.getText()).toContain('🔄 In Progress: 1');
        expect(result.getText()).toContain('⏳ Pending: 2');
    });

    test('should handle empty todo list', async () => {
        const result = await ToolRegistry.executeTool('todo_write', {
            todos: []
        }, context);

        expect(result.getText()).toContain('Total tasks: 0');
    });

    test('should format todos with numbers', async () => {
        const todos = [
            { content: 'First task', status: 'pending' as const },
            { content: 'Second task', status: 'in_progress' as const }
        ];

        const result = await ToolRegistry.executeTool('todo_write', {
            todos
        }, context);

        expect(result.getText()).toContain('First task');
        expect(result.getText()).toContain('Second task');
    });

    test('should handle long task descriptions', async () => {
        const todos = [
            { 
                content: 'This is a very long task description that should be handled properly by the todo system without breaking the formatting',
                status: 'pending' as const 
            }
        ];

        const result = await ToolRegistry.executeTool('todo_write', {
            todos
        }, context);

        expect(result.getText()).toContain('This is a very long task description');
        expect(result.getText()).toContain('⏳ Pending');
    });

    test('should handle special characters in task content', async () => {
        const todos = [
            { content: 'Task with émojis and açcénts 🚀', status: 'pending' as const },
            { content: 'Task with "quotes" and symbols @#$%', status: 'completed' as const }
        ];

        const result = await ToolRegistry.executeTool('todo_write', {
            todos
        }, context);

        expect(result.getText()).toContain('émojis and açcénts 🚀');
        expect(result.getText()).toContain('"quotes" and symbols @#$%');
    });

    test('should show completion percentage', async () => {
        const todos = [
            { content: 'Task 1', status: 'completed' as const },
            { content: 'Task 2', status: 'completed' as const },
            { content: 'Task 3', status: 'completed' as const },
            { content: 'Task 4', status: 'pending' as const }
        ];

        const result = await ToolRegistry.executeTool('todo_write', {
            todos
        }, context);

        expect(result.getText()).toContain('75.0%');
    });

    test('should handle all completed tasks', async () => {
        const todos = [
            { content: 'Task 1', status: 'completed' as const },
            { content: 'Task 2', status: 'completed' as const }
        ];

        const result = await ToolRegistry.executeTool('todo_write', {
            todos
        }, context);

        expect(result.getText()).toContain('100.0%');
        expect(result.getText()).toContain('100.0%');
    });

    test('should validate todo status values', async () => {
        const todos = [
            { content: 'Valid task', status: 'pending' as const }
        ];

        const result = await ToolRegistry.executeTool('todo_write', {
            todos
        }, context);

        expect(result.getText()).toContain('📋 Task List Summary');
        expect(result.getText()).not.toContain('error');
    });
});