/*---------------------------------------------------------------------------------------------
 * Validation and Sanitization Layer - Comprehensive input/output validation
 *--------------------------------------------------------------------------------------------*/

import { 
    IToolCall, 
    IToolCallingLoopOptions,
    LanguageModelToolInformation,
    LanguageModelToolResult2,
    Raw
} from './types';
import { DisposableBase } from './pauseController';

/**
 * Resultado de validação
 */
export interface ValidationResult<T = any> {
    valid: boolean;
    data?: T;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    sanitized?: boolean;
}

/**
 * Erro de validação
 */
export interface ValidationError {
    field: string;
    code: string;
    message: string;
    severity: 'error' | 'critical';
    metadata?: Record<string, any>;
}

/**
 * Warning de validação
 */
export interface ValidationWarning {
    field: string;
    code: string;
    message: string;
    suggestion?: string;
    metadata?: Record<string, any>;
}

/**
 * Configuração de validação
 */
export interface ValidationConfig {
    // Limites de entrada
    maxToolNameLength: number;
    maxArgumentsLength: number;
    maxContentLength: number;
    maxToolCallsPerRound: number;
    
    // Sanitização
    enableSanitization: boolean;
    allowHTMLInArguments: boolean;
    allowScriptsInArguments: boolean;
    
    // Validação de schema
    strictSchemaValidation: boolean;
    allowAdditionalProperties: boolean;
    
    // Segurança
    blockSensitivePatterns: boolean;
    sensitivePatterns: string[];
    
    // Performance
    enableAsyncValidation: boolean;
    validationTimeout: number;
}

/**
 * Schema de validação JSON
 */
export interface ValidationSchema {
    type: string;
    properties?: Record<string, ValidationSchema>;
    required?: string[];
    items?: ValidationSchema;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: any[];
    additionalProperties?: boolean | ValidationSchema;
}

/**
 * Contexto de validação
 */
export interface ValidationContext {
    toolName?: string;
    roundNumber?: number;
    executionId?: string;
    parentCallId?: string;
    metadata?: Record<string, any>;
}

/**
 * Validador principal para tool calling system
 */
export class ToolCallingValidator extends DisposableBase {
    private readonly config: ValidationConfig;
    private readonly schemaCache = new Map<string, ValidationSchema>();
    private readonly validationStats = {
        totalValidations: 0,
        successfulValidations: 0,
        errors: 0,
        warnings: 0,
        sanitizations: 0
    };

    constructor(config?: Partial<ValidationConfig>) {
        super();
        
        this.config = {
            maxToolNameLength: 100,
            maxArgumentsLength: 100000, // 100KB
            maxContentLength: 1000000,  // 1MB
            maxToolCallsPerRound: 50,
            enableSanitization: true,
            allowHTMLInArguments: false,
            allowScriptsInArguments: false,
            strictSchemaValidation: true,
            allowAdditionalProperties: false,
            blockSensitivePatterns: true,
            sensitivePatterns: [
                'password', 'secret', 'token', 'key', 'credential',
                'ssh', 'private', 'confidential', 'api_key'
            ],
            enableAsyncValidation: true,
            validationTimeout: 5000,
            ...config
        };
    }

    /**
     * Valida opções do tool calling loop
     */
    validateOptions(options: IToolCallingLoopOptions): ValidationResult<IToolCallingLoopOptions> {
        this.validationStats.totalValidations++;
        
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        let sanitized = false;
        
        // Validação de limites
        if (options.toolCallLimit <= 0 || options.toolCallLimit > 1000) {
            errors.push({
                field: 'toolCallLimit',
                code: 'INVALID_RANGE',
                message: 'Tool call limit must be between 1 and 1000',
                severity: 'error'
            });
        }

        // Validação de modelo
        if (!options.model?.family || !options.model?.name) {
            errors.push({
                field: 'model',
                code: 'REQUIRED_FIELD',
                message: 'Model family and name are required',
                severity: 'error'
            });
        }

        // Warnings para configurações de performance
        if (options.enableStreaming && options.toolCallLimit > 20) {
            warnings.push({
                field: 'performance',
                code: 'PERFORMANCE_WARNING',
                message: 'High tool call limit with streaming enabled may impact performance',
                suggestion: 'Consider reducing toolCallLimit or disabling streaming'
            });
        }

        const result = this.createValidationResult(
            errors.length === 0,
            options,
            errors,
            warnings,
            sanitized
        );

        if (result.valid) {
            this.validationStats.successfulValidations++;
        } else {
            this.validationStats.errors++;
        }

        if (warnings.length > 0) {
            this.validationStats.warnings++;
        }

        return result;
    }

