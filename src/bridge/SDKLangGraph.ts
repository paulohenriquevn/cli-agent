/*---------------------------------------------------------------------------------------------
 * SDK LangGraph Integration - Export CLI Agent tools for use in external LangGraph projects
 * 
 * This SDK converts CLI Agent tools into LangChain tool format compatible with LangGraph
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

// LangChain DynamicStructuredTool interface (minimal definition without importing LangChain)
export interface LangChainToolInterface {
    name: string;
    description: string;
    schema?: Record<string, unknown>;
    func: (input: Record<string, unknown>) => Promise<string>;
    // Additional properties that LangGraph might expect
    _lc_id?: string[];
    _lc_namespace?: string[];
    lc_name?: string;
    lc_serializable?: boolean;
}

// OpenRouter-compatible tool format extending LangChainToolInterface
interface OpenRouterToolFormat extends LangChainToolInterface {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, Record<string, unknown>>;
            required: string[];
            additionalProperties: boolean;
        };
    };
    call: (input: Record<string, unknown>) => Promise<string>;
    invoke: (input: Record<string, unknown>) => Promise<string>;
}

/**
 * Configuration for the LangGraph SDK
 */
export interface SDKLangGraphConfig {
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
 * Schema validation result
 */
interface SchemaValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    sanitizedSchema?: Record<string, unknown>;
}

/**
 * Error types for specific handling
 */
export enum SDKErrorType {
    TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
    SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
    TOOL_EXECUTION_TIMEOUT = 'TOOL_EXECUTION_TIMEOUT',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    INVALID_INPUT = 'INVALID_INPUT',
    TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
    CANCELLATION_REQUESTED = 'CANCELLATION_REQUESTED',
    CONTEXT_ERROR = 'CONTEXT_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Execution result for monitoring with enhanced error details
 */
export interface SDKExecutionResult {
    toolName: string;
    success: boolean;
    result?: string;
    error?: string;
    errorType?: SDKErrorType;
    executionTimeMs: number;
    retryCount?: number;
    metadata: {
        category: string;
        complexity: string;
        tags: string[];
        schemaValidated: boolean;
        memoryUsageMB?: number;
    };
}

/**
 * Main SDK class that converts CLI Agent tools to LangChain format
 */
export class SDKLangGraph {
    private config: SDKLangGraphConfig;
    private executionStats: Map<string, number> = new Map();
    private context: CliExecutionContext;
    
    // Performance optimization: Tool cache
    private toolCache: Map<string, LangChainToolInterface[]> = new Map();
    private schemaValidationCache: Map<string, SchemaValidationResult> = new Map();
    
    // Error tracking for SLA monitoring
    private errorStats: Map<string, { count: number; types: Record<SDKErrorType, number> }> = new Map();

    constructor(config: SDKLangGraphConfig = {}) {
        this.config = {
            workingDirectory: process.cwd(),
            sessionId: `sdk-langgraph-${Date.now()}`,
            environment: process.env as Record<string, string>,
            enableLogging: false,
            timeout: 30000,
            ...config
        };

        this.context = {
            workingDirectory: this.config.workingDirectory || process.cwd(),
            sessionId: this.config.sessionId || `bridge-${Date.now()}`,
            environment: this.config.environment || (process.env as Record<string, string>)
        };
    }

