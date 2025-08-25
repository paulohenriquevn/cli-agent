/*---------------------------------------------------------------------------------------------
 * LangGraph Bridge - Export CLI Agent tools for use in external LangGraph projects
 * 
 * This bridge converts CLI Agent tools into LangChain tool format compatible with LangGraph
 * WITHOUT adding LangGraph as a dependency to this project.
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../tools/registry/toolRegistry';
import { BaseTool } from '../tools/base/baseTool';
import { CliExecutionContext, CliCancellationToken } from '../tools/types/cliTypes';

// Import all tools to ensure they're registered (same as CLI does)
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
import '../tools/implementations/intelligentTestAnalyzerTool';
import '../tools/implementations/mcpIntegrationTool';
import '../tools/implementations/notebookEditTool';
import '../tools/implementations/notebookReadTool';
import '../tools/implementations/searchCodeTool';
import '../tools/implementations/symbolAnalysisTool';
import '../tools/implementations/textEditorTool';
// import '../tools/implementations/toolHealingTool'; // Disabled - healing system has type issues

// LangChain tool interface (minimal definition without importing LangChain)
export interface LangChainToolInterface {
    name: string;
    description: string;
    schema: Record<string, unknown>;
    func: (input: Record<string, unknown>) => Promise<string>;
}

/**
 * Configuration for the bridge
 */
export interface BridgeConfig {
    workingDirectory?: string;
    sessionId?: string;
    environment?: Record<string, string>;
    includeCategories?: string[];
    excludeCategories?: string[];
    includeTags?: string[];
    excludeTags?: string[];
    includeComplexity?: Array<'core' | 'advanced' | 'essential'>;
    enableLogging?: boolean;
    timeout?: number;
}

/**
 * Tool metadata for external inspection
 */
export interface ToolMetadata {
    name: string;
    description: string;
    category: string;
    tags: string[];
    complexity: 'core' | 'advanced' | 'essential';
    parameters: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
    }>;
}

/**
 * Execution result for monitoring
 */
export interface BridgeExecutionResult {
    toolName: string;
    success: boolean;
    result?: string;
    error?: string;
    executionTimeMs: number;
    metadata: {
        category: string;
        complexity: string;
        tags: string[];
    };
}

/**
 * Main bridge class that converts CLI Agent tools to LangChain format
 */
export class LangGraphBridge {
    private config: BridgeConfig;
    private executionStats: Map<string, number> = new Map();
    private context: CliExecutionContext;

    constructor(config: BridgeConfig = {}) {
        this.config = {
            workingDirectory: process.cwd(),
            sessionId: `bridge-${Date.now()}`,
            environment: process.env as Record<string, string>,
            enableLogging: false,
            timeout: 30000,
            ...config
        };

        this.context = {
            workingDirectory: this.config.workingDirectory!,
            sessionId: this.config.sessionId!,
            environment: this.config.environment!
        };
    }

    /**
     * Get all tools converted to LangChain format
     */
    getAllTools(): LangChainToolInterface[] {
        const filteredTools = this.getFilteredTools();
        return filteredTools.map(tool => this.convertToolToLangChain(tool));
    }

    /**
     * Get specific tools by name
     */
    getToolsByName(names: string[]): LangChainToolInterface[] {
        const allTools = this.getAllTools();
        return allTools.filter(tool => names.includes(tool.name));
    }

    /**
     * Get tools by category
     */
    getToolsByCategory(categories: string[]): LangChainToolInterface[] {
        const filteredTools = ToolRegistry.getTools().filter(tool => 
            categories.includes(tool.category || 'other')
        );
        return filteredTools.map(tool => this.convertToolToLangChain(tool));
    }

    /**
     * Get tools by tags
     */
    getToolsByTags(tags: string[]): LangChainToolInterface[] {
        const filteredTools = ToolRegistry.getTools().filter(tool => 
            tool.tags && tool.tags.some(tag => tags.includes(tag))
        );
        return filteredTools.map(tool => this.convertToolToLangChain(tool));
    }

