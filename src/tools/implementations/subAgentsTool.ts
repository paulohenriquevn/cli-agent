/*---------------------------------------------------------------------------------------------
 * Sub Agents Tool - Interface for working with specialized sub-agents
 * Replicates Claude Code's sub agents functionality
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { SubAgentsSystem, ISubAgentRequest, SubAgentType } from '../../systems/subAgentsSystem';

interface ISubAgentsParams {
    action: 'list' | 'invoke' | 'find' | 'enable' | 'disable' | 'get_info';
    agent_type?: SubAgentType;
    task?: string;
    context?: any;
    options?: {
        maxTokens?: number;
        temperature?: number;
        tools?: string[];
    };
    [key: string]: unknown;
}

export class SubAgentsTool extends BaseTool<ISubAgentsParams> {
    readonly name = 'sub_agents';
    readonly description = `Manage specialized AI agents - Access domain-specific AI assistants for code review, debugging, testing, and specialized development tasks.

Use when: Requiring specialized expertise beyond general assistance, performing security analysis, optimizing performance, conducting comprehensive code reviews, or executing complex domain-specific tasks.

Features: Multiple specialized agents (code_reviewer, debugger, test_writer, security_analyzer, etc.), agent discovery system, context-aware invocation, and detailed execution metadata reporting.

Examples: Running security analysis on authentication code, getting performance optimization recommendations, conducting thorough code reviews with best practices, or generating comprehensive test suites.`;

    // Tag system implementation
    readonly tags = ['ai_agents', 'specialization', 'code_review', 'debugging', 'testing', 'security', 'performance'];
    readonly category = 'ai_assistance';
    readonly complexity: 'core' | 'advanced' | 'essential' = 'advanced';

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['list', 'invoke', 'find', 'enable', 'disable', 'get_info'],
                description: 'The sub-agents action to perform'
            },
            agent_type: {
                type: 'string',
                enum: ['code_reviewer', 'debugger', 'test_writer', 'documentation_writer', 'refactoring_specialist', 'security_analyzer', 'performance_optimizer', 'api_designer', 'database_specialist', 'frontend_specialist', 'backend_specialist'],
                description: 'Type of sub-agent (required for invoke, enable, disable, get_info)'
            },
            task: {
                type: 'string',
                description: 'The task to perform (required for invoke and find actions)'
            },
            context: {
                type: 'object',
                description: 'Additional context for the task (optional for invoke action)'
            },
            options: {
                type: 'object',
                description: 'Execution options (optional for invoke action)',
                properties: {
                    maxTokens: { type: 'number' },
                    temperature: { type: 'number' },
                    tools: { type: 'array', items: { type: 'string' } }
                }
            }
        },
        required: ['action']
    };

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ISubAgentsParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const params = options.input;

        try {
            const subAgentsSystem = SubAgentsSystem.getInstance();

            switch (params.action) {
                case 'list':
                    return await this.handleList(subAgentsSystem);
                case 'invoke':
                    return await this.handleInvoke(subAgentsSystem, params);
                case 'find':
                    return await this.handleFind(subAgentsSystem, params);
                case 'enable':
                    return await this.handleEnable(subAgentsSystem, params);
                case 'disable':
                    return await this.handleDisable(subAgentsSystem, params);
                case 'get_info':
                    return await this.handleGetInfo(subAgentsSystem, params);
                default:
                    return this.createErrorResult(`Unknown sub-agents action: ${params.action}`);
            }
        } catch (error: any) {
            return this.createErrorResult(`Sub-agents operation failed: ${error.message}`);
        }
    }

    private async handleList(subAgentsSystem: SubAgentsSystem): Promise<vscode.LanguageModelToolResult> {
        const agents = subAgentsSystem.listAgents();

        if (agents.length === 0) {
            return this.createSuccessResult(null, [
                `**🤖 Sub Agents**`,
                '',
                'No sub-agents available.',
                '',
                'Sub-agents are specialized assistants for specific development tasks.'
            ].join('\n'));
        }

        const lines = [
            `**🤖 Sub Agents (${agents.length})**`,
            ''
        ];

        agents.forEach(agent => {
            const statusIcon = agent.enabled ? '🟢' : '🔴';
            lines.push(`${statusIcon} **${agent.name}** (\`${agent.type}\`)`);
            lines.push(`   - Description: ${agent.description}`);
            lines.push(`   - Capabilities: ${agent.capabilities.length}`);
            lines.push(`   - Tools: ${agent.tools.join(', ')}`);
            lines.push(`   - Status: ${agent.enabled ? 'Enabled' : 'Disabled'}`);
            lines.push('');
        });

        lines.push('**Usage:**');
        lines.push('- Use `invoke` to run a specific agent');
        lines.push('- Use `find` to find the best agent for a task');

        return this.createSuccessResult(null, lines.join('\n'));
    }

    private async handleInvoke(subAgentsSystem: SubAgentsSystem, params: ISubAgentsParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.agent_type || !params.task) {
            return this.createErrorResult('agent_type and task are required for invoke action');
        }

        const request: ISubAgentRequest = {
            agentType: params.agent_type,
            task: params.task,
            context: params.context,
            options: params.options
        };

        try {
            const response = await subAgentsSystem.invokeAgent(request);

            if (!response.success) {
                return this.createErrorResult(`Agent execution failed: ${response.error}`);
            }

            const lines = [
                `**🤖 Sub Agent Execution Complete**`,
                `**Agent:** ${params.agent_type}`,
                `**Task:** ${params.task}`,
                `**Execution Time:** ${response.executionTime}ms`,
                `**Tools Used:** ${response.toolsUsed.join(', ') || 'None'}`,
                ''
            ];

            if (response.metadata) {
                lines.push(`**Metadata:**`);
                Object.entries(response.metadata).forEach(([key, value]) => {
                    lines.push(`- ${key}: ${value}`);
                });
                lines.push('');
            }

            lines.push('**Result:**');
            lines.push('```json');
            lines.push(JSON.stringify(response.result, null, 2));
            lines.push('```');

            return this.createSuccessResult(null, lines.join('\n'));

        } catch (error: any) {
            return this.createErrorResult(`Agent invocation failed: ${error.message}`);
        }
    }

    private async handleFind(subAgentsSystem: SubAgentsSystem, params: ISubAgentsParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.task) {
            return this.createErrorResult('task is required for find action');
        }

        const recommendedAgentType = subAgentsSystem.findAgentForTask(params.task);

        if (!recommendedAgentType) {
            return this.createSuccessResult(null, [
                `**🤖 Agent Recommendation**`,
                `**Task:** ${params.task}`,
                '',
                'No specific agent recommended for this task.',
                'Consider using a general-purpose agent or breaking down the task.'
            ].join('\n'));
        }

        const agent = subAgentsSystem.getAgent(recommendedAgentType);

        if (!agent) {
            return this.createErrorResult(`Recommended agent not found: ${recommendedAgentType}`);
        }

        const lines = [
            `**🤖 Agent Recommendation**`,
            `**Task:** ${params.task}`,
            `**Recommended Agent:** ${agent.name} (\`${agent.type}\`)`,
            `**Description:** ${agent.description}`,
            `**Status:** ${agent.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
            ''
        ];

        if (agent.capabilities.length > 0) {
            lines.push('**Capabilities:**');
            agent.capabilities.forEach(capability => {
                lines.push(`- **${capability.name}:** ${capability.description}`);
            });
            lines.push('');
        }

        lines.push('**Available Tools:**');
        lines.push(agent.tools.map(tool => `\`${tool}\``).join(', '));

        if (agent.enabled) {
            lines.push('');
            lines.push('✅ Ready to invoke this agent with your task!');
        } else {
            lines.push('');
            lines.push('⚠️ Agent is disabled. Enable it first to use.');
        }

        return this.createSuccessResult(null, lines.join('\n'));
    }

    private async handleEnable(subAgentsSystem: SubAgentsSystem, params: ISubAgentsParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.agent_type) {
            return this.createErrorResult('agent_type is required for enable action');
        }

        const success = subAgentsSystem.enableAgent(params.agent_type);

        if (!success) {
            return this.createErrorResult(`Agent not found: ${params.agent_type}`);
        }

        return this.createSuccessResult(null, [
            `**🤖 Agent Enabled**`,
            `**Type:** ${params.agent_type}`,
            '',
            '✅ Agent is now enabled and ready to use'
        ].join('\n'));
    }

    private async handleDisable(subAgentsSystem: SubAgentsSystem, params: ISubAgentsParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.agent_type) {
            return this.createErrorResult('agent_type is required for disable action');
        }

        const success = subAgentsSystem.disableAgent(params.agent_type);

        if (!success) {
            return this.createErrorResult(`Agent not found: ${params.agent_type}`);
        }

        return this.createSuccessResult(null, [
            `**🤖 Agent Disabled**`,
            `**Type:** ${params.agent_type}`,
            '',
            '✅ Agent has been disabled'
        ].join('\n'));
    }

    private async handleGetInfo(subAgentsSystem: SubAgentsSystem, params: ISubAgentsParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.agent_type) {
            return this.createErrorResult('agent_type is required for get_info action');
        }

        const agent = subAgentsSystem.getAgent(params.agent_type);

        if (!agent) {
            return this.createErrorResult(`Agent not found: ${params.agent_type}`);
        }

        const lines = [
            `**🤖 Agent Information**`,
            `**Name:** ${agent.name}`,
            `**Type:** ${agent.type}`,
            `**Description:** ${agent.description}`,
            `**Status:** ${agent.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
            ''
        ];

        if (agent.systemPrompt) {
            lines.push('**System Prompt:**');
            lines.push(`\`\`\`\n${agent.systemPrompt}\n\`\`\``);
            lines.push('');
        }

        if (agent.capabilities.length > 0) {
            lines.push('**Capabilities:**');
            agent.capabilities.forEach((capability, index) => {
                lines.push(`**${index + 1}. ${capability.name}**`);
                lines.push(`   - Description: ${capability.description}`);
                lines.push(`   - Input Schema: \`${JSON.stringify(capability.inputSchema)}\``);
                lines.push(`   - Output Schema: \`${JSON.stringify(capability.outputSchema)}\``);
                lines.push('');
            });
        }

        lines.push('**Available Tools:**');
        lines.push(agent.tools.map(tool => `\`${tool}\``).join(', '));

        if (agent.maxTokens || agent.temperature !== undefined) {
            lines.push('');
            lines.push('**Configuration:**');
            if (agent.maxTokens) {
                lines.push(`- Max Tokens: ${agent.maxTokens}`);
            }
            if (agent.temperature !== undefined) {
                lines.push(`- Temperature: ${agent.temperature}`);
            }
        }

        return this.createSuccessResult(null, lines.join('\n'));
    }

    // Static helper methods for common agent operations
    public static async reviewCode(code: string, context?: any): Promise<any> {
        const request: ISubAgentRequest = {
            agentType: 'code_reviewer',
            task: 'Review this code for quality, style, and best practices',
            context: { code, ...context }
        };

        const response = await SubAgentsSystem.invoke(request);
        return response.success ? response.result : null;
    }

    public static async debugIssue(error: string, code?: string): Promise<any> {
        const request: ISubAgentRequest = {
            agentType: 'debugger',
            task: 'Help debug this issue and provide solutions',
            context: { error, code }
        };

        const response = await SubAgentsSystem.invoke(request);
        return response.success ? response.result : null;
    }

    public static async writeTests(code: string, testType: string = 'unit'): Promise<any> {
        const request: ISubAgentRequest = {
            agentType: 'test_writer',
            task: `Write ${testType} tests for this code`,
            context: { code, testType }
        };

        const response = await SubAgentsSystem.invoke(request);
        return response.success ? response.result : null;
    }

    public static async analyzePerformance(code: string): Promise<any> {
        const request: ISubAgentRequest = {
            agentType: 'performance_optimizer',
            task: 'Analyze this code for performance bottlenecks and optimization opportunities',
            context: { code }
        };

        const response = await SubAgentsSystem.invoke(request);
        return response.success ? response.result : null;
    }

    public static async scanSecurity(code: string): Promise<any> {
        const request: ISubAgentRequest = {
            agentType: 'security_analyzer',
            task: 'Scan this code for security vulnerabilities',
            context: { code }
        };

        const response = await SubAgentsSystem.invoke(request);
        return response.success ? response.result : null;
    }
}

// Register the tool
ToolRegistry.registerTool(SubAgentsTool);