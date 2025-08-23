/*---------------------------------------------------------------------------------------------
 * Tool Normalization System - Universal compatibility layer for LLM models
 * Transforms tool schemas to work across different AI models with different limitations
 *--------------------------------------------------------------------------------------------*/

import Ajv, { JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';

// Types and interfaces
export interface OpenAiFunctionTool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: JSONSchema;
    };
}

export interface JSONSchema {
    type?: string;
    properties?: Record<string, JSONSchema>;
    required?: string[];
    items?: JSONSchema | JSONSchema[];
    description?: string;
    enum?: any[];
    const?: any;
    default?: any;
    examples?: any[];
    
    // String constraints
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
    
    // Number constraints
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: boolean;
    exclusiveMaximum?: boolean;
    multipleOf?: number;
    
    // Object constraints
    minProperties?: number;
    maxProperties?: number;
    additionalProperties?: boolean | JSONSchema;
    patternProperties?: Record<string, JSONSchema>;
    propertyNames?: JSONSchema;
    
    // Array constraints
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    contains?: JSONSchema;
    minContains?: number;
    maxContains?: number;
    
    // Conditional schemas
    oneOf?: JSONSchema[];
    anyOf?: JSONSchema[];
    allOf?: JSONSchema[];
    not?: JSONSchema;
    if?: JSONSchema;
    then?: JSONSchema;
    else?: JSONSchema;
    
    // Additional properties
    unevaluatedProperties?: boolean | JSONSchema;
    unevaluatedItems?: boolean | JSONSchema;
    
    [key: string]: any;
}

export type NormalizationRule = (
    family: string,
    schema: JSONSchema | OpenAiFunctionTool['function'],
    onFix?: (message: string) => void
) => void;

export interface NormalizationMetrics {
    totalNormalizations: number;
    fixesAppliedByModel: Record<string, number>;
    mostCommonFixes: Record<string, number>;
    averageNormalizationTime: number;
    cacheHitRate: number;
    validationFailures: number;
    successfulNormalizations: number;
}

export interface NormalizationOptions {
    enableCache?: boolean;
    strictValidation?: boolean;
    logFixes?: boolean;
    maxDescriptionLength?: number;
}

// Lazy-loaded AJV validator
class LazyValidator {
    private _validator: Ajv | null = null;
    
    get value(): Ajv {
        if (!this._validator) {
            this._validator = new Ajv({
                coerceTypes: true,
                strictTypes: true,
                allowUnionTypes: true,
                verbose: true,
                allErrors: true
            });
            
            addFormats(this._validator);
            
            // Custom formats
            this._validator.addFormat('uri', (value: string) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            });
            
            this._validator.addFormat('regex', (value: string) => {
                try {
                    new RegExp(value);
                    return true;
                } catch {
                    return false;
                }
            });
        }
        
        return this._validator;
    }
}

const ajvValidator = new LazyValidator();

// Model family detection
const MODEL_FAMILIES = {
    GPT4: (family: string) => family.startsWith('gpt-4') || family.startsWith('gpt-4o'),
    CLAUDE: (family: string) => family.startsWith('claude-'),
    GEMINI: (family: string) => family.startsWith('gemini-'),
    O1: (family: string) => family.startsWith('o1-'),
    DEEPSEEK: (family: string) => family.startsWith('deepseek-') || family.includes('deepseek')
};

const isGpt4ish = (family: string): boolean => MODEL_FAMILIES.GPT4(family);
const isDraft2020_12Schema = (family: string): boolean =>
    MODEL_FAMILIES.GPT4(family) || 
    MODEL_FAMILIES.CLAUDE(family) || 
    MODEL_FAMILIES.O1(family) ||
    MODEL_FAMILIES.DEEPSEEK(family);

// Utility functions
function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as unknown as T;
    }
    
    const cloned: any = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone((obj as any)[key]);
        }
    }
    
    return cloned;
}

function forEachSchemaNode(schema: JSONSchema, callback: (node: JSONSchema, path: string) => void, path = ''): void {
    if (!schema || typeof schema !== 'object') return;
    
    callback(schema, path);
    
    // Recurse into properties
    if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
            forEachSchemaNode(prop, callback, `${path}.properties.${key}`);
        }
    }
    
    // Recurse into items
    if (schema.items) {
        if (Array.isArray(schema.items)) {
            schema.items.forEach((item, index) => {
                forEachSchemaNode(item, callback, `${path}.items[${index}]`);
            });
        } else {
            forEachSchemaNode(schema.items, callback, `${path}.items`);
        }
    }
    
    // Recurse into conditional schemas
    const conditionalKeys = ['oneOf', 'anyOf', 'allOf', 'not', 'if', 'then', 'else'];
    for (const key of conditionalKeys) {
        const value = (schema as any)[key];
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                forEachSchemaNode(item, callback, `${path}.${key}[${index}]`);
            });
        } else if (value && typeof value === 'object') {
            forEachSchemaNode(value, callback, `${path}.${key}`);
        }
    }
    
    // Recurse into additionalProperties
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        forEachSchemaNode(schema.additionalProperties, callback, `${path}.additionalProperties`);
    }
}