    /**
     * Get tools by complexity
     */
    getToolsByComplexity(complexities: Array<'core' | 'advanced' | 'essential'>): LangChainToolInterface[] {
        const filteredTools = ToolRegistry.getTools().filter(tool => 
            complexities.includes(tool.complexity)
        );
        return filteredTools.map(tool => this.convertToolToLangChain(tool));
    }

    /**
     * Get tool metadata for inspection
     */
    getToolsMetadata(): ToolMetadata[] {
        const filteredTools = this.getFilteredTools();
        return filteredTools.map(tool => this.extractToolMetadata(tool));
    }

    /**
     * Get execution statistics
     */
    getExecutionStats(): Record<string, number> {
        return Object.fromEntries(this.executionStats);
    }

    /**
     * Execute a single tool directly (for testing)
     */
    async executeTool(
        toolName: string, 
        input: Record<string, unknown>
    ): Promise<BridgeExecutionResult> {
        const startTime = Date.now();
        const tool = ToolRegistry.getTool(toolName);
        
        if (!tool) {
            return {
                toolName,
                success: false,
                error: `Tool '${toolName}' not found`,
                executionTimeMs: Date.now() - startTime,
                metadata: {
                    category: 'unknown',
                    complexity: 'core',
                    tags: []
                }
            };
        }

        try {
            // Set context for the tool
            tool.setContext(this.context);
            
            // Create cancellation token
            const cancellationToken = new CliCancellationToken();
            
            // Set timeout if configured
            if (this.config.timeout && this.config.timeout > 0) {
                setTimeout(() => {
                    cancellationToken.cancel();
                }, this.config.timeout);
            }

            // Execute tool
            const result = await tool.invoke({
                input,
                toolName,
                context: this.context
            }, cancellationToken);

            // Update stats
            const currentCount = this.executionStats.get(toolName) || 0;
            this.executionStats.set(toolName, currentCount + 1);

            const executionResult: BridgeExecutionResult = {
                toolName,
                success: !result.hasErrors(),
                result: result.getText(),
                error: result.hasErrors() ? result.getErrors().join('; ') : undefined,
                executionTimeMs: Date.now() - startTime,
                metadata: {
                    category: tool.category || 'other',
                    complexity: tool.complexity,
                    tags: tool.tags || []
                }
            };

            if (this.config.enableLogging) {
                console.log(`[LangGraphBridge] ${toolName}: ${executionResult.success ? 'SUCCESS' : 'ERROR'} (${executionResult.executionTimeMs}ms)`);
            }

            return executionResult;

        } catch (error) {
            const executionResult: BridgeExecutionResult = {
                toolName,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                executionTimeMs: Date.now() - startTime,
                metadata: {
                    category: tool.category || 'other',
                    complexity: tool.complexity,
                    tags: tool.tags || []
                }
            };

            if (this.config.enableLogging) {
                console.error(`[LangGraphBridge] ${toolName}: ERROR - ${executionResult.error} (${executionResult.executionTimeMs}ms)`);
            }

            return executionResult;
        }
    }

    // Private methods

    /**
     * Get filtered tools based on config
     */
    private getFilteredTools(): BaseTool[] {
        let tools = Array.from(ToolRegistry.getTools());

        // Filter by categories
        if (this.config.includeCategories && this.config.includeCategories.length > 0) {
            tools = tools.filter(tool => 
                this.config.includeCategories!.includes(tool.category || 'other')
            );
        }

        if (this.config.excludeCategories && this.config.excludeCategories.length > 0) {
            tools = tools.filter(tool => 
                !this.config.excludeCategories!.includes(tool.category || 'other')
            );
        }

        // Filter by tags
        if (this.config.includeTags && this.config.includeTags.length > 0) {
            tools = tools.filter(tool => 
                tool.tags && tool.tags.some(tag => this.config.includeTags!.includes(tag))
            );
        }

        if (this.config.excludeTags && this.config.excludeTags.length > 0) {
            tools = tools.filter(tool => 
                !tool.tags || !tool.tags.some(tag => this.config.excludeTags!.includes(tag))
            );
        }

        // Filter by complexity
        if (this.config.includeComplexity && this.config.includeComplexity.length > 0) {
            tools = tools.filter(tool => 
                this.config.includeComplexity!.includes(tool.complexity)
            );
        }

        return tools;
    }

