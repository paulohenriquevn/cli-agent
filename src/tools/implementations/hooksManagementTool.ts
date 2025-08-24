/*---------------------------------------------------------------------------------------------
 * Hooks Management Tool - Manage and configure the hooks system
 * Replicates Claude Code's hooks management functionality
 *--------------------------------------------------------------------------------------------*/

import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { HooksSystem, IHookHandler, HookType, IHookContext, IHookResult } from '../../systems/hooksSystem';
import {
    CliCancellationToken,
    CliToolResult,
    CliToolInvocationOptions
} from '../types/cliTypes';

interface IHooksManagementParams {
    action: 'list' | 'register' | 'unregister' | 'enable' | 'disable' | 'clear' | 'execute';
    hook_type?: HookType;
    hook_id?: string;
    hook_config?: IHookConfig;
    test_context?: Partial<IHookContext>;
    [key: string]: unknown;
}

interface IHookConfig {
    id: string;
    name: string;
    description: string;
    hookType: HookType;
    priority: number;
    enabled: boolean;
    handlerCode: string; // JavaScript code for the handler function
}

export class HooksManagementTool extends BaseTool<IHooksManagementParams> {
    readonly name = 'hooks_management';
    readonly description = `Manage hooks system - Configure custom JavaScript handlers for tool lifecycle events and behavioral customization.

Use when: Customizing AI assistant behavior, adding logging/monitoring, implementing validation rules, integrating with external systems, or automating workflows during tool execution.

Features: JavaScript code injection for custom handlers, priority-based execution order, enable/disable controls, event-based triggering (pre/post tool execution, errors, workspace changes).

Examples: Adding performance monitoring hooks, implementing custom validation for file operations, logging all tool executions to external systems, or creating workflow automation triggers.`;

