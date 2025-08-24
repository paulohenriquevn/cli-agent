/*---------------------------------------------------------------------------------------------
 * Tools Service - Camada de serviço para gerenciamento de tools (CLI puro - SEM VS Code)
 *--------------------------------------------------------------------------------------------*/

import { LanguageModelToolInformation, LanguageModelToolResult2 } from '../execution/types';
import { PauseController } from '../execution/pauseController';
import { 
    ToolRegistry, 
    BaseToolCtor, 
    IToolValidationResult
} from './toolRegistry';
import { BaseTool, IToolParams } from '../base/baseTool';
import { CliToolInvocationOptions as ToolInvocationOptions } from '../types/cliTypes';
import { HealingIntegration } from '../healing';

/**
 * Interface para requests CLI
 */
export interface CliRequest {
    query: string;
    context?: {
        workingDirectory: string;
        files?: string[];
        environment?: Record<string, string>;
    };
    options?: {
        timeout?: number;
        verbose?: boolean;
        dryRun?: boolean;
    };
    metadata?: Record<string, any>;
}

/**
 * Função de filtro de tools
 */
export type ToolFilter = (tool: LanguageModelToolInformation) => boolean | undefined;

/**
 * Service de gerenciamento de tools
 */
export interface IToolsService {
    /**
     * Todas as tools disponíveis
     */
    readonly tools: ReadonlyArray<LanguageModelToolInformation>;

    /**
     * Tools registradas no sistema
     */
    readonly baseTools: ReadonlyMap<string, BaseTool<any>>;

    /**
     * Busca tool por nome
     */
    getTool(name: string): LanguageModelToolInformation | undefined;

    /**
     * Busca tool por nome
     */
    getBaseTool(name: string): BaseTool<any> | undefined;

    /**
     * Executa tool
     */
    invokeTool(
        name: string, 
        options: ToolInvocationOptions<unknown>, 
        token?: PauseController
    ): Promise<LanguageModelToolResult2>;

    /**
     * Valida input de tool
     */
    validateToolInput(name: string, input: string): IToolValidationResult;

    /**
     * Obtém tools habilitadas com filtro
     */
    getEnabledTools(
        request: CliRequest, 
        filter?: ToolFilter
    ): LanguageModelToolInformation[];

    /**
     * Instancia tool
     */
    createToolInstance(name: string, ...args: any[]): BaseTool<any> | undefined;

    /**
     * Obtém estatísticas do service
     */
    getStats(): {
        totalTools: number;
        enabledTools: number;
        toolsWithHealing: number;
        categoriesCovered: string[];
        registrationErrors: number;
    };

    /**
     * Recarrega tools do registry
     */
    reloadTools(): void;

    /**
     * Adiciona tool dinamicamente
     */
    addTool(toolCtor: BaseToolCtor): boolean;

    /**
     * Remove tool
     */
    removeTool(name: string): boolean;
}

/**
 * Implementação do ToolsService
 */
export class ToolsServiceImpl implements IToolsService {
    private readonly _baseTools = new Map<string, BaseTool<any>>();
    private readonly _toolInstances = new Map<string, BaseToolCtor>();
    private readonly _healingSystem?: any;

    constructor(healingSystem?: any) {
        this._healingSystem = healingSystem;
        this.initializeTools();
    }

    /**
     * Inicializa tools a partir do registry
     */
    private initializeTools(): void {
        console.log('🔧 Initializing tools service...');
        
        const registeredTools = ToolRegistry.getTools();
        
        for (const toolInstance of registeredTools) {
            try {
                // Registra instância no mapa de tools
                this._baseTools.set(toolInstance.name, toolInstance);
                
                console.log(`✅ Tool initialized: ${toolInstance.name}`);
            } catch (error) {
                console.error(`❌ Failed to initialize tool ${toolInstance.name}:`, error);
            }
        }
        
        console.log(`🎯 Initialized ${this._baseTools.size} tools`);
    }

    /**
     * Obtém todas as tools disponíveis
     */
    get tools(): ReadonlyArray<LanguageModelToolInformation> {
        const toolInfos: LanguageModelToolInformation[] = [];
        
        for (const [, tool] of this._baseTools) {
            toolInfos.push({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                tags: tool.tags
            });
        }
        
        return toolInfos;
    }

    /**
     * Obtém mapa de tools registradas
     */
    get baseTools(): ReadonlyMap<string, BaseTool<any>> {
        return this._baseTools;
    }

    /**
     * Busca tool por nome
     */
    getTool(name: string): LanguageModelToolInformation | undefined {
        const tool = this._baseTools.get(name);
        if (!tool) {return undefined;}

        return {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            tags: tool.tags
        };
    }

    /**
     * Busca tool por nome
     */
    getBaseTool(name: string): BaseTool<any> | undefined {
        return this._baseTools.get(name);
    }