    /**
     * Convert BaseTool to LangChain tool format
     */
    private convertToolToLangChain(tool: BaseTool): LangChainToolInterface {
        return {
            name: tool.name,
            description: tool.description,
            schema: this.convertSchema(tool.inputSchema as Record<string, unknown>),
            func: async (input: Record<string, unknown>): Promise<string> => {
                const result = await this.executeTool(tool.name, input);
                if (!result.success) {
                    throw new Error(result.error || 'Tool execution failed');
                }
                return result.result || '';
            }
        };
    }

    /**
     * Convert JSON Schema to LangChain format
     */
    private convertSchema(schema: Record<string, unknown>): Record<string, unknown> {
        // LangChain expects a simplified schema format
        // Keep the original schema but ensure compatibility
        return {
            type: 'object',
            properties: schema.properties || {},
            required: schema.required || [],
            description: schema.description || ''
        };
    }

    /**
     * Extract tool metadata
     */
    private extractToolMetadata(tool: BaseTool): ToolMetadata {
        const schema = tool.inputSchema as Record<string, unknown>;
        const properties = (schema.properties as Record<string, Record<string, unknown>>) || {};
        const required = (schema.required as string[]) || [];

        const parameters = Object.entries(properties).map(([name, prop]) => ({
            name,
            type: (prop.type as string) || 'string',
            required: required.includes(name),
            description: (prop.description as string) || ''
        }));

        return {
            name: tool.name,
            description: tool.description,
            category: tool.category || 'other',
            tags: tool.tags || [],
            complexity: tool.complexity,
            parameters
        };
    }
}

/**
 * Convenience functions for common use cases
 */
export class CLIAgentTools {
    /**
     * Get all tools in LangChain format (most common use case)
     */
    static getAllTools(config?: BridgeConfig): LangChainToolInterface[] {
        const bridge = new LangGraphBridge(config);
        return bridge.getAllTools();
    }

    /**
     * Get essential tools only (core functionality)
     */
    static getEssentialTools(config?: BridgeConfig): LangChainToolInterface[] {
        const bridge = new LangGraphBridge({
            ...config,
            includeComplexity: ['essential', 'core']
        });
        return bridge.getAllTools();
    }

    /**
     * Get file operation tools
     */
    static getFileTools(config?: BridgeConfig): LangChainToolInterface[] {
        const bridge = new LangGraphBridge({
            ...config,
            includeCategories: ['file_operations']
        });
        return bridge.getAllTools();
    }

    /**
     * Get search and analysis tools
     */
    static getSearchTools(config?: BridgeConfig): LangChainToolInterface[] {
        const bridge = new LangGraphBridge({
            ...config,
            includeCategories: ['search-analysis']
        });
        return bridge.getAllTools();
    }

    /**
     * Get web-related tools
     */
    static getWebTools(config?: BridgeConfig): LangChainToolInterface[] {
        const bridge = new LangGraphBridge({
            ...config,
            includeTags: ['web', 'network', 'api']
        });
        return bridge.getAllTools();
    }

    /**
     * Get development tools
     */
    static getDevTools(config?: BridgeConfig): LangChainToolInterface[] {
        const bridge = new LangGraphBridge({
            ...config,
            includeCategories: ['development', 'testing', 'automation']
        });
        return bridge.getAllTools();
    }

    /**
     * Create a custom bridge with specific configuration
     */
    static createBridge(config: BridgeConfig): LangGraphBridge {
        return new LangGraphBridge(config);
    }

    /**
     * Get tools metadata for inspection
     */
    static getToolsMetadata(config?: BridgeConfig): ToolMetadata[] {
        const bridge = new LangGraphBridge(config);
        return bridge.getToolsMetadata();
    }
}