    // Tag system implementation
    readonly tags = ['hooks', 'customization', 'javascript', 'lifecycle', 'automation', 'monitoring'];
    readonly category = 'system-customization';
    readonly complexity: 'core' | 'advanced' | 'essential' = 'advanced';

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['list', 'register', 'unregister', 'enable', 'disable', 'clear', 'execute'],
                description: 'The hooks management action to perform'
            },
            hook_type: {
                type: 'string',
                enum: ['pre_tool_use', 'post_tool_use', 'on_tool_error', 'pre_agent_invoke', 'post_agent_invoke', 'on_agent_error', 'user_prompt_submit', 'user_prompt_receive', 'file_changed', 'workspace_changed'],
                description: 'Type of hook (required for some actions)'
            },
            hook_id: {
                type: 'string',
                description: 'Unique identifier for the hook (required for register, unregister, enable, disable)'
            },
            hook_config: {
                type: 'object',
                description: 'Hook configuration (required for register action)',
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    hookType: { type: 'string' },
                    priority: { type: 'number' },
                    enabled: { type: 'boolean' },
                    handlerCode: { type: 'string' }
                }
            },
            test_context: {
                type: 'object',
                description: 'Test context for execute action'
            }
        },
        required: ['action']
    };

    async invoke(
        options: CliToolInvocationOptions<IHooksManagementParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const params = options.input;

        try {
            const hooksSystem = HooksSystem.getInstance();

            switch (params.action) {
                case 'list':
                    return await this.handleList(hooksSystem, params);
                case 'register':
                    return await this.handleRegister(hooksSystem, params);
                case 'unregister':
                    return await this.handleUnregister(hooksSystem, params);
                case 'enable':
                    return await this.handleEnable(hooksSystem, params);
                case 'disable':
                    return await this.handleDisable(hooksSystem, params);
                case 'clear':
                    return await this.handleClear(hooksSystem, params);
                case 'execute':
                    return await this.handleExecute(hooksSystem, params);
                default:
                    return this.createErrorResult(`Unknown hooks action: ${params.action}`);
            }
        } catch (error: any) {
            return this.createErrorResult(`Hooks management failed: ${error.message}`);
        }
    }

    private async handleList(hooksSystem: HooksSystem, params: IHooksManagementParams): Promise<CliToolResult> {
        const hooks = hooksSystem.listHooks(params.hook_type);

        if (hooks.length === 0) {
            return this.createSuccessResult(null, [
                `**🔗 Hooks${params.hook_type ? ` (${params.hook_type})` : ''}**`,
                '',
                'No hooks configured.',
                '',
                'Use the `register` action to add custom hooks.'
            ].join('\n'));
        }

        const lines = [
            `**🔗 Hooks${params.hook_type ? ` (${params.hook_type})` : ''} (${hooks.length})**`,
            ''
        ];

        // Group hooks by type if listing all
        if (!params.hook_type) {
            const hooksByType = new Map<HookType, IHookHandler[]>();
            hooks.forEach(hook => {
                if (!hooksByType.has(hook.hookType)) {
                    hooksByType.set(hook.hookType, []);
                }
                hooksByType.get(hook.hookType)!.push(hook);
            });

            hooksByType.forEach((typeHooks, hookType) => {
                lines.push(`**${hookType}:**`);
                typeHooks.forEach(hook => {
                    const statusIcon = hook.enabled ? '✅' : '❌';
                    lines.push(`  ${statusIcon} **${hook.name}** (\`${hook.id}\`)`);
                    lines.push(`     - ${hook.description}`);
                    lines.push(`     - Priority: ${hook.priority}`);
                });
                lines.push('');
            });
        } else {
            // List hooks for specific type
            hooks.forEach(hook => {
                const statusIcon = hook.enabled ? '✅' : '❌';
                lines.push(`${statusIcon} **${hook.name}** (\`${hook.id}\`)`);
                lines.push(`   - Description: ${hook.description}`);
                lines.push(`   - Priority: ${hook.priority}`);
                lines.push(`   - Type: ${hook.hookType}`);
                lines.push('');
            });
        }

        return this.createSuccessResult(null, lines.join('\n'));
    }

    private async handleRegister(hooksSystem: HooksSystem, params: IHooksManagementParams): Promise<CliToolResult> {
        if (!params.hook_config) {
            return this.createErrorResult('hook_config is required for register action');
        }

        const config = params.hook_config;

        // Validate required fields
        if (!config.id || !config.name || !config.hookType || !config.handlerCode) {
            return this.createErrorResult('hook_config must include id, name, hookType, and handlerCode');
        }

        try {
            // Create handler function from code
            const handler = this.createHandlerFromCode(config.handlerCode);

            const hookHandler: IHookHandler = {
                id: config.id,
                name: config.name,
                description: config.description || '',
                hookType: config.hookType as HookType,
                priority: config.priority || 100,
                enabled: config.enabled !== false,
                handler
            };

            hooksSystem.registerHook(hookHandler);

            return this.createSuccessResult(null, [
                `**🔗 Hook Registered**`,
                `**ID:** \`${hookHandler.id}\``,
                `**Name:** ${hookHandler.name}`,
                `**Type:** ${hookHandler.hookType}`,
                `**Priority:** ${hookHandler.priority}`,
                `**Enabled:** ${hookHandler.enabled ? 'Yes' : 'No'}`,
                '',
                '✅ Hook registered successfully'
            ].join('\n'));

        } catch (error: any) {
            return this.createErrorResult(`Failed to register hook: ${error.message}`);
        }
    }

    private async handleUnregister(hooksSystem: HooksSystem, params: IHooksManagementParams): Promise<CliToolResult> {
        if (!params.hook_id) {
            return this.createErrorResult('hook_id is required for unregister action');
        }

        const success = hooksSystem.unregisterHook(params.hook_id);

        if (!success) {
            return this.createErrorResult(`Hook with ID '${params.hook_id}' not found`);
        }

        return this.createSuccessResult(null, [
            `**🔗 Hook Unregistered**`,
            `**ID:** \`${params.hook_id}\``,
            '',
            '✅ Hook unregistered successfully'
        ].join('\n'));
    }

    private async handleEnable(hooksSystem: HooksSystem, params: IHooksManagementParams): Promise<CliToolResult> {
        if (!params.hook_id) {
            return this.createErrorResult('hook_id is required for enable action');
        }

        const success = hooksSystem.enableHook(params.hook_id);

        if (!success) {
            return this.createErrorResult(`Hook with ID '${params.hook_id}' not found`);
        }

        return this.createSuccessResult(null, [
            `**🔗 Hook Enabled**`,
            `**ID:** \`${params.hook_id}\``,
            '',
            '✅ Hook enabled successfully'
        ].join('\n'));
    }

    private async handleDisable(hooksSystem: HooksSystem, params: IHooksManagementParams): Promise<CliToolResult> {
        if (!params.hook_id) {
            return this.createErrorResult('hook_id is required for disable action');
        }

        const success = hooksSystem.disableHook(params.hook_id);

        if (!success) {
            return this.createErrorResult(`Hook with ID '${params.hook_id}' not found`);
        }

        return this.createSuccessResult(null, [
            `**🔗 Hook Disabled**`,
            `**ID:** \`${params.hook_id}\``,
            '',
            '✅ Hook disabled successfully'
        ].join('\n'));
    }

    private async handleClear(hooksSystem: HooksSystem, params: IHooksManagementParams): Promise<CliToolResult> {
        hooksSystem.clearHooks(params.hook_type);

        return this.createSuccessResult(null, [
            `**🔗 Hooks Cleared**`,
            `**Scope:** ${params.hook_type || 'All types'}`,
            '',
            '✅ Hooks cleared successfully'
        ].join('\n'));
    }

    private async handleExecute(hooksSystem: HooksSystem, params: IHooksManagementParams): Promise<CliToolResult> {
        if (!params.hook_type) {
            return this.createErrorResult('hook_type is required for execute action');
        }

        const testContext = params.test_context || {};
        const results = await hooksSystem.executeHooks(params.hook_type, testContext);

        const lines = [
            `**🔗 Hook Execution Results**`,
            `**Type:** ${params.hook_type}`,
            `**Hooks Executed:** ${results.length}`,
            ''
        ];

        if (results.length === 0) {
            lines.push('No hooks executed (none registered for this type).');
        } else {
            results.forEach((result, index) => {
                const statusIcon = result.success ? '✅' : '❌';
                lines.push(`${statusIcon} **Hook ${index + 1}**`);
                lines.push(`   - Success: ${result.success}`);

                if (result.message) {
                    lines.push(`   - Message: ${result.message}`);
                }

                if (result.stopExecution) {
                    lines.push(`   - ⚠️ Requested stop execution`);
                }

                if (result.data) {
                    lines.push(`   - Data: \`${JSON.stringify(result.data)}\``);
                }

                lines.push('');
            });
        }

        return this.createSuccessResult(null, lines.join('\n'));
    }

    private createHandlerFromCode(handlerCode: string): (context: IHookContext) => Promise<IHookResult> {
        try {
            // Create a safe execution environment
            const handlerFunction = new Function('context', 'console', `
                return (async function() {
                    ${handlerCode}
                })();
            `);

            return async(context: IHookContext): Promise<IHookResult> => {
                try {
                    const result = await handlerFunction.call(null, context, console);

                    // Ensure result has proper structure
                    if (typeof result === 'object' && result !== null) {
                        return {
                            success: result.success !== false,
                            message: result.message,
                            data: result.data,
                            stopExecution: result.stopExecution || false,
                            modifyContext: result.modifyContext
                        };
                    } else {
                        return {
                            success: true,
                            data: result
                        };
                    }
                } catch (error: any) {
                    return {
                        success: false,
                        message: `Handler execution error: ${error.message}`
                    };
                }
            };

        } catch (error: any) {
            throw new Error(`Invalid handler code: ${error.message}`);
        }
    }

    // Static helper methods for common hook patterns
    public static createSimpleHook(
        id: string,
        name: string,
        hookType: HookType,
        handler: (context: IHookContext) => Promise<IHookResult>
    ): IHookHandler {
        return {
            id,
            name,
            description: `Custom hook: ${name}`,
            hookType,
            priority: 100,
            enabled: true,
            handler
        };
    }

    public static createLoggingHook(id: string, message: string): IHookHandler {
        return this.createSimpleHook(id, 'Logging Hook', 'pre_tool_use', async(context) => {
            console.log(`[CUSTOM HOOK] ${message}`, context);
            return { success: true };
        });
    }

    public static createValidationHook(
        id: string,
        validator: (context: IHookContext) => boolean,
        errorMessage: string
    ): IHookHandler {
        return this.createSimpleHook(id, 'Validation Hook', 'pre_tool_use', async(context) => {
            if (!validator(context)) {
                return {
                    success: false,
                    message: errorMessage,
                    stopExecution: true
                };
            }
            return { success: true };
        });
    }
}

// Register the tool
ToolRegistry.registerTool(HooksManagementTool);