    /**
     * Executa tool
     */
    async invokeTool(
        name: string,
        options: ToolInvocationOptions<unknown>,
        token?: PauseController
    ): Promise<LanguageModelToolResult2> {
        const tool = this.getBaseTool(name);
        if (!tool) {
            throw new Error(`Tool '${name}' not found`);
        }

        try {
            // Convert ToolInvocationOptions to CliToolInvocationOptions
            const cliOptions = {
                input: options.input,
                toolName: name,
                context: options.context || {
                    workingDirectory: process.cwd(),
                    environment: process.env,
                    sessionId: 'default',
                    user: { id: 'system', name: 'System' }
                }
            };
            
            // Create CLI cancellation token if PauseController provided
            const cliToken = token ? new (require('../types/cliTypes').CliCancellationToken)() : new (require('../types/cliTypes').CliCancellationToken)();
            
            const result = await tool.invoke(cliOptions, cliToken);
            
            // Convert result back to expected format
            return {
                content: result.content.map(part => part.value).join('\n'),
                success: true,
                executionTime: 0
            };
            
        } catch (error) {
            // Re-throw erro original
            throw error;
        }
    }

    /**
     * Tenta healing em caso de falha
     */
    private async attemptHealing(
        tool: BaseTool<any>,
        options: ToolInvocationOptions<unknown>,
        _originalError: any,
        _token?: PauseController
    ): Promise<LanguageModelToolResult2 | undefined> {
        if (!this._healingSystem) {return undefined;}

        // Determina tipo de healing baseado na tool
        if (tool.name.includes('edit') || tool.name.includes('replace')) {
            // Healing para string replace
            if (this._healingSystem.isHealingEnabled('string')) {
                return await this._healingSystem.healString(
                    options.input.uri,
                    options.input.oldString,
                    options.input.newString,
                    options.input.fileContent,
                    options.model
                );
            }
        } else if (tool.name.includes('patch') || tool.name.includes('apply')) {
            // Healing para patches
            if (this._healingSystem.isHealingEnabled('patch')) {
                return await this._healingSystem.healPatch(
                    options.input.patch,
                    options.input.docText,
                    options.input.explanation || ''
                );
            }
        }

        return undefined;
    }

    /**
     * Valida input de tool
     */
    validateToolInput(name: string, input: string): IToolValidationResult {
        const tool = this.getBaseTool(name);
        if (!tool) {
            return {
                valid: false,
                errors: [{
                    field: 'tool',
                    message: `Tool '${name}' not found`,
                    severity: 'error'
                }]
            };
        }

        try {
            // Tenta parsear como JSON se tool espera objeto
            let parsedInput: any = input;
            if (tool.inputSchema && typeof input === 'string') {
                try {
                    parsedInput = JSON.parse(input);
                } catch {
                    return {
                        valid: false,
                        errors: [{
                            field: 'input',
                            message: 'Input must be valid JSON',
                            severity: 'error'
                        }]
                    };
                }
            }

            // Validação básica
            const errors: IToolValidationResult['errors'] = [];
            
            // Verifica se input está presente
            if (parsedInput === undefined || parsedInput === null) {
                errors.push({
                    field: 'input',
                    message: 'Input is required',
                    severity: 'error'
                });
            }

            // Validação de schema (se disponível)
            if (tool.inputSchema && parsedInput) {
                const schemaErrors = this.validateAgainstSchema(parsedInput, tool.inputSchema);
                errors.push(...schemaErrors);
            }

            return {
                valid: errors.length === 0,
                errors,
                sanitizedInput: parsedInput
            };

        } catch (error) {
            return {
                valid: false,
                errors: [{
                    field: 'validation',
                    message: error instanceof Error ? error.message : 'Validation failed',
                    severity: 'error'
                }]
            };
        }
    }

    /**
     * Valida input contra schema
     */
    private validateAgainstSchema(input: any, schema: any): IToolValidationResult['errors'] {
        const errors: IToolValidationResult['errors'] = [];
        
        // Validação básica de tipos
        if (schema.type) {
            const actualType = typeof input;
            if (actualType !== schema.type) {
                errors.push({
                    field: 'type',
                    message: `Expected type ${schema.type}, got ${actualType}`,
                    severity: 'error'
                });
            }
        }

        // Validação de propriedades obrigatórias
        if (schema.required && Array.isArray(schema.required)) {
            for (const requiredProp of schema.required) {
                if (!(requiredProp in input)) {
                    errors.push({
                        field: requiredProp,
                        message: `Required property '${requiredProp}' is missing`,
                        severity: 'error'
                    });
                }
            }
        }

        return errors;
    }