    /**
     * Get all tools converted to LangChain format with caching
     */
    getAllTools(): LangChainToolInterface[] {
        const cacheKey = this.generateCacheKey();
        
        // Check cache first for performance
        if (this.toolCache.has(cacheKey)) {
            if (this.config.enableLogging) {
                console.log('[SDKLangGraph] Using cached tools for better performance');
            }
            return this.toolCache.get(cacheKey)!;
        }
        
        const filteredTools = this.getFilteredTools();
        const convertedTools: LangChainToolInterface[] = [];
        
        for (const tool of filteredTools) {
            try {
                const convertedTool = this.convertToolToLangChain(tool);
                convertedTools.push(convertedTool);
            } catch (error) {
                console.error(`[SDKLangGraph] Failed to convert tool ${tool.name}:`, error);
                // Continue with other tools - don't let one bad tool break everything
                this.trackError(tool.name, SDKErrorType.SCHEMA_VALIDATION_FAILED);
            }
        }
        
        // Cache the result
        this.toolCache.set(cacheKey, convertedTools);
        
        if (this.config.enableLogging) {
            console.log(`[SDKLangGraph] Converted and cached ${convertedTools.length} tools`);
        }
        
        return convertedTools;
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
     * Execute a single tool with comprehensive error handling and SLA monitoring
     */
    async executeTool(
        toolName: string, 
        input: Record<string, unknown>
    ): Promise<SDKExecutionResult> {
        const startTime = Date.now();
        const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        
        const tool = ToolRegistry.getTool(toolName);
        
        if (!tool) {
            const result: SDKExecutionResult = {
                toolName,
                success: false,
                error: `Tool '${toolName}' not found`,
                errorType: SDKErrorType.TOOL_NOT_FOUND,
                executionTimeMs: Date.now() - startTime,
                metadata: {
                    category: 'unknown',
                    complexity: 'core',
                    tags: [],
                    schemaValidated: false
                }
            };
            this.trackError(toolName, SDKErrorType.TOOL_NOT_FOUND);
            return result;
        }

        try {
            // Validate tool context
            if (!this.context || !this.context.workingDirectory) {
                throw new Error('Invalid execution context - working directory not set');
            }
            
            // Set context for the tool
            tool.setContext(this.context);
            
            // Create cancellation token with enhanced timeout handling
            const cancellationToken = new CliCancellationToken();
            let timeoutId: NodeJS.Timeout | undefined;
            
            // Set timeout if configured
            if (this.config.timeout && this.config.timeout > 0) {
                timeoutId = setTimeout(() => {
                    cancellationToken.cancel();
                }, this.config.timeout);
            }

            // Execute tool with promise timeout wrapper for double protection
            const toolPromise = tool.invoke({
                input,
                toolName,
                context: this.context
            }, cancellationToken);
            
            let result: any;
            if (this.config.timeout && this.config.timeout > 0) {
                result = await Promise.race([
                    toolPromise,
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Tool execution timeout after ${this.config.timeout}ms`)), 
                            this.config.timeout! + 1000) // Extra 1s buffer
                    )
                ]);
            } else {
                result = await toolPromise;
            }
            
            // Clear timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Update stats
            const currentCount = this.executionStats.get(toolName) || 0;
            this.executionStats.set(toolName, currentCount + 1);
            
            // Calculate memory usage
            const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024; // MB
            const memoryUsed = memoryAfter - memoryBefore;

            const executionResult: SDKExecutionResult = {
                toolName,
                success: !result.hasErrors(),
                result: result.getText(),
                error: result.hasErrors() ? result.getErrors().join('; ') : undefined,
                errorType: result.hasErrors() ? this.classifyError(result.getErrors().join('; ')) : undefined,
                executionTimeMs: Date.now() - startTime,
                metadata: {
                    category: tool.category || 'other',
                    complexity: tool.complexity,
                    tags: tool.tags || [],
                    schemaValidated: true,
                    memoryUsageMB: memoryUsed > 0 ? memoryUsed : undefined
                }
            };

            // Track errors for SLA monitoring
            if (!executionResult.success && executionResult.errorType) {
                this.trackError(toolName, executionResult.errorType);
            }

            if (this.config.enableLogging) {
                const statusColor = executionResult.success ? '\x1b[32m' : '\x1b[31m'; // Green or Red
                const resetColor = '\x1b[0m';
                console.log(`[SDKLangGraph] ${statusColor}${toolName}: ${executionResult.success ? 'SUCCESS' : 'ERROR'}${resetColor} (${executionResult.executionTimeMs}ms${memoryUsed > 1 ? `, +${memoryUsed.toFixed(1)}MB` : ''})`);
            }

            return executionResult;

        } catch (error) {
            // Clear timeout if it was set
            const timeoutId = (error as any).timeoutId;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            const errorType = this.classifyError(error);
            const executionResult: SDKExecutionResult = {
                toolName,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                errorType,
                executionTimeMs: Date.now() - startTime,
                metadata: {
                    category: tool.category || 'other',
                    complexity: tool.complexity,
                    tags: tool.tags || [],
                    schemaValidated: true
                }
            };

            // Track error for SLA monitoring
            this.trackError(toolName, errorType);

            if (this.config.enableLogging) {
                console.error(`[SDKLangGraph] \x1b[31m${toolName}: ERROR\x1b[0m - ${executionResult.error} (${executionResult.executionTimeMs}ms)`);
            }

            return executionResult;
        }
    }

    // Private methods

    /**
     * Generate cache key for tool filtering configuration
     */
    private generateCacheKey(): string {
        const config = {
            includeCategories: this.config.includeCategories?.sort(),
            excludeCategories: this.config.excludeCategories?.sort(),
            includeTags: this.config.includeTags?.sort(),
            excludeTags: this.config.excludeTags?.sort(),
            includeComplexity: this.config.includeComplexity?.sort()
        };
        return JSON.stringify(config);
    }
    
    /**
     * Classify error type for specific handling
     */
    private classifyError(error: unknown): SDKErrorType {
        if (typeof error === 'string') {
            if (error.includes('timeout')) {return SDKErrorType.TOOL_EXECUTION_TIMEOUT;}
            if (error.includes('permission') || error.includes('EACCES')) {return SDKErrorType.PERMISSION_DENIED;}
            if (error.includes('not found') || error.includes('ENOENT')) {return SDKErrorType.TOOL_NOT_FOUND;}
            if (error.includes('invalid') || error.includes('validation')) {return SDKErrorType.INVALID_INPUT;}
            if (error.includes('cancel')) {return SDKErrorType.CANCELLATION_REQUESTED;}
            if (error.includes('context')) {return SDKErrorType.CONTEXT_ERROR;}
        }
        
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (message.includes('timeout')) {return SDKErrorType.TOOL_EXECUTION_TIMEOUT;}
            if (message.includes('permission') || message.includes('eacces')) {return SDKErrorType.PERMISSION_DENIED;}
            if (message.includes('not found') || message.includes('enoent')) {return SDKErrorType.TOOL_NOT_FOUND;}
            if (message.includes('invalid') || message.includes('validation')) {return SDKErrorType.INVALID_INPUT;}
            if (message.includes('cancel')) {return SDKErrorType.CANCELLATION_REQUESTED;}
            if (message.includes('context')) {return SDKErrorType.CONTEXT_ERROR;}
        }
        
        return SDKErrorType.UNKNOWN_ERROR;
    }
    
    /**
     * Track errors for SLA monitoring
     */
    private trackError(toolName: string, errorType: SDKErrorType): void {
        if (!this.errorStats.has(toolName)) {
            this.errorStats.set(toolName, {
                count: 0,
                types: {
                    [SDKErrorType.TOOL_NOT_FOUND]: 0,
                    [SDKErrorType.SCHEMA_VALIDATION_FAILED]: 0,
                    [SDKErrorType.TOOL_EXECUTION_TIMEOUT]: 0,
                    [SDKErrorType.PERMISSION_DENIED]: 0,
                    [SDKErrorType.INVALID_INPUT]: 0,
                    [SDKErrorType.TOOL_EXECUTION_FAILED]: 0,
                    [SDKErrorType.CANCELLATION_REQUESTED]: 0,
                    [SDKErrorType.CONTEXT_ERROR]: 0,
                    [SDKErrorType.UNKNOWN_ERROR]: 0
                }
            });
        }
        
        const stats = this.errorStats.get(toolName)!;
        stats.count++;
        stats.types[errorType]++;
        
        if (this.config.enableLogging) {
            console.warn(`[SDKLangGraph] Error tracked for ${toolName}: ${errorType} (total: ${stats.count})`);
        }
    }
    
    /**
     * Get SLA metrics for monitoring
     */
    getSLAMetrics(): Record<string, {
        successRate: number;
        totalExecutions: number;
        errorCount: number;
        errorBreakdown: Record<SDKErrorType, number>;
        averageExecutionTime?: number;
    }> {
        const metrics: Record<string, any> = {};
        
        // Get all tools that have been executed
        const allTools = new Set([...this.executionStats.keys(), ...this.errorStats.keys()]);
        
        for (const toolName of allTools) {
            const successCount = this.executionStats.get(toolName) || 0;
            const errorStats = this.errorStats.get(toolName);
            const errorCount = errorStats?.count || 0;
            const totalExecutions = successCount + errorCount;
            
            metrics[toolName] = {
                successRate: totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0,
                totalExecutions,
                errorCount,
                errorBreakdown: errorStats?.types || {}
            };
        }
        
        return metrics;
    }

    /**
     * Get filtered tools based on config
     */
    private getFilteredTools(): BaseTool[] {
        let tools = Array.from(ToolRegistry.getTools());

        // Filter by categories
        if (this.config.includeCategories && this.config.includeCategories.length > 0) {
            tools = tools.filter(tool => 
                this.config.includeCategories?.includes(tool.category || 'other')
            );
        }

        if (this.config.excludeCategories && this.config.excludeCategories.length > 0) {
            tools = tools.filter(tool => 
                !this.config.excludeCategories?.includes(tool.category || 'other')
            );
        }

        // Filter by tags
        if (this.config.includeTags && this.config.includeTags.length > 0) {
            tools = tools.filter(tool => 
                tool.tags && tool.tags.some(tag => this.config.includeTags?.includes(tag))
            );
        }

        if (this.config.excludeTags && this.config.excludeTags.length > 0) {
            tools = tools.filter(tool => 
                !tool.tags || !tool.tags.some(tag => this.config.excludeTags?.includes(tag))
            );
        }

        // Filter by complexity
        if (this.config.includeComplexity && this.config.includeComplexity.length > 0) {
            tools = tools.filter(tool => 
                this.config.includeComplexity?.includes(tool.complexity)
            );
        }

        return tools;
    }

    /**
     * Validate tool schema with comprehensive checks
     */
    private validateToolSchema(tool: BaseTool): SchemaValidationResult {
        const cacheKey = `${tool.name}_${JSON.stringify(tool.inputSchema)}`;
        
        // Check cache first
        if (this.schemaValidationCache.has(cacheKey)) {
            return this.schemaValidationCache.get(cacheKey)!;
        }
        
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Basic tool validation
        if (!tool.name || typeof tool.name !== 'string') {
            errors.push('Tool name is missing or invalid');
        }
        
        if (!tool.description || typeof tool.description !== 'string') {
            errors.push('Tool description is missing or invalid');
        }
        
        // Schema validation
        const schema = tool.inputSchema;
        if (!schema) {
            errors.push('Tool inputSchema is missing');
        } else if (typeof schema !== 'object') {
            errors.push('Tool inputSchema must be an object');
        } else {
            // Validate schema structure
            const schemaObj = schema as Record<string, unknown>;
            
            if (schemaObj.type !== 'object' && !schemaObj.properties) {
                warnings.push('Schema should have type: "object" and properties defined');
            }
            
            const properties = schemaObj.properties as Record<string, Record<string, unknown>> || {};
            const required = schemaObj.required as string[] || [];
            
            // Validate properties
            if (Object.keys(properties).length === 0) {
                warnings.push('Tool has no input parameters defined');
            } else {
                for (const [propName, propDef] of Object.entries(properties)) {
                    if (!propDef.type) {
                        warnings.push(`Property '${propName}' missing type definition`);
                    }
                    if (!propDef.description) {
                        warnings.push(`Property '${propName}' missing description`);
                    }
                }
            }
            
            // Validate required array
            for (const reqProp of required) {
                if (!properties[reqProp]) {
                    errors.push(`Required property '${reqProp}' not defined in properties`);
                }
            }
        }
        
        // Create sanitized schema for safe usage
        let sanitizedSchema: Record<string, unknown> | undefined;
        
        if (errors.length === 0) {
            sanitizedSchema = this.sanitizeSchema(schema as Record<string, unknown>);
        }
        
        const result: SchemaValidationResult = {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitizedSchema
        };
        
        // Cache the result
        this.schemaValidationCache.set(cacheKey, result);
        
        if (this.config.enableLogging && (errors.length > 0 || warnings.length > 0)) {
            console.warn(`[SDKLangGraph] Tool ${tool.name} validation:`, {
                errors,
                warnings
            });
        }
        
        return result;
    }
    
    /**
     * Sanitize schema to prevent injection and ensure compatibility
     */
    private sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
        const sanitized: Record<string, unknown> = {
            type: 'object',
            additionalProperties: false
        };
        
        // Safely extract properties
        if (schema.properties && typeof schema.properties === 'object') {
            const properties = schema.properties as Record<string, Record<string, unknown>>;
            const sanitizedProperties: Record<string, Record<string, unknown>> = {};
            
            for (const [key, value] of Object.entries(properties)) {
                if (typeof value === 'object' && value !== null) {
                    const propConfig: Record<string, unknown> = {
                        type: typeof value.type === 'string' ? value.type : 'string',
                        description: typeof value.description === 'string' ? value.description : `Parameter: ${key}`
                    };
                    
                    if (value.enum && Array.isArray(value.enum)) {
                        propConfig.enum = value.enum;
                    }
                    if (value.default !== undefined) {
                        propConfig.default = value.default;
                    }
                    if (value.examples && Array.isArray(value.examples)) {
                        propConfig.examples = value.examples;
                    }
                    
                    sanitizedProperties[key] = propConfig;
                }
            }
            
            sanitized.properties = sanitizedProperties;
        } else {
            sanitized.properties = {};
        }
        
        // Safely extract required array
        if (Array.isArray(schema.required)) {
            sanitized.required = schema.required.filter(item => typeof item === 'string');
        } else {
            sanitized.required = [];
        }
        
        return sanitized;
    }

    /**
     * Convert BaseTool to OpenRouter-compatible LangChain tool format with validation
     * Uses the correct schema format expected by OpenRouter
     */
    private convertToolToLangChain(tool: BaseTool): OpenRouterToolFormat {
        // CRITICAL: Validate schema first to ensure 99% SLA
        const validation = this.validateToolSchema(tool);
        
        if (!validation.isValid) {
            const errorMsg = `Tool ${tool.name} schema validation failed: ${validation.errors.join(', ')}`;
            console.error(`[SDKLangGraph] ${errorMsg}`);
            throw new Error(errorMsg);
        }
        
        // Use sanitized schema for guaranteed compatibility
        const sanitizedSchema = validation.sanitizedSchema!;
        const properties = (sanitizedSchema.properties as Record<string, Record<string, unknown>>) || {};
        const required = (sanitizedSchema.required as string[]) || [];
        
        // Create a robust tool function with enhanced error handling
        const toolFunction = (async (input: Record<string, unknown>): Promise<string> => {
            try {
                // Extract actual parameters from LangChain's wrapper format
                const actualInput = (input as any).args || input;
                
                const result = await this.executeTool(tool.name, actualInput);
                if (!result.success) {
                    // Throw specific error based on error type for better handling
                    const errorMessage = result.error || 'Tool execution failed';
                    const enhancedError = new Error(errorMessage);
                    (enhancedError as any).errorType = result.errorType;
                    (enhancedError as any).toolName = tool.name;
                    throw enhancedError;
                }
                return result.result || '';
            } catch (error) {
                // Track error for SLA monitoring
                this.trackError(tool.name, 
                    (error as any).errorType || SDKErrorType.TOOL_EXECUTION_FAILED
                );
                throw error;
            }
        }).bind(this);

        // Create OpenRouter-compatible tool format with validated schema
        return {
            type: "function",
            name: tool.name, // Required for LangChainToolInterface
            description: tool.description, // Required for LangChainToolInterface
            function: {
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: "object",
                    properties: properties,
                    required: required,
                    additionalProperties: false
                }
            },
            // Also include the function execution for LangChain compatibility
            func: toolFunction,
            call: toolFunction,
            invoke: toolFunction,
            // Minimal LangChain metadata
            lc_name: 'Tool',
            lc_serializable: false
        };
    }

    /**
     * Convert JSON Schema to LangChain format
     */
    private convertSchema(schema: Record<string, unknown>): Record<string, unknown> {
        // LangChain/LangGraph expects a specific schema format with proper type definitions
        const properties = (schema.properties as Record<string, Record<string, unknown>>) || {};
        const required = (schema.required as string[]) || [];
        
        // Convert properties to ensure proper typing
        const convertedProperties: Record<string, Record<string, unknown>> = {};
        
        Object.entries(properties).forEach(([key, prop]: [string, Record<string, unknown>]) => {
            const convertedProp: Record<string, unknown> = {
                type: prop.type || 'string',
                description: prop.description || ''
            };
            
            if (prop.enum) {convertedProp.enum = prop.enum;}
            if (prop.default !== undefined) {convertedProp.default = prop.default;}
            if (prop.examples) {convertedProp.examples = prop.examples;}
            
            convertedProperties[key] = convertedProp;
        });

        return {
            type: 'object',
            properties: convertedProperties,
            required: required,
            additionalProperties: false
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
    static getAllTools(config?: SDKLangGraphConfig): LangChainToolInterface[] {
        const bridge = new SDKLangGraph(config);
        return bridge.getAllTools();
    }

    /**
     * Get essential tools only (core functionality)
     */
    static getEssentialTools(config?: SDKLangGraphConfig): LangChainToolInterface[] {
        const bridge = new SDKLangGraph({
            ...config,
            includeComplexity: ['essential', 'core']
        });
        return bridge.getAllTools();
    }

    /**
     * Get file operation tools
     */
    static getFileTools(config?: SDKLangGraphConfig): LangChainToolInterface[] {
        const bridge = new SDKLangGraph({
            ...config,
            includeCategories: ['file_operations']
        });
        return bridge.getAllTools();
    }

    /**
     * Get search and analysis tools
     */
    static getSearchTools(config?: SDKLangGraphConfig): LangChainToolInterface[] {
        const bridge = new SDKLangGraph({
            ...config,
            includeCategories: ['search-analysis']
        });
        return bridge.getAllTools();
    }

    /**
     * Get web-related tools
     */
    static getWebTools(config?: SDKLangGraphConfig): LangChainToolInterface[] {
        const bridge = new SDKLangGraph({
            ...config,
            includeTags: ['web', 'network', 'api']
        });
        return bridge.getAllTools();
    }

    /**
     * Get development tools
     */
    static getDevTools(config?: SDKLangGraphConfig): LangChainToolInterface[] {
        const bridge = new SDKLangGraph({
            ...config,
            includeCategories: ['development', 'testing', 'automation']
        });
        return bridge.getAllTools();
    }

    /**
     * Create a custom SDK with specific configuration
     */
    static createSDK(config: SDKLangGraphConfig): SDKLangGraph {
        return new SDKLangGraph(config);
    }

    /**
     * Get tools metadata for inspection
     */
    static getToolsMetadata(config?: SDKLangGraphConfig): ToolMetadata[] {
        const bridge = new SDKLangGraph(config);
        return bridge.getToolsMetadata();
    }
}