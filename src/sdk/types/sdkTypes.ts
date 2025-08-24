/*---------------------------------------------------------------------------------------------
 * SDK Types - Public interfaces for SDK consumers
 *--------------------------------------------------------------------------------------------*/

import { CliExecutionContext, CliToolResult } from '../../tools/types/cliTypes';

/**
 * SDK Configuration
 */
export interface SDKConfig {
    // LLM Configuration
    openRouterApiKey?: string;
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
    
    // Tool Configuration
    enableHealing?: boolean;
    enableNormalization?: boolean;
    healingTimeout?: number;
    toolCallLimit?: number;
    
    // Execution Context
    workingDirectory?: string;
    sessionId?: string;
    environment?: Record<string, string>;
    
    // Logging
    enableLogging?: boolean;
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    customLogger?: (level: string, message: string, data?: any) => void;
    
    // Advanced
    customTools?: CustomToolDefinition[];
    pluginPaths?: string[];
    cacheEnabled?: boolean;
}

/**
 * Custom tool definition for external tools
 */
export interface CustomToolDefinition {
    name: string;
    description: string;
    category?: string;
    tags?: string[];
    complexity?: 'core' | 'advanced' | 'essential';
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    execute: (params: any, context: SDKExecutionContext) => Promise<any>;
}

/**
 * SDK execution context (simplified version of CliExecutionContext)
 */
export interface SDKExecutionContext {
    workingDirectory: string;
    sessionId: string;
    environment: Record<string, string>;
    userId?: string;
    requestId?: string;
    metadata?: Record<string, any>;
}

/**
 * SDK tool result (simplified)
 */
export interface SDKToolResult {
    success: boolean;
    data?: any;
    output?: string;
    error?: string;
    executionTime: number;
    metadata?: {
        toolName: string;
        healingApplied: boolean;
        normalizationApplied: boolean;
        retryCount: number;
    };
}

/**
 * Tool information for listing
 */
export interface SDKToolInfo {
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
        examples?: any[];
    }>;
}

/**
 * SDK statistics
 */
export interface SDKStats {
    totalTools: number;
    categoriesCount: number;
    executionStats: {
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        averageExecutionTime: number;
    };
    healingStats: {
        healingAttempts: number;
        healingSuccesses: number;
        commonIssues: Record<string, number>;
    };
    normalizationStats: {
        normalizationsApplied: number;
        modelsSupported: string[];
        fixesApplied: Record<string, number>;
    };
}

/**
 * Tool execution result with detailed information
 */
export interface ToolExecutionResult extends SDKToolResult {
    toolInfo: SDKToolInfo;
    context: SDKExecutionContext;
    logs?: Array<{
        level: string;
        message: string;
        timestamp: number;
        data?: any;
    }>;
}

/**
 * Healing result information
 */
export interface HealingResult {
    applied: boolean;
    strategy: 'none' | 'unescape' | 'llm_correction' | 'newstring_correction' | 'trim_optimization';
    originalError: string;
    fixedParameters?: any;
    confidence: number;
    executionTime: number;
    llmUsage?: {
        model: string;
        tokens: number;
        cost: number;
    };
}

/**
 * Normalization result information
 */
export interface NormalizationResult {
    applied: boolean;
    modelFamily: string;
    fixesApplied: Array<{
        toolName: string;
        issue: string;
        fix: string;
    }>;
    totalTools: number;
    normalizedTools: number;
    executionTime: number;
}

/**
 * Event types for SDK event system
 */
export interface SDKEvents {
    'tool.execution.start': {
        toolName: string;
        parameters: any;
        context: SDKExecutionContext;
    };
    'tool.execution.complete': ToolExecutionResult;
    'tool.execution.error': {
        toolName: string;
        error: string;
        parameters: any;
        context: SDKExecutionContext;
    };
    'healing.applied': HealingResult;
    'normalization.applied': NormalizationResult;
    'sdk.initialized': {
        config: SDKConfig;
        toolsLoaded: number;
    };
    'sdk.error': {
        message: string;
        stack?: string;
        context?: any;
    };
}

/**
 * Plugin interface for extending SDK
 */
export interface SDKPlugin {
    name: string;
    version: string;
    description: string;
    
    initialize(sdk: any): Promise<void> | void;
    cleanup?(): Promise<void> | void;
    
    // Optional hooks
    beforeToolExecution?(toolName: string, parameters: any): Promise<any> | any;
    afterToolExecution?(result: ToolExecutionResult): Promise<ToolExecutionResult> | ToolExecutionResult;
    onError?(error: Error, context: any): Promise<void> | void;
}

/**
 * Batch execution request
 */
export interface BatchExecutionRequest {
    operations: Array<{
        toolName: string;
        parameters: any;
        id?: string;
        dependsOn?: string[]; // IDs of operations this depends on
    }>;
    options?: {
        parallel?: boolean;
        stopOnError?: boolean;
        timeout?: number;
    };
}

/**
 * Batch execution result
 */
export interface BatchExecutionResult {
    success: boolean;
    results: Record<string, SDKToolResult>;
    errors: Record<string, string>;
    executionOrder: string[];
    totalExecutionTime: number;
    metadata: {
        totalOperations: number;
        successfulOperations: number;
        failedOperations: number;
        parallelExecution: boolean;
    };
}