    /**
     * Obtém tools habilitadas com filtro
     */
    getEnabledTools(request: CliRequest, filter?: ToolFilter): LanguageModelToolInformation[] {
        let enabledTools = Array.from(this.tools);

        // Aplica filtro customizado primeiro
        if (filter) {
            enabledTools = enabledTools.filter(tool => {
                const customResult = filter(tool);
                if (customResult !== undefined) {
                    return customResult;
                }
                // Se filtro retornar undefined, usa lógica padrão
                return this.isToolEnabledByDefault(tool, request);
            });
        } else {
            // Aplica apenas lógica padrão
            enabledTools = enabledTools.filter(tool => this.isToolEnabledByDefault(tool, request));
        }

        return enabledTools;
    }

    /**
     * Lógica padrão para determinar se tool está habilitada
     */
    private isToolEnabledByDefault(tool: LanguageModelToolInformation, request: CliRequest): boolean {
        // Sempre habilita tools básicas
        const basicTools = ['read', 'write', 'list', 'search'];
        if (basicTools.some(basic => tool.name.toLowerCase().includes(basic))) {
            return true;
        }

        // Habilita tools de debugging apenas se verbose
        if (tool.tags?.includes('debug') && !request.options?.verbose) {
            return false;
        }

        // Desabilita tools perigosas em dry-run
        if (request.options?.dryRun && tool.tags?.includes('destructive')) {
            return false;
        }

        // Habilita por padrão
        return true;
    }

    /**
     * Cria instância de tool
     */
    createToolInstance(name: string, ...args: any[]): BaseTool<any> | undefined {
        const toolCtor = this._toolInstances.get(name);
        if (!toolCtor) {return undefined;}

        try {
            return new toolCtor(...args);
        } catch (error) {
            console.error(`Failed to create tool instance ${name}:`, error);
            return undefined;
        }
    }

    /**
     * Obtém estatísticas do service
     */
    getStats(): {
        totalTools: number;
        enabledTools: number;
        toolsWithHealing: number;
        categoriesCovered: string[];
        registrationErrors: number;
    } {
        const registryStats = ToolRegistry.getStats();
        
        return {
            totalTools: this._baseTools.size,
            enabledTools: this._baseTools.size, // Todas inicializadas estão habilitadas
            toolsWithHealing: 0, // BaseTool não tem supportsHealing
            categoriesCovered: ToolRegistry.getCategories(),
            registrationErrors: registryStats.totalTools - this._baseTools.size
        };
    }

    /**
     * Recarrega tools do registry
     */
    reloadTools(): void {
        console.log('🔄 Reloading tools from registry...');
        this._baseTools.clear();
        this._toolInstances.clear();
        this.initializeTools();
    }

    /**
     * Adiciona tool dinamicamente
     */
    addTool(toolCtor: BaseToolCtor): boolean {
        try {
            // Registra no registry primeiro
            ToolRegistry.registerTool(toolCtor);
            
            // Cria instância
            const toolInstance = new toolCtor();
            this._baseTools.set(toolInstance.name, toolInstance);
            this._toolInstances.set(toolInstance.name, toolCtor);
            
            console.log(`➕ Tool added dynamically: ${toolInstance.name}`);
            return true;
        } catch (error) {
            console.error(`Failed to add tool:`, error);
            return false;
        }
    }

    /**
     * Remove tool
     */
    removeTool(name: string): boolean {
        const removed = this._baseTools.delete(name);
        this._toolInstances.delete(name);
        ToolRegistry.unregisterTool(name);
        
        if (removed) {
            console.log(`➖ Tool removed: ${name}`);
        }
        
        return removed;
    }
}

/**
 * Factory para ToolsService
 */
export class ToolsServiceFactory {
    /**
     * Cria service básico
     */
    static createBasic(): IToolsService {
        return new ToolsServiceImpl();
    }

    /**
     * Cria service com healing
     */
    static createWithHealing(healingSystem: any): IToolsService {
        return new ToolsServiceImpl(healingSystem);
    }

    /**
     * Cria service com tools pré-registradas
     */
    static createWithTools(tools: BaseToolCtor[], healingSystem?: any): IToolsService {
        // Registra tools no registry
        for (const tool of tools) {
            ToolRegistry.registerTool(tool);
        }
        
        return new ToolsServiceImpl(healingSystem);
    }
}

/**
 * Singleton do ToolsService
 */
export class ToolsServiceSingleton {
    private static instance: IToolsService;

    static getInstance(): IToolsService {
        if (!this.instance) {
            this.instance = ToolsServiceFactory.createBasic();
        }
        return this.instance;
    }

    static initialize(healingSystem?: any): IToolsService {
        this.instance = ToolsServiceFactory.createWithHealing(healingSystem);
        return this.instance;
    }

    static reset(): void {
        this.instance = ToolsServiceFactory.createBasic();
    }
}