// Normalization rules for function schemas
const functionRules: NormalizationRule[] = [
    // Rule 1: Ensure schema is a proper object
    (_family, functionSchema, didFix) => {
        const func = functionSchema as OpenAiFunctionTool['function'];
        if (!func.parameters || func.parameters.type !== 'object') {
            func.parameters = { type: 'object', properties: {} };
            didFix?.('schema must be an object if present');
        }
        
        if (!func.parameters.properties) {
            func.parameters.properties = {};
            didFix?.('schema must have a properties object');
        }
    },
    
    // Rule 2: Ensure description is present
    (_family, functionSchema, didFix) => {
        const func = functionSchema as OpenAiFunctionTool['function'];
        if (!func.description || func.description.trim() === '') {
            func.description = 'No description provided';
            didFix?.('function description may not be empty');
        }
    },
    
    // Rule 3: DeepSeek function name constraints
    (family, functionSchema, didFix) => {
        if (!MODEL_FAMILIES.DEEPSEEK(family)) return;
        
        const func = functionSchema as OpenAiFunctionTool['function'];
        
        // DeepSeek function name constraints:
        // - Only a-z, A-Z, 0-9, underscores, dashes
        // - Maximum 64 characters
        const validNamePattern = /^[a-zA-Z0-9_-]+$/;
        const maxLength = 64;
        
        if (!validNamePattern.test(func.name)) {
            // Sanitize the name by replacing invalid characters with underscores
            const sanitizedName = func.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            func.name = sanitizedName;
            didFix?.(`sanitized function name to match DeepSeek constraints: ${sanitizedName}`);
        }
        
        if (func.name.length > maxLength) {
            const truncatedName = func.name.substring(0, maxLength);
            func.name = truncatedName;
            didFix?.(`truncated function name to ${maxLength} characters for DeepSeek: ${truncatedName}`);
        }
    }
];

