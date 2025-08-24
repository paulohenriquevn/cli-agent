/*---------------------------------------------------------------------------------------------
 * SDK Utilities - Helper functions for SDK operations
 *--------------------------------------------------------------------------------------------*/

import { SDKConfig, SDKExecutionContext } from '../types/sdkTypes';

/**
 * Create default SDK configuration
 */
export function createDefaultSDKConfig(): SDKConfig {
    return {
        defaultModel: 'gpt-4o-mini',
        temperature: 0.1,
        maxTokens: 4000,
        enableHealing: true,
        enableNormalization: true,
        healingTimeout: 30000,
        toolCallLimit: 10,
        workingDirectory: process.cwd(),
        sessionId: `sdk-session-${Date.now()}`,
        environment: process.env as Record<string, string>,
        enableLogging: true,
        logLevel: 'info',
        customTools: [],
        pluginPaths: [],
        cacheEnabled: true
    };
}

/**
 * Validate SDK configuration
 */
export function validateSDKConfig(config: SDKConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields that depend on features
    if (config.enableHealing && !config.openRouterApiKey && !process.env.OPENROUTER_API_KEY) {
        warnings.push('Healing is enabled but no OpenRouter API key provided');
    }

    // Validate model
    if (config.defaultModel) {
        const supportedModels = ['gpt-4o-mini', 'gpt-4o', 'claude-3-sonnet', 'gemini-pro'];
        if (!supportedModels.includes(config.defaultModel)) {
            warnings.push(`Model '${config.defaultModel}' may not be supported`);
        }
    }

    // Validate temperature
    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
        errors.push('Temperature must be between 0 and 1');
    }

    // Validate token limits
    if (config.maxTokens !== undefined && config.maxTokens <= 0) {
        errors.push('maxTokens must be positive');
    }

    // Validate timeouts
    if (config.healingTimeout !== undefined && config.healingTimeout <= 0) {
        errors.push('healingTimeout must be positive');
    }

    // Validate tool call limit
    if (config.toolCallLimit !== undefined && config.toolCallLimit <= 0) {
        errors.push('toolCallLimit must be positive');
    }

    // Validate custom tools
    if (config.customTools) {
        for (const tool of config.customTools) {
            if (!tool.name) {
                errors.push('Custom tool missing name');
            }
            if (!tool.description) {
                warnings.push(`Custom tool '${tool.name}' missing description`);
            }
            if (!tool.execute || typeof tool.execute !== 'function') {
                errors.push(`Custom tool '${tool.name}' missing execute function`);
            }
            if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
                errors.push(`Custom tool '${tool.name}' missing valid inputSchema`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Create execution context from partial context and config
 */
export function createExecutionContext(
    partial?: Partial<SDKExecutionContext>,
    config?: SDKConfig
): SDKExecutionContext {
    const defaultContext: SDKExecutionContext = {
        workingDirectory: config?.workingDirectory || process.cwd(),
        sessionId: config?.sessionId || `sdk-session-${Date.now()}`,
        environment: config?.environment || (process.env as Record<string, string>),
        requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    return {
        ...defaultContext,
        ...partial
    };
}

/**
 * Parse tool name and parameters from various input formats
 */
export function parseToolInput(input: string | { tool: string; params: any }): {
    toolName: string;
    parameters: any;
} {
    if (typeof input === 'string') {
        // Parse command-line style input: "toolName --param1=value1 --param2=value2"
        const parts = input.trim().split(/\s+/);
        const toolName = parts[0];
        const parameters: any = {};

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part.startsWith('--')) {
                const [key, ...valueParts] = part.substring(2).split('=');
                const value = valueParts.join('=');
                parameters[key] = parseValue(value);
            }
        }

        return { toolName, parameters };
    }

    return {
        toolName: input.tool,
        parameters: input.params || {}
    };
}

/**
 * Parse string value to appropriate type
 */
function parseValue(value: string): any {
    if (!value) return '';
    
    // Boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
        return value.includes('.') ? parseFloat(value) : parseInt(value, 10);
    }
    
    // JSON
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
        try {
            return JSON.parse(value);
        } catch {
            // Fall through to string
        }
    }
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    
    return value;
}

/**
 * Create a cancellation token that can be cancelled after timeout
 */
export function createTimeoutToken(timeoutMs: number): {
    token: { isCancelled: boolean };
    cancel: () => void;
    cleanup: () => void;
} {
    let isCancelled = false;
    let timeoutId: NodeJS.Timeout;

    const token = {
        get isCancelled() {
            return isCancelled;
        }
    };

    const cancel = () => {
        isCancelled = true;
    };

    const cleanup = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    };

    timeoutId = setTimeout(cancel, timeoutMs);

    return { token, cancel, cleanup };
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 10000
): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (attempt === maxRetries) {
                throw lastError;
            }

            const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (isObject(sourceValue) && isObject(targetValue)) {
            result[key] = deepMerge(targetValue, sourceValue as Partial<typeof targetValue>);
        } else if (sourceValue !== undefined) {
            result[key] = sourceValue as T[Extract<keyof T, string>];
        }
    }

    return result;
}

/**
 * Check if value is a plain object
 */
function isObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Sanitize parameters for logging (remove sensitive data)
 */
export function sanitizeForLogging(params: any): any {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'apiKey', 'auth'];
    
    if (typeof params !== 'object' || params === null) {
        return params;
    }

    if (Array.isArray(params)) {
        return params.map(sanitizeForLogging);
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(params)) {
        const keyLower = key.toLowerCase();
        const isSensitive = sensitiveKeys.some(sensitive => keyLower.includes(sensitive));
        
        if (isSensitive) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeForLogging(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/**
 * Generate unique identifier
 */
export function generateId(prefix: string = 'id'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Validate execution context
 */
export function validateExecutionContext(context: SDKExecutionContext): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!context.workingDirectory) {
        errors.push('workingDirectory is required');
    }

    if (!context.sessionId) {
        errors.push('sessionId is required');
    }

    if (!context.environment) {
        errors.push('environment is required');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}