    /**
     * Valida tool call individual
     */
    validateToolCall(
        toolCall: IToolCall, 
        context?: ValidationContext
    ): ValidationResult<IToolCall> {
        this.validationStats.totalValidations++;
        
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        let sanitizedCall = { ...toolCall };
        let sanitized = false;

        // Validação básica de campos obrigatórios
        if (!toolCall.id || typeof toolCall.id !== 'string') {
            errors.push({
                field: 'id',
                code: 'REQUIRED_FIELD',
                message: 'Tool call ID is required and must be a string',
                severity: 'error'
            });
        }

        if (!toolCall.name || typeof toolCall.name !== 'string') {
            errors.push({
                field: 'name',
                code: 'REQUIRED_FIELD', 
                message: 'Tool name is required and must be a string',
                severity: 'error'
            });
        } else {
            // Validação de comprimento do nome
            if (toolCall.name.length > this.config.maxToolNameLength) {
                errors.push({
                    field: 'name',
                    code: 'LENGTH_EXCEEDED',
                    message: `Tool name exceeds maximum length of ${this.config.maxToolNameLength}`,
                    severity: 'error'
                });
            }

            // Sanitização do nome
            if (this.config.enableSanitization) {
                const sanitizedName = this.sanitizeString(toolCall.name);
                if (sanitizedName !== toolCall.name) {
                    sanitizedCall.name = sanitizedName;
                    sanitized = true;
                    warnings.push({
                        field: 'name',
                        code: 'SANITIZED',
                        message: 'Tool name was sanitized',
                        suggestion: 'Review sanitized tool name'
                    });
                }
            }
        }

        // Validação dos argumentos
        if (typeof toolCall.arguments !== 'string') {
            errors.push({
                field: 'arguments',
                code: 'INVALID_TYPE',
                message: 'Tool arguments must be a string',
                severity: 'error'
            });
        } else {
            // Validação de comprimento
            if (toolCall.arguments.length > this.config.maxArgumentsLength) {
                errors.push({
                    field: 'arguments',
                    code: 'LENGTH_EXCEEDED',
                    message: `Arguments exceed maximum length of ${this.config.maxArgumentsLength}`,
                    severity: 'error'
                });
            }

            // Validação de JSON
            try {
                const parsed = JSON.parse(toolCall.arguments);
                
                // Validação de segurança
                if (this.config.blockSensitivePatterns) {
                    const sensitiveFields = this.detectSensitiveData(parsed);
                    if (sensitiveFields.length > 0) {
                        warnings.push({
                            field: 'arguments',
                            code: 'SENSITIVE_DATA_DETECTED',
                            message: `Potentially sensitive fields detected: ${sensitiveFields.join(', ')}`,
                            suggestion: 'Review sensitive data before processing',
                            metadata: { sensitiveFields }
                        });
                    }
                }

                // Sanitização de argumentos
                if (this.config.enableSanitization) {
                    const sanitizedArgs = this.sanitizeArguments(parsed);
                    const sanitizedArgsString = JSON.stringify(sanitizedArgs);
                    if (sanitizedArgsString !== toolCall.arguments) {
                        sanitizedCall.arguments = sanitizedArgsString;
                        sanitized = true;
                        warnings.push({
                            field: 'arguments',
                            code: 'SANITIZED',
                            message: 'Tool arguments were sanitized',
                            suggestion: 'Review sanitized arguments'
                        });
                    }
                }
            } catch (error) {
                errors.push({
                    field: 'arguments',
                    code: 'INVALID_JSON',
                    message: `Invalid JSON in arguments: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    severity: 'error'
                });
            }
        }

        const result = this.createValidationResult(
            errors.length === 0,
            sanitizedCall,
            errors,
            warnings,
            sanitized
        );

        if (result.valid) {
            this.validationStats.successfulValidations++;
        } else {
            this.validationStats.errors++;
        }

        if (warnings.length > 0) {
            this.validationStats.warnings++;
        }

        if (sanitized) {
            this.validationStats.sanitizations++;
        }

        return result;
    }

    /**
     * Valida array de tool calls
     */
    validateToolCalls(
        toolCalls: IToolCall[],
        context?: ValidationContext
    ): ValidationResult<IToolCall[]> {
        this.validationStats.totalValidations++;
        
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const sanitizedCalls: IToolCall[] = [];
        let sanitized = false;

        // Validação de limites
        if (toolCalls.length > this.config.maxToolCallsPerRound) {
            errors.push({
                field: 'toolCalls',
                code: 'LENGTH_EXCEEDED',
                message: `Number of tool calls (${toolCalls.length}) exceeds maximum per round (${this.config.maxToolCallsPerRound})`,
                severity: 'error'
            });
        }

        // Validação de IDs únicos
        const ids = new Set<string>();
        const duplicateIds: string[] = [];
        
        for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];
            
            if (ids.has(toolCall.id)) {
                duplicateIds.push(toolCall.id);
            } else {
                ids.add(toolCall.id);
            }

            // Valida tool call individual
            const validation = this.validateToolCall(toolCall, { 
                ...context, 
                metadata: { ...context?.metadata, index: i } 
            });
            
            if (!validation.valid) {
                // Adiciona erros com contexto de índice
                for (const error of validation.errors) {
                    errors.push({
                        ...error,
                        field: `toolCalls[${i}].${error.field}`,
                        metadata: { ...error.metadata, index: i }
                    });
                }
            }
            
            // Adiciona warnings
            for (const warning of validation.warnings) {
                warnings.push({
                    ...warning,
                    field: `toolCalls[${i}].${warning.field}`,
                    metadata: { ...warning.metadata, index: i }
                });
            }

            // Coleta dados sanitizados
            if (validation.data && validation.sanitized) {
                sanitizedCalls.push(validation.data);
                sanitized = true;
            } else {
                sanitizedCalls.push(toolCall);
            }
        }

        // Reporta IDs duplicados
        if (duplicateIds.length > 0) {
            errors.push({
                field: 'toolCalls',
                code: 'DUPLICATE_IDS',
                message: `Duplicate tool call IDs detected: ${duplicateIds.join(', ')}`,
                severity: 'error',
                metadata: { duplicateIds }
            });
        }

        const result = this.createValidationResult(
            errors.length === 0,
            sanitizedCalls,
            errors,
            warnings,
            sanitized
        );

        if (result.valid) {
            this.validationStats.successfulValidations++;
        } else {
            this.validationStats.errors++;
        }

        if (warnings.length > 0) {
            this.validationStats.warnings++;
        }

        if (sanitized) {
            this.validationStats.sanitizations++;
        }

        return result;
    }

    /**
     * Valida resultado de tool execution
     */
    validateToolResult(
        result: LanguageModelToolResult2,
        context?: ValidationContext
    ): ValidationResult<LanguageModelToolResult2> {
        this.validationStats.totalValidations++;
        
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        let sanitizedResult = { ...result };
        let sanitized = false;

        // Validação de campos obrigatórios
        if (typeof result.content !== 'string') {
            errors.push({
                field: 'content',
                code: 'INVALID_TYPE',
                message: 'Tool result content must be a string',
                severity: 'error'
            });
        } else {
            // Validação de comprimento
            if (result.content.length > this.config.maxContentLength) {
                errors.push({
                    field: 'content',
                    code: 'LENGTH_EXCEEDED',
                    message: `Content exceeds maximum length of ${this.config.maxContentLength}`,
                    severity: 'error'
                });
            }

            // Sanitização de conteúdo
            if (this.config.enableSanitization) {
                const sanitizedContent = this.sanitizeString(result.content);
                if (sanitizedContent !== result.content) {
                    sanitizedResult.content = sanitizedContent;
                    sanitized = true;
                    warnings.push({
                        field: 'content',
                        code: 'SANITIZED',
                        message: 'Tool result content was sanitized',
                        suggestion: 'Review sanitized content'
                    });
                }
            }
        }

        if (typeof result.success !== 'boolean') {
            errors.push({
                field: 'success',
                code: 'INVALID_TYPE',
                message: 'Tool result success flag must be a boolean',
                severity: 'error'
            });
        }

        if (typeof result.executionTime !== 'number' || result.executionTime < 0) {
            errors.push({
                field: 'executionTime',
                code: 'INVALID_VALUE',
                message: 'Execution time must be a non-negative number',
                severity: 'error'
            });
        }

        // Warning para execução muito lenta
        if (result.executionTime > 30000) { // 30 segundos
            warnings.push({
                field: 'executionTime',
                code: 'SLOW_EXECUTION',
                message: `Tool execution took ${result.executionTime}ms, which is unusually long`,
                suggestion: 'Review tool implementation for performance optimization'
            });
        }

        const validation = this.createValidationResult(
            errors.length === 0,
            sanitizedResult,
            errors,
            warnings,
            sanitized
        );

        if (validation.valid) {
            this.validationStats.successfulValidations++;
        } else {
            this.validationStats.errors++;
        }

        if (warnings.length > 0) {
            this.validationStats.warnings++;
        }

        if (sanitized) {
            this.validationStats.sanitizations++;
        }

        return validation;
    }

    /**
     * Valida schema de tool contra definição
     */
    validateAgainstSchema(
        data: any,
        schema: ValidationSchema,
        context?: ValidationContext
    ): ValidationResult<any> {
        this.validationStats.totalValidations++;
        
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        this.validateSchemaRecursive(data, schema, '', errors, warnings);

        const result = this.createValidationResult(
            errors.length === 0,
            data,
            errors,
            warnings,
            false
        );

        if (result.valid) {
            this.validationStats.successfulValidations++;
        } else {
            this.validationStats.errors++;
        }

        if (warnings.length > 0) {
            this.validationStats.warnings++;
        }

        return result;
    }

    /**
     * Sanitiza string removendo conteúdo perigoso
     */
    private sanitizeString(input: string): string {
        if (!this.config.enableSanitization) return input;

        let sanitized = input;

        // Remove scripts se não permitido
        if (!this.config.allowScriptsInArguments) {
            sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            sanitized = sanitized.replace(/javascript:/gi, '');
        }

        // Remove HTML se não permitido
        if (!this.config.allowHTMLInArguments) {
            sanitized = sanitized.replace(/<[^>]*>/g, '');
        }

        // Remove caracteres de controle
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

        return sanitized.trim();
    }

    /**
     * Sanitiza argumentos JSON
     */
    private sanitizeArguments(args: any): any {
        if (typeof args === 'string') {
            return this.sanitizeString(args);
        }

        if (Array.isArray(args)) {
            return args.map(item => this.sanitizeArguments(item));
        }

        if (args && typeof args === 'object') {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(args)) {
                const sanitizedKey = this.sanitizeString(key);
                sanitized[sanitizedKey] = this.sanitizeArguments(value);
            }
            return sanitized;
        }

        return args;
    }

    /**
     * Detecta dados sensíveis em objeto
     */
    private detectSensitiveData(obj: any, path = ''): string[] {
        const sensitiveFields: string[] = [];

        if (typeof obj === 'object' && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                const keyLower = key.toLowerCase();
                
                // Verifica se a chave contém padrões sensíveis
                if (this.config.sensitivePatterns.some(pattern => keyLower.includes(pattern))) {
                    sensitiveFields.push(currentPath);
                }

                // Recursão para objetos aninhados
                if (typeof value === 'object' && value !== null) {
                    sensitiveFields.push(...this.detectSensitiveData(value, currentPath));
                }
            }
        }

        return sensitiveFields;
    }

    /**
     * Validação recursiva de schema
     */
    private validateSchemaRecursive(
        data: any,
        schema: ValidationSchema,
        path: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        // Validação de tipo
        if (schema.type && typeof data !== schema.type) {
            errors.push({
                field: path || 'root',
                code: 'TYPE_MISMATCH',
                message: `Expected ${schema.type}, got ${typeof data}`,
                severity: 'error'
            });
            return;
        }

        // Validação específica por tipo
        switch (schema.type) {
            case 'string':
                this.validateStringSchema(data, schema, path, errors, warnings);
                break;
            case 'number':
                this.validateNumberSchema(data, schema, path, errors, warnings);
                break;
            case 'object':
                this.validateObjectSchema(data, schema, path, errors, warnings);
                break;
            case 'array':
                this.validateArraySchema(data, schema, path, errors, warnings);
                break;
        }
    }

    private validateStringSchema(
        data: string,
        schema: ValidationSchema,
        path: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (schema.minLength && data.length < schema.minLength) {
            errors.push({
                field: path,
                code: 'MIN_LENGTH',
                message: `String length ${data.length} is below minimum ${schema.minLength}`,
                severity: 'error'
            });
        }

        if (schema.maxLength && data.length > schema.maxLength) {
            errors.push({
                field: path,
                code: 'MAX_LENGTH',
                message: `String length ${data.length} exceeds maximum ${schema.maxLength}`,
                severity: 'error'
            });
        }

        if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
            errors.push({
                field: path,
                code: 'PATTERN_MISMATCH',
                message: `String does not match required pattern: ${schema.pattern}`,
                severity: 'error'
            });
        }

        if (schema.enum && !schema.enum.includes(data)) {
            errors.push({
                field: path,
                code: 'ENUM_MISMATCH',
                message: `Value "${data}" is not in allowed enum values: ${schema.enum.join(', ')}`,
                severity: 'error'
            });
        }
    }

    private validateNumberSchema(
        data: number,
        schema: ValidationSchema,
        path: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (schema.minimum !== undefined && data < schema.minimum) {
            errors.push({
                field: path,
                code: 'MIN_VALUE',
                message: `Value ${data} is below minimum ${schema.minimum}`,
                severity: 'error'
            });
        }

        if (schema.maximum !== undefined && data > schema.maximum) {
            errors.push({
                field: path,
                code: 'MAX_VALUE',
                message: `Value ${data} exceeds maximum ${schema.maximum}`,
                severity: 'error'
            });
        }
    }

    private validateObjectSchema(
        data: object,
        schema: ValidationSchema,
        path: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (!schema.properties) return;

        // Valida campos obrigatórios
        if (schema.required) {
            for (const required of schema.required) {
                if (!(required in data)) {
                    errors.push({
                        field: path ? `${path}.${required}` : required,
                        code: 'REQUIRED_FIELD',
                        message: `Required field "${required}" is missing`,
                        severity: 'error'
                    });
                }
            }
        }

        // Valida propriedades
        for (const [key, value] of Object.entries(data)) {
            const propertySchema = schema.properties[key];
            const propertyPath = path ? `${path}.${key}` : key;

            if (propertySchema) {
                this.validateSchemaRecursive(value, propertySchema, propertyPath, errors, warnings);
            } else if (!this.config.allowAdditionalProperties && schema.additionalProperties === false) {
                warnings.push({
                    field: propertyPath,
                    code: 'ADDITIONAL_PROPERTY',
                    message: `Property "${key}" is not defined in schema`,
                    suggestion: 'Remove undefined property or update schema'
                });
            }
        }
    }

    private validateArraySchema(
        data: any[],
        schema: ValidationSchema,
        path: string,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (schema.items) {
            data.forEach((item, index) => {
                this.validateSchemaRecursive(
                    item,
                    schema.items!,
                    `${path}[${index}]`,
                    errors,
                    warnings
                );
            });
        }
    }

    /**
     * Cria resultado de validação
     */
    private createValidationResult<T>(
        valid: boolean,
        data: T,
        errors: ValidationError[],
        warnings: ValidationWarning[],
        sanitized: boolean
    ): ValidationResult<T> {
        return {
            valid,
            data: valid ? data : undefined,
            errors,
            warnings,
            sanitized
        };
    }

    /**
     * Obtém estatísticas de validação
     */
    getStats() {
        return { ...this.validationStats };
    }

    /**
     * Reset das estatísticas
     */
    resetStats(): void {
        Object.keys(this.validationStats).forEach(key => {
            (this.validationStats as any)[key] = 0;
        });
    }
}

/**
 * Factory para diferentes configurações de validação
 */
export class ValidationFactory {
    /**
     * Cria validador permissivo para desenvolvimento
     */
    static createPermissive(): ToolCallingValidator {
        return new ToolCallingValidator({
            enableSanitization: false,
            strictSchemaValidation: false,
            allowAdditionalProperties: true,
            blockSensitivePatterns: false,
            maxToolCallsPerRound: 100
        });
    }

    /**
     * Cria validador rigoroso para produção
     */
    static createStrict(): ToolCallingValidator {
        return new ToolCallingValidator({
            enableSanitization: true,
            strictSchemaValidation: true,
            allowAdditionalProperties: false,
            blockSensitivePatterns: true,
            allowHTMLInArguments: false,
            allowScriptsInArguments: false,
            maxToolCallsPerRound: 20
        });
    }

    /**
     * Cria validador balanceado
     */
    static createBalanced(): ToolCallingValidator {
        return new ToolCallingValidator({
            enableSanitization: true,
            strictSchemaValidation: true,
            allowAdditionalProperties: true,
            blockSensitivePatterns: true,
            allowHTMLInArguments: false,
            allowScriptsInArguments: false,
            maxToolCallsPerRound: 50
        });
    }
}