// Normalization rules for JSON schemas
const jsonSchemaRules: NormalizationRule[] = [
    // Rule 1: Validate against JSON Schema
    (_family, schema, _onFix) => {
        const jsonSchema = schema as JSONSchema;
        if (!ajvValidator.value.validateSchema(jsonSchema)) {
            const errors = ajvValidator.value.errors
                ?.map(e => `${e.instancePath || 'root'} ${e.message}`)
                .join('\n') || 'Unknown validation error';
            throw new Error(`Tool parameters do not match JSON schema:\n${errors}`);
        }
    },
    
    // Rule 2: Arrays must have items
    (_family, schema, _onFix) => {
        const jsonSchema = schema as JSONSchema;
        forEachSchemaNode(jsonSchema, (node, path) => {
            if (node?.type === 'array' && !node.items) {
                throw new Error(`Array type at ${path || 'root'} must have items property`);
            }
        });
    },
    
    // Rule 3: GPT-4 description length limitation
    (family, schema, onFix) => {
        if (!isGpt4ish(family)) return;
        
        const jsonSchema = schema as JSONSchema;
        const maxLength = 1024;
        
        forEachSchemaNode(jsonSchema, (node) => {
            if (node?.description && node.description.length > maxLength) {
                node.description = node.description.substring(0, maxLength);
                onFix?.(`description truncated to ${maxLength} chars`);
            }
        });
    },
    
    // Rule 4: GPT-4 unsupported keywords
    (family, schema, onFix) => {
        if (!isGpt4ish(family)) return;
        
        const jsonSchema = schema as JSONSchema;
        const unsupportedKeywords = [
            'minLength', 'maxLength', 'pattern', 'default', 'format',
            'minimum', 'maximum', 'multipleOf', 'patternProperties',
            'unevaluatedProperties', 'propertyNames', 'minProperties',
            'maxProperties', 'unevaluatedItems', 'contains',
            'minContains', 'maxContains', 'minItems', 'maxItems', 'uniqueItems'
        ];
        
        forEachSchemaNode(jsonSchema, (node) => {
            for (const keyword of unsupportedKeywords) {
                if (keyword in node) {
                    delete (node as any)[keyword];
                    onFix?.(`removed unsupported keyword '${keyword}'`);
                }
            }
        });
    },
    
    // Rule 5: Remove conditional schemas (not supported by most models)
    (_family, schema, onFix) => {
        const jsonSchema = schema as JSONSchema;
        const conditionalKeywords = ['oneOf', 'anyOf', 'allOf', 'not', 'if', 'then', 'else'];
        
        for (const keyword of conditionalKeywords) {
            if (jsonSchema.hasOwnProperty(keyword)) {
                delete (jsonSchema as any)[keyword];
                onFix?.(`removed unsupported conditional keyword '${keyword}'`);
            }
        }
        
        // Also remove from nested nodes
        forEachSchemaNode(jsonSchema, (node) => {
            for (const keyword of conditionalKeywords) {
                if (node.hasOwnProperty(keyword)) {
                    delete (node as any)[keyword];
                    onFix?.(`removed unsupported conditional keyword '${keyword}' from nested schema`);
                }
            }
        });
    },
    
    // Rule 6: DeepSeek specific constraints
    (family, schema, onFix) => {
        if (!MODEL_FAMILIES.DEEPSEEK(family)) return;
        
        const jsonSchema = schema as JSONSchema;
        
        // DeepSeek has specific function name constraints
        // Function names must be a-z, A-Z, 0-9, underscores, dashes, max 64 chars
        // This applies to the function level, not schema level, but we validate here
        
        // Ensure robust JSON schema compliance for DeepSeek's strict mode
        forEachSchemaNode(jsonSchema, (node) => {
            // DeepSeek can hallucinate parameters - ensure strict property definitions
            if (node?.type === 'object' && node.properties) {
                // Add additionalProperties: false to prevent hallucinated parameters
                if (node.additionalProperties === undefined) {
                    node.additionalProperties = false;
                    onFix?.('added additionalProperties: false for DeepSeek strict mode compatibility');
                }
            }
            
            // DeepSeek recommends validation - ensure required fields are explicit
            if (node?.type === 'object' && node.properties && !node.required) {
                // Don't automatically add required fields, but ensure the structure is clear
                // This helps prevent hallucination of undefined properties
            }
        });
    },
    
    // Rule 7: Convert Draft 7 array items to Draft 2020-12 format
    (family, schema, onFix) => {
        if (!isDraft2020_12Schema(family)) return;
        
        const jsonSchema = schema as JSONSchema;
        forEachSchemaNode(jsonSchema, (node) => {
            if (node?.type === 'array' && Array.isArray(node.items)) {
                // Convert array of schemas to single schema with anyOf
                node.items = {
                    anyOf: node.items as JSONSchema[]
                };
                onFix?.('converted Draft 7 array items to Draft 2020-12 format');
            }
        });
    }
];

// Normalization cache
class NormalizationCache {
    private cache = new Map<string, OpenAiFunctionTool[]>();
    private hits = 0;
    private misses = 0;
    
    private generateCacheKey(modelFamily: string, tools: OpenAiFunctionTool[]): string {
        const toolsSignature = tools
            .map(t => `${t.function.name}:${JSON.stringify(t.function.parameters)}`)
            .join('|');
        
        return `${modelFamily}:${Buffer.from(toolsSignature).toString('base64')}`;
    }
    
    public get(modelFamily: string, tools: OpenAiFunctionTool[]): OpenAiFunctionTool[] | null {
        const key = this.generateCacheKey(modelFamily, tools);
        const result = this.cache.get(key);
        
        if (result) {
            this.hits++;
            return result;
        }
        
        this.misses++;
        return null;
    }
    
    public set(modelFamily: string, tools: OpenAiFunctionTool[], normalized: OpenAiFunctionTool[]): void {
        const key = this.generateCacheKey(modelFamily, tools);
        this.cache.set(key, normalized);
    }
    
    public clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
    
    public getHitRate(): number {
        const total = this.hits + this.misses;
        return total === 0 ? 0 : this.hits / total;
    }
    
    public getStats() {
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.getHitRate()
        };
    }
}

// Main normalizer class
export class ToolNormalizer {
    private cache: NormalizationCache;
    private metrics: NormalizationMetrics;
    private options: Required<NormalizationOptions>;
    
    constructor(options: NormalizationOptions = {}) {
        this.cache = new NormalizationCache();
        this.metrics = {
            totalNormalizations: 0,
            fixesAppliedByModel: {},
            mostCommonFixes: {},
            averageNormalizationTime: 0,
            cacheHitRate: 0,
            validationFailures: 0,
            successfulNormalizations: 0
        };
        
        this.options = {
            enableCache: true,
            strictValidation: true,
            logFixes: true,
            maxDescriptionLength: 1024,
            ...options
        };
    }
    
