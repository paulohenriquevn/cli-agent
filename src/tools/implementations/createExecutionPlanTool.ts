/*---------------------------------------------------------------------------------------------
 * Create Execution Plan Tool - Equivalent to Claude Code's TodoWrite
 * Strategic planning and task management for AI agents
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';

export interface Task {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    priority: 'high' | 'medium' | 'low';
    id: string;
}

export interface ExecutionPlan {
    tasks: Task[];
    currentTaskId?: string;
    projectContext: string;
}

interface ICreateExecutionPlanParams {
    tasks: Task[];
    projectContext: string;
    [key: string]: unknown;
}

export class CreateExecutionPlanTool extends BaseTool<ICreateExecutionPlanParams> {
    readonly name = 'create_execution_plan';
    readonly description = `Create strategic execution plans - Break down complex development tasks into manageable, prioritized steps with progress tracking.

Use when: Planning large features, coordinating multi-stage implementations, tracking development progress, organizing release workflows, or managing complex refactoring projects.

Features: Task prioritization system, visual status indicators, progress monitoring, current task tracking, and execution state management with formatted output.

Examples: Breaking down "implement user authentication" into login/register/validation steps, planning database migration with rollback points, organizing feature release with testing phases.`;

    // Tag system implementation
    readonly tags = ['planning', 'task-management', 'workflow', 'organization', 'tracking'];
    readonly category = 'project-management';
    readonly complexity: 'core' | 'advanced' | 'essential' = 'essential';

    private currentPlan: ExecutionPlan | null = null;

    readonly inputSchema = {
        type: 'object',
        properties: {
            tasks: {
                type: 'array',
                description: 'Array of tasks to execute',
                items: {
                    type: 'object',
                    properties: {
                        content: {
                            type: 'string',
                            description: 'Task description - specific and actionable'
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'in_progress', 'completed'],
                            description: 'Current task status'
                        },
                        priority: {
                            type: 'string',
                            enum: ['high', 'medium', 'low'],
                            description: 'Task priority level'
                        },
                        id: {
                            type: 'string',
                            description: 'Unique task identifier'
                        }
                    },
                    required: ['content', 'status', 'priority', 'id']
                }
            },
            projectContext: {
                type: 'string',
                description: 'Brief context about what this plan is for'
            }
        },
        required: ['tasks', 'projectContext']
    };

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ICreateExecutionPlanParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { tasks, projectContext } = options.input;

        try {
            // Validate tasks structure
            if (!Array.isArray(tasks)) {
                return this.createErrorResult('Tasks must be an array');
            }

            for (const task of tasks) {
                if (!task.content || !task.status || !task.priority || !task.id) {
                    return this.createErrorResult('Each task must have content, status, priority, and id');
                }
            }

            // Create execution plan
            this.currentPlan = {
                tasks: tasks.map((task: Task) => ({
                    content: task.content,
                    status: task.status,
                    priority: task.priority,
                    id: task.id
                })),
                projectContext,
                currentTaskId: tasks.find((t: Task) => t.status === 'in_progress')?.id
            };

            console.log('[CreateExecutionPlan] Plan created:', this.currentPlan);

            // Format response like Claude Code TodoWrite
            const formattedTasks = tasks.map((task: Task, index: number) => {
                const statusIcon = task.status === 'completed' ? '✅' :
                    task.status === 'in_progress' ? '🔄' : '⏳';
                const priorityIcon = task.priority === 'high' ? '🔥' :
                    task.priority === 'medium' ? '🟡' : '🔵';

                return `${index + 1}. ${statusIcon} ${priorityIcon} ${task.content}`;
            }).join('\n');

            const response = `📋 **Execution Plan Created**\n\n**Context:** ${projectContext}\n\n**Tasks:**\n${formattedTasks}\n\n✨ Plan ready for execution. Use updateExecutionPlan to mark progress.`;

            return this.createSuccessResult(null, response);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.createErrorResult(`Failed to create execution plan: ${errorMessage}`);
        }
    }

    // Helper method to update plan progress
    async updateTaskStatus(taskId: string, status: Task['status']): Promise<string> {
        if (!this.currentPlan) {
            throw new Error('No execution plan exists. Create one first.');
        }

        const task = this.currentPlan.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task with id "${taskId}" not found`);
        }

        const oldStatus = task.status;
        task.status = status;

        // Update current task if needed
        if (status === 'in_progress') {
            this.currentPlan.currentTaskId = taskId;
        } else if (this.currentPlan.currentTaskId === taskId) {
            this.currentPlan.currentTaskId = undefined;
        }

        console.log(`[CreateExecutionPlan] Task ${taskId} updated: ${oldStatus} → ${status}`);

        return `✅ Task updated: "${task.content}" → ${status}`;
    }

    // Get current plan status
    getCurrentPlan(): ExecutionPlan | null {
        return this.currentPlan;
    }

    // Get next pending task
    getNextTask(): Task | null {
        if (!this.currentPlan) {return null;}

        return this.currentPlan.tasks.find(t => t.status === 'pending') || null;
    }

    // Get current active task
    getCurrentTask(): Task | null {
        if (!this.currentPlan || !this.currentPlan.currentTaskId) {return null;}

        return this.currentPlan.tasks.find(t => t.id === this.currentPlan!.currentTaskId) || null;
    }

    // Get completion percentage
    getProgress(): number {
        if (!this.currentPlan || this.currentPlan.tasks.length === 0) {return 0;}

        const completedTasks = this.currentPlan.tasks.filter(t => t.status === 'completed').length;
        return Math.round((completedTasks / this.currentPlan.tasks.length) * 100);
    }
}

// Register the tool
ToolRegistry.registerTool(CreateExecutionPlanTool);