/*---------------------------------------------------------------------------------------------
 * Todo Write Tool - Create and manage structured task lists
 * REFACTORED: Removed VSCode dependencies
 *--------------------------------------------------------------------------------------------*/

import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult
} from '../types/cliTypes';

interface ITodoItem {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
}

interface ITodoWriteParams {
    todos: ITodoItem[];
}

export class TodoWriteTool extends BaseTool<ITodoWriteParams> {
    readonly name = 'todo_write';
    readonly description = `Manage task lists to track work progress.

Use when: Organizing complex projects, tracking task completion, or planning multi-step workflows.

Features: Status tracking, completion rates, task organization, progress visualization.

Examples: Create project milestones, track feature development, organize refactoring tasks.`;

    readonly tags = ['planning', 'organization', 'essential'];
    readonly category = 'planning';
    readonly complexity: 'essential' = 'essential';
    readonly inputSchema = {
        type: 'object',
        properties: {
            todos: {
                type: 'array',
                description: 'Array of todo items with content and status',
                items: {
                    type: 'object',
                    properties: {
                        content: {
                            type: 'string',
                            description: 'The task description',
                            minLength: 1
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'in_progress', 'completed'],
                            description: 'Current status of the task'
                        }
                    },
                    required: ['content', 'status']
                },
                minItems: 1
            }
        },
        required: ['todos']
    };

    async invoke(
        options: CliToolInvocationOptions<ITodoWriteParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { todos } = options.input;

        try {
            const summary = this.generateTodoSummary(todos);
            
            return this.createSuccessResult({
                totalTodos: todos.length,
                pending: todos.filter(t => t.status === 'pending').length,
                inProgress: todos.filter(t => t.status === 'in_progress').length,
                completed: todos.filter(t => t.status === 'completed').length
            }, summary);

        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error managing todos');
        }
    }

    private generateTodoSummary(todos: ITodoItem[]): string {
        const pending = todos.filter(t => t.status === 'pending');
        const inProgress = todos.filter(t => t.status === 'in_progress');
        const completed = todos.filter(t => t.status === 'completed');

        const lines = ['📋 Task List Summary'];
        lines.push(`Total tasks: ${todos.length}`);
        lines.push(`✅ Completed: ${completed.length}`);
        lines.push(`🔄 In Progress: ${inProgress.length}`);
        lines.push(`⏳ Pending: ${pending.length}`);

        // Progress bar
        const completionRate = todos.length > 0 ? (completed.length / todos.length) * 100 : 0;
        const progressBar = this.generateProgressBar(completionRate);
        lines.push(`Progress: ${progressBar} ${completionRate.toFixed(1)}%`);
        lines.push('');

        // List tasks by status
        if (inProgress.length > 0) {
            lines.push('🔄 Currently Working On:');
            inProgress.forEach((todo, index) => {
                lines.push(`  ${index + 1}. ${todo.content}`);
            });
            lines.push('');
        }

        if (pending.length > 0) {
            lines.push('⏳ Pending Tasks:');
            pending.forEach((todo, index) => {
                lines.push(`  ${index + 1}. ${todo.content}`);
            });
            lines.push('');
        }

        if (completed.length > 0) {
            lines.push('✅ Completed Tasks:');
            completed.forEach((todo, index) => {
                lines.push(`  ${index + 1}. ${todo.content}`);
            });
        }

        return lines.join('\n');
    }

    private generateProgressBar(percentage: number): string {
        const width = 20;
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
}

// Auto-register the tool
ToolRegistry.getInstance().registerTool(TodoWriteTool);