    public normalizeToolSchema(
        modelFamily: string,
        tools: OpenAiFunctionTool[],
        onFix?: (toolName: string, message: string) => void
    ): OpenAiFunctionTool[] {
        
        const startTime = performance.now();
        const fixes: Array<{ tool: string; message: string }> = [];
        
        try {
            // Check cache first
            if (this.options.enableCache) {
                const cached = this.cache.get(modelFamily, tools);
                if (cached) {
                    this.updateCacheMetrics();
                    return cached;
                }
            }
            
            const normalized: OpenAiFunctionTool[] = [];
            
            for (const tool of tools) {
                try {
                    // Clone to avoid modifying original
                    const cloned = deepClone(tool);
                    
                    // Apply function rules
                    for (const rule of functionRules) {
                        rule(modelFamily, cloned.function, (message) => {
                            fixes.push({ tool: tool.function.name, message });
                            if (this.options.logFixes) {
                                onFix?.(tool.function.name, message);
                            }
                        });
                    }
                    
                    // Apply JSON schema rules
                    if (cloned.function.parameters) {
                        for (const rule of jsonSchemaRules) {
                            rule(modelFamily, cloned.function.parameters, (message) => {
                                fixes.push({ tool: tool.function.name, message });
                                if (this.options.logFixes) {
                                    onFix?.(tool.function.name, message);
                                }
                            });
                        }
                    }
                    
                    normalized.push(cloned);
                } catch (error) {
                    this.metrics.validationFailures++;
                    throw new Error(`Failed to normalize tool '${tool.function.name}': ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            
            // Cache the result
            if (this.options.enableCache) {
                this.cache.set(modelFamily, tools, normalized);
            }
            
            // Update metrics
            this.updateMetrics(modelFamily, fixes, performance.now() - startTime);
            this.metrics.successfulNormalizations++;
            
            return normalized;
            
        } catch (error) {
            this.metrics.validationFailures++;
            throw error;
        }
    }
    
    private updateMetrics(modelFamily: string, fixes: Array<{ tool: string; message: string }>, duration: number): void {
        this.metrics.totalNormalizations++;
        
        // Update fixes by model
        this.metrics.fixesAppliedByModel[modelFamily] = 
            (this.metrics.fixesAppliedByModel[modelFamily] || 0) + fixes.length;
        
        // Update most common fixes
        fixes.forEach(fix => {
            this.metrics.mostCommonFixes[fix.message] = 
                (this.metrics.mostCommonFixes[fix.message] || 0) + 1;
        });
        
        // Update average time
        this.metrics.averageNormalizationTime = 
            (this.metrics.averageNormalizationTime * (this.metrics.totalNormalizations - 1) + duration) / 
            this.metrics.totalNormalizations;
    }
    
    private updateCacheMetrics(): void {
        this.metrics.cacheHitRate = this.cache.getHitRate();
    }
    
    public getMetrics(): NormalizationMetrics {
        this.updateCacheMetrics();
        return { ...this.metrics };
    }
    
    public clearCache(): void {
        this.cache.clear();
    }
    
    public getCacheStats() {
        return this.cache.getStats();
    }
    
    public static validate(schema: JSONSchema): boolean {
        try {
            const result = ajvValidator.value.validateSchema(schema);
            return typeof result === 'boolean' ? result : true;
        } catch {
            return false;
        }
    }
    
    public static getModelLimitations(modelFamily: string): string[] {
        const limitations: string[] = [];
        
        if (isGpt4ish(modelFamily)) {
            limitations.push(
                'Description length limited to 1024 characters',
                'String validation keywords not supported (minLength, maxLength, pattern, etc.)',
                'Number validation keywords not supported (minimum, maximum, etc.)',
                'Object/array size constraints not supported',
                'Complex validation patterns not supported'
            );
        }
        
        if (MODEL_FAMILIES.CLAUDE(modelFamily)) {
            limitations.push(
                'Conditional schemas not supported (oneOf, anyOf, allOf, not)',
                'Complex nested validation patterns have limited support'
            );
        }
        
        if (MODEL_FAMILIES.DEEPSEEK(modelFamily)) {
            limitations.push(
                'Function names limited to a-z, A-Z, 0-9, underscores, and dashes',
                'Function names maximum 64 characters',
                'Maximum 128 functions per request',
                'Model may hallucinate parameters not defined in schema',
                'Strict mode recommended for JSON schema compliance',
                'additionalProperties: false recommended to prevent hallucination'
            );
        }
        
        return limitations;
    }
}

// Convenience function for standalone use
export function normalizeToolSchema(
    modelFamily: string,
    tools: OpenAiFunctionTool[],
    onFix?: (toolName: string, message: string) => void
): OpenAiFunctionTool[] {
    const normalizer = new ToolNormalizer();
    return normalizer.normalizeToolSchema(modelFamily, tools, onFix);
}

// Export types and utilities
export { MODEL_FAMILIES, isGpt4ish, isDraft2020_12Schema };
export default ToolNormalizer;