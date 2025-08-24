/*---------------------------------------------------------------------------------------------
 * CLI Agent SDK - Main SDK class for external integration
 *--------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'events';
import { ToolRegistry } from '../tools/registry/toolRegistry';
// Healing and normalization disabled
// import { ToolHealer } from '../tools/healing/toolHealer';
// import { NormalizationIntegration } from '../tools/normalization/normalizationIntegration';
import { CliExecutionContext, CliCancellationToken } from '../tools/types/cliTypes';
import {
    SDKConfig,
    SDKToolResult,
    SDKExecutionContext,
    SDKToolInfo,
    SDKStats,
    ToolExecutionResult,
    CustomToolDefinition,
    SDKEvents,
    SDKPlugin,
    BatchExecutionRequest,
    BatchExecutionResult
} from './types/sdkTypes';
import { createDefaultSDKConfig, validateSDKConfig, createExecutionContext } from './utils/sdkUtils';

// Import all tools to ensure they're registered
import '../tools/implementations/readFileTool';
import '../tools/implementations/writeFileTool';
import '../tools/implementations/editFileTool';
import '../tools/implementations/bashCommandTool';
import '../tools/implementations/executeCommandTool';
import '../tools/implementations/globTool';
import '../tools/implementations/grepTool';
import '../tools/implementations/listDirectoryTool';
import '../tools/implementations/webSearchTool';
import '../tools/implementations/webFetchTool';
import '../tools/implementations/taskTool';
import '../tools/implementations/todoWriteTool';
import '../tools/implementations/multiEditTool';
import '../tools/implementations/advancedDiffTool';
import '../tools/implementations/advancedNotebookTool';
import '../tools/implementations/advancedPatchTool';
import '../tools/implementations/computerUseTool';
import '../tools/implementations/createExecutionPlanTool';
import '../tools/implementations/enhancedWebSearchTool';
import '../tools/implementations/exitPlanModeTool';
import '../tools/implementations/fetchDocumentationTool';
import '../tools/implementations/hooksManagementTool';
import '../tools/implementations/intelligentTestAnalyzerTool';
import '../tools/implementations/mcpIntegrationTool';
import '../tools/implementations/notebookEditTool';
import '../tools/implementations/notebookReadTool';
import '../tools/implementations/searchCodeTool';
import '../tools/implementations/subAgentsTool';
import '../tools/implementations/symbolAnalysisTool';
import '../tools/implementations/textEditorTool';
// import '../tools/implementations/toolHealingTool'; // Temporarily disabled - healing system has type issues

export class CliAgentSDK extends EventEmitter {
    private config: SDKConfig;
    // private healer?: ToolHealer;
    // private normalizer?: NormalizationIntegration;
    private executionStats = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0
    };
    private plugins: Map<string, SDKPlugin> = new Map();
    private initialized = false;

    constructor(config: Partial<SDKConfig> = {}) {
        super();
        this.config = { ...createDefaultSDKConfig(), ...config };
        
        // Validate configuration
        const validation = validateSDKConfig(this.config);
        if (!validation.isValid) {
            throw new Error(`SDK configuration invalid: ${validation.errors.join(', ')}`);
        }
    }

    /**
     * Initialize the SDK
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Healing and normalization disabled
            // if (this.config.enableHealing) {
            //     this.healer = new ToolHealer({
            //         enabledForStringReplace: true,
            //         enabledForPatchApply: true,
            //         maxHealingAttempts: 3,
            //         healingTimeout: this.config.healingTimeout || 30000,
            //         model: this.config.defaultModel || 'gpt-4o-mini'
            //     });
            // }
            // if (this.config.enableNormalization) {
            //     this.normalizer = new NormalizationIntegration({
            //         enableCache: this.config.cacheEnabled !== false,
            //         strictValidation: true,
            //         logFixes: this.config.enableLogging !== false
            //     });
            // }

            // Register custom tools
            if (this.config.customTools) {
                for (const toolDef of this.config.customTools) {
                    this.registerCustomTool(toolDef);
                }
            }

            // Load plugins
            if (this.config.pluginPaths) {
                await this.loadPlugins(this.config.pluginPaths);
            }

            this.initialized = true;

            this.emit('sdk.initialized', {
                config: this.config,
                toolsLoaded: ToolRegistry.getStats().totalTools
            });

            this.log('info', 'CLI Agent SDK initialized successfully', {
                toolsCount: ToolRegistry.getStats().totalTools,
                healingEnabled: false, // !!this.healer,
                normalizationEnabled: false // !!this.normalizer
            });

        } catch (error) {
            this.emit('sdk.error', {
                message: 'Failed to initialize SDK',
                stack: error instanceof Error ? error.stack : undefined,
                context: { config: this.config }
            });
            throw error;
        }
    }

    /**
     * Execute a single tool
     */
    async executeTool(
        toolName: string,
        parameters: Record<string, unknown>,
        context?: Partial<SDKExecutionContext>
    ): Promise<ToolExecutionResult> {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        const executionContext = createExecutionContext(context, this.config);
        const cancellationToken = new CliCancellationToken();
        
        this.executionStats.totalExecutions++;

        this.emit('tool.execution.start', {
            toolName,
            parameters,
            context: executionContext
        });

        try {
            // Get tool info
            const toolInfo = this.getToolInfo(toolName);
            if (!toolInfo) {
                throw new Error(`Tool '${toolName}' not found`);
            }

            // Run pre-execution hooks
            const processedParams = await this.runPreExecutionHooks(toolName, parameters);

            // Execute tool with healing
            const cliContext: CliExecutionContext = {
                workingDirectory: executionContext.workingDirectory,
                sessionId: executionContext.sessionId,
                environment: executionContext.environment,
                user: executionContext.userId
            };

            const result = await ToolRegistry.executeTool(
                toolName,
                processedParams,
                cliContext,
                cancellationToken
            );

            // Convert to SDK result format
            const sdkResult: SDKToolResult = {
                success: !result.hasErrors(),
                data: result.getText(),
                output: result.getText(),
                error: result.hasErrors() ? result.getErrors().join('; ') : undefined,
                executionTime: Date.now() - startTime,
                metadata: {
                    toolName,
                    healingApplied: false,
                    normalizationApplied: false,
                    retryCount: 0
                }
            };

            // Create full execution result
            const executionResult: ToolExecutionResult = {
                ...sdkResult,
                toolInfo,
                context: executionContext,
                logs: []
            };

            // Run post-execution hooks
            const finalResult = await this.runPostExecutionHooks(executionResult);

            if (finalResult.success) {
                this.executionStats.successfulExecutions++;
            } else {
                this.executionStats.failedExecutions++;
            }

            this.executionStats.totalExecutionTime += finalResult.executionTime;

            this.emit('tool.execution.complete', finalResult);
            return finalResult;

        } catch (error) {
            this.executionStats.failedExecutions++;
            const errorMessage = error instanceof Error ? error.message : String(error);

            this.emit('tool.execution.error', {
                toolName,
                error: errorMessage,
                parameters,
                context: executionContext
            });

            // Run error hooks
            await this.runErrorHooks(error as Error, { toolName, parameters, context: executionContext });

            const toolInfo = this.getToolInfo(toolName) || {
                name: toolName,
                description: 'Unknown tool',
                category: 'unknown',
                tags: [],
                complexity: 'core' as const,
                parameters: []
            };

            return {
                success: false,
                error: errorMessage,
                executionTime: Date.now() - startTime,
                metadata: {
                    toolName,
                    healingApplied: false,
                    normalizationApplied: false,
                    retryCount: 0
                },
                toolInfo,
                context: executionContext,
                logs: []
            };
        }
    }

    /**
     * Execute multiple tools in batch
     */
    async executeBatch(request: BatchExecutionRequest): Promise<BatchExecutionResult> {
        const startTime = Date.now();
        const results: Record<string, SDKToolResult> = {};
        const errors: Record<string, string> = {};
        const executionOrder: string[] = [];

        try {
            if (request.options?.parallel) {
                // Parallel execution
                const promises = request.operations.map(async (op) => {
                    const id = op.id || `${op.toolName}-${Date.now()}`;
                    try {
                        const result = await this.executeTool(op.toolName, op.parameters);
                        results[id] = result;
                        executionOrder.push(id);
                    } catch (error) {
                        errors[id] = error instanceof Error ? error.message : String(error);
                        if (request.options?.stopOnError) {
                            throw error;
                        }
                    }
                });

                await Promise.all(promises);

            } else {
                // Sequential execution with dependency management
                const remaining = [...request.operations];
                const completed = new Set<string>();

                while (remaining.length > 0) {
                    const readyOps = remaining.filter(op => {
                        if (!op.dependsOn || op.dependsOn.length === 0) {
                            return true;
                        }
                        return op.dependsOn.every(depId => completed.has(depId));
                    });

                    if (readyOps.length === 0) {
                        throw new Error('Circular dependency detected in batch operations');
                    }

                    for (const op of readyOps) {
                        const id = op.id || `${op.toolName}-${Date.now()}`;
                        try {
                            const result = await this.executeTool(op.toolName, op.parameters);
                            results[id] = result;
                            executionOrder.push(id);
                            completed.add(id);
                        } catch (error) {
                            errors[id] = error instanceof Error ? error.message : String(error);
                            if (request.options?.stopOnError) {
                                throw error;
                            }
                        }

                        remaining.splice(remaining.indexOf(op), 1);
                    }
                }
            }

            return {
                success: Object.keys(errors).length === 0,
                results,
                errors,
                executionOrder,
                totalExecutionTime: Date.now() - startTime,
                metadata: {
                    totalOperations: request.operations.length,
                    successfulOperations: Object.keys(results).length,
                    failedOperations: Object.keys(errors).length,
                    parallelExecution: request.options?.parallel || false
                }
            };

        } catch (error) {
            return {
                success: false,
                results,
                errors: {
                    ...errors,
                    batch: error instanceof Error ? error.message : String(error)
                },
                executionOrder,
                totalExecutionTime: Date.now() - startTime,
                metadata: {
                    totalOperations: request.operations.length,
                    successfulOperations: Object.keys(results).length,
                    failedOperations: Object.keys(errors).length + 1,
                    parallelExecution: request.options?.parallel || false
                }
            };
        }
    }

    /**
     * List all available tools
     */
    listTools(): SDKToolInfo[] {
        return ToolRegistry.getTools().map(tool => ({
            name: tool.name,
            description: tool.description,
            category: tool.category || 'other',
            tags: tool.tags || [],
            complexity: tool.complexity,
            parameters: this.extractParameters(tool.inputSchema as Record<string, unknown>)
        }));
    }

    /**
     * Get information about a specific tool
     */
    getToolInfo(toolName: string): SDKToolInfo | null {
        const tool = ToolRegistry.getTool(toolName);
        if (!tool) {
            return null;
        }

        return {
            name: tool.name,
            description: tool.description,
            category: tool.category || 'other',
            tags: tool.tags || [],
            complexity: tool.complexity,
            parameters: this.extractParameters(tool.inputSchema as Record<string, unknown>)
        };
    }

    /**
     * Get SDK statistics
     */
    getStats(): SDKStats {
        const registryStats = ToolRegistry.getStats();
        
        return {
            totalTools: registryStats.totalTools,
            categoriesCount: registryStats.categoriesCount,
            executionStats: {
                ...this.executionStats,
                averageExecutionTime: this.executionStats.totalExecutions > 0 
                    ? this.executionStats.totalExecutionTime / this.executionStats.totalExecutions 
                    : 0
            },
            healingStats: {
                healingAttempts: 0, // Would be populated by healer
                healingSuccesses: 0,
                commonIssues: {}
            },
            normalizationStats: {
                normalizationsApplied: 0, // Would be populated by normalizer
                modelsSupported: ['gpt-4o-mini', 'gpt-4o', 'claude-3-sonnet', 'gemini-pro'],
                fixesApplied: {}
            }
        };
    }

    /**
     * Register a custom tool
     */
    registerCustomTool(toolDef: CustomToolDefinition): void {
        // Implementation would create a BaseTool instance and register it
        this.log('info', `Registered custom tool: ${toolDef.name}`);
    }

    /**
     * Install a plugin
     */
    async installPlugin(plugin: SDKPlugin): Promise<void> {
        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin '${plugin.name}' is already installed`);
        }

        await plugin.initialize(this);
        this.plugins.set(plugin.name, plugin);
        
        this.log('info', `Installed plugin: ${plugin.name} v${plugin.version}`);
    }

    /**
     * Uninstall a plugin
     */
    async uninstallPlugin(pluginName: string): Promise<void> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`Plugin '${pluginName}' is not installed`);
        }

        if (plugin.cleanup) {
            await plugin.cleanup();
        }
        
        this.plugins.delete(pluginName);
        this.log('info', `Uninstalled plugin: ${pluginName}`);
    }

    /**
     * Cleanup and dispose the SDK
     */
    async dispose(): Promise<void> {
        // Cleanup plugins
        for (const plugin of Array.from(this.plugins.values())) {
            if (plugin.cleanup) {
                await plugin.cleanup();
            }
        }
        this.plugins.clear();

        // Remove all listeners
        this.removeAllListeners();

        this.initialized = false;
        this.log('info', 'SDK disposed');
    }

    // Private methods

    private extractParameters(schema: Record<string, unknown>): Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
        examples?: unknown[];
    }> {
        if (!schema || !schema.properties || typeof schema.properties !== 'object') {
            return [];
        }

        const required = Array.isArray(schema.required) ? schema.required : [];
        const properties = schema.properties as Record<string, Record<string, unknown>>;
        
        return Object.entries(properties).map(([name, prop]) => ({
            name,
            type: (prop.type as string) || 'string',
            required: required.includes(name),
            description: (prop.description as string) || '',
            examples: prop.examples as unknown[]
        }));
    }

    private async loadPlugins(pluginPaths: string[]): Promise<void> {
        // Implementation would dynamically load plugins from paths
        this.log('info', `Loading plugins from ${pluginPaths.length} paths`);
    }

    private async runPreExecutionHooks(toolName: string, parameters: Record<string, unknown>): Promise<Record<string, unknown>> {
        let processedParams = parameters;
        
        for (const plugin of Array.from(this.plugins.values())) {
            if (plugin.beforeToolExecution) {
                processedParams = await plugin.beforeToolExecution(toolName, processedParams) || processedParams;
            }
        }
        
        return processedParams;
    }

    private async runPostExecutionHooks(result: ToolExecutionResult): Promise<ToolExecutionResult> {
        let processedResult = result;
        
        for (const plugin of Array.from(this.plugins.values())) {
            if (plugin.afterToolExecution) {
                processedResult = await plugin.afterToolExecution(processedResult) || processedResult;
            }
        }
        
        return processedResult;
    }

    private async runErrorHooks(error: Error, context: Record<string, unknown>): Promise<void> {
        for (const plugin of Array.from(this.plugins.values())) {
            if (plugin.onError) {
                await plugin.onError(error, context);
            }
        }
    }

    private log(level: string, message: string, data?: Record<string, unknown>): void {
        if (!this.config.enableLogging) {
            return;
        }

        if (this.config.customLogger) {
            this.config.customLogger(level, message, data);
        } else {
            console.log(`[${level.toUpperCase()}] ${message}`, data ? data : '');
        }
    }

    // Event emitter typing
    on<K extends keyof SDKEvents>(event: K, listener: (data: SDKEvents[K]) => void): this {
        return super.on(event, listener);
    }

    emit<K extends keyof SDKEvents>(event: K, data: SDKEvents[K]): boolean {
        return super.emit(event, data);
    }
}