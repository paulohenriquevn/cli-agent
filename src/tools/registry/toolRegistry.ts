/*---------------------------------------------------------------------------------------------
 * Tool Registry - Sistema de registro estático para tools (CLI puro baseado em BaseTool)
 *--------------------------------------------------------------------------------------------*/

import { BaseTool, IToolParams } from '../base/baseTool';
import { CliExecutionContext, CliToolInvocationOptions, CliCancellationToken, CliToolResult, createDefaultCliContext } from '../types/cliTypes';

/**
 * Constructor para BaseTool
 */
export interface BaseToolCtor<T extends IToolParams = IToolParams> {
    new (context?: CliExecutionContext): BaseTool<T>;
}

/**
 * Dados de filtro de edição
 */
export interface IEditFilterData {
    allowed: boolean;
    reason?: string;
    alternatives?: string[];
    restrictions?: {
        maxChanges?: number;
        allowedOperations?: string[];
        blockedPaths?: string[];
    };
}

/**
 * Resultado de validação de tool
 */
export interface IToolValidationResult {
    valid: boolean;
    errors: Array<{
        field: string;
        message: string;
        severity: 'error' | 'warning';
    }>;
    sanitizedInput?: any;
}

/**
 * Registry estático de tools baseado em BaseTool
 */
export const ToolRegistry = new class {
    private _tools: BaseTool[] = [];
    private readonly _categories = new Map<string, BaseTool[]>();
    private readonly _tags = new Map<string, BaseTool[]>();
    private readonly _toolsByName = new Map<string, BaseTool>();

    /**
     * Registra tool no registry (LLM-friendly - aceita classe e cria instância automaticamente)
     */
    public registerTool(ToolCtor: BaseToolCtor): void {
        // Cria instância automaticamente
        const instance = new ToolCtor();
        const toolName = instance.name;
        
        // Evita duplicatas
        if (this._toolsByName.has(toolName)) {
            console.warn(`Tool ${toolName} already registered, skipping`);
            return;
        }

        // Armazena a instância
        this._tools.push(instance);
        this._toolsByName.set(toolName, instance);
        
        // Organiza por categoria
        if (instance.category) {
            if (!this._categories.has(instance.category)) {
                this._categories.set(instance.category, []);
            }
            this._categories.get(instance.category)!.push(instance);
        }

        // Organiza por tags
        if (instance.tags) {
            for (const tag of instance.tags) {
                if (!this._tags.has(tag)) {
                    this._tags.set(tag, []);
                }
                this._tags.get(tag)!.push(instance);
            }
        }

        console.log(`Registered tool: ${toolName}${instance.category ? ` (${instance.category})` : ''}`);
    }

    /**
     * Obtém todas as tools registradas (LLM-friendly - já são instâncias)
     */
    public getTools(): readonly BaseTool[] {
        return this._tools;
    }

    /**
     * Obtém tool por nome (LLM-friendly - retorna instância diretamente)
     */
    public getTool(name: string): BaseTool | undefined {
        return this._toolsByName.get(name);
    }

    /**
     * Obtém tools por categoria (LLM-friendly - retorna instâncias)
     */
    public getToolsByCategory(category: string): readonly BaseTool[] {
        return this._categories.get(category) || [];
    }

    /**
     * Obtém tools por tag (LLM-friendly - retorna instâncias)
     */
    public getToolsByTag(tag: string): readonly BaseTool[] {
        return this._tags.get(tag) || [];
    }

    /**
     * Lista todas as categorias disponíveis
     */
    public getCategories(): string[] {
        return Array.from(this._categories.keys());
    }

    /**
     * Lista todas as tags disponíveis
     */
    public getTags(): string[] {
        return Array.from(this._tags.keys());
    }

    /**
     * Obtém estatísticas do registry
     */
    public getStats(): {
        totalTools: number;
        categoriesCount: number;
        tagsCount: number;
        toolsByCategory: Record<string, number>;
        toolsByTag: Record<string, number>;
        toolsByComplexity: Record<string, number>;
    } {
        const toolsByCategory: Record<string, number> = {};
        const toolsByTag: Record<string, number> = {};
        const toolsByComplexity: Record<string, number> = { core: 0, advanced: 0, essential: 0 };

        this._categories.forEach((tools, category) => {
            toolsByCategory[category] = tools.length;
        });

        this._tags.forEach((tools, tag) => {
            toolsByTag[tag] = tools.length;
        });

        // Conta tools por complexidade
        for (const tool of this._tools) {
            toolsByComplexity[tool.complexity]++;
        }

        return {
            totalTools: this._tools.length,
            categoriesCount: this._categories.size,
            tagsCount: this._tags.size,
            toolsByCategory,
            toolsByTag,
            toolsByComplexity
        };
    }

    /**
     * Filtra tools baseado em critérios
     */
    public filterTools(criteria: {
        category?: string;
        tags?: string[];
        complexity?: 'core' | 'advanced' | 'essential';
        name?: RegExp;
    }): BaseTool[] {
        let filtered = this._tools;

        if (criteria.category) {
            filtered = filtered.filter(tool => tool.category === criteria.category);
        }

        if (criteria.tags) {
            filtered = filtered.filter(tool => 
                criteria.tags!.some(tag => tool.tags?.includes(tag))
            );
        }

        if (criteria.complexity !== undefined) {
            filtered = filtered.filter(tool => tool.complexity === criteria.complexity);
        }

        if (criteria.name) {
            filtered = filtered.filter(tool => criteria.name!.test(tool.name));
        }

        return filtered;
    }

    /**
     * LLM-friendly method para executar tools diretamente
     * SUPER SIMPLES - busca instância e executa diretamente!
     */
    public async executeTool<T extends IToolParams = IToolParams>(
        toolName: string,
        input: T,
        context?: CliExecutionContext,
        cancellationToken?: CliCancellationToken
    ): Promise<CliToolResult> {
        // Busca a instância no registry (já pronta!)
        const tool = this.getTool(toolName);
        if (!tool) {
            throw new Error(`Tool '${toolName}' not found in registry`);
        }

        // Atualiza contexto se fornecido
        if (context) {
            tool.setContext(context);
        }
        
        // Cria token se não fornecido
        const token = cancellationToken || new CliCancellationToken();
        
        // Executa a tool
        return await tool.invoke({ 
            input,
            toolName,
            context: {
                workingDirectory: context?.workingDirectory,
                environment: context?.environment,
                sessionId: context?.sessionId,
                user: context?.user
            }
        }, token);
    }

    /**
     * Lista todas as tools registradas (LLM-friendly alias)
     */
    public listTools(): readonly BaseTool[] {
        return this.getTools();
    }

    /**
     * Valida tool antes do registro
     */
    public validateTool(tool: BaseToolCtor): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const instance = new tool();
            const toolName = instance.name;
            
            if (!instance.name) {
                errors.push('Tool must implement name property');
            }

            if (!instance.description) {
                errors.push('Tool must implement description property');
            }

            if (typeof instance.invoke !== 'function') {
                errors.push('Tool must implement invoke method');
            }

            if (!instance.inputSchema) {
                errors.push('Tool must implement inputSchema property');
            }

            // Validações de warning
            if (!instance.category) {
                warnings.push('Tool should specify a category for better organization');
            }

            if (!instance.tags || instance.tags.length === 0) {
                warnings.push('Tool should have tags for better discoverability');
            }

            if (!instance.complexity) {
                warnings.push('Tool should specify complexity level');
            }

            // Verifica duplicatas
            if (this._tools.some(t => t.name === toolName)) {
                errors.push(`Tool with name '${toolName}' is already registered`);
            }
        } catch (error) {
            errors.push(`Cannot instantiate tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Remove tool do registry
     */
    public unregisterTool(name: string): boolean {
        const index = this._tools.findIndex(tool => tool.name === name);
        
        if (index === -1) {
            return false;
        }

        const [removedTool] = this._tools.splice(index, 1);
        this._toolsByName.delete(name);
        
        // Remove das categorias
        if (removedTool.category) {
            const categoryTools = this._categories.get(removedTool.category);
            if (categoryTools) {
                const categoryIndex = categoryTools.indexOf(removedTool);
                if (categoryIndex !== -1) {
                    categoryTools.splice(categoryIndex, 1);
                }
                
                // Remove categoria se vazia
                if (categoryTools.length === 0) {
                    this._categories.delete(removedTool.category);
                }
            }
        }

        // Remove das tags
        if (removedTool.tags) {
            for (const tag of removedTool.tags) {
                const tagTools = this._tags.get(tag);
                if (tagTools) {
                    const tagIndex = tagTools.indexOf(removedTool);
                    if (tagIndex !== -1) {
                        tagTools.splice(tagIndex, 1);
                    }
                    
                    // Remove tag se vazia
                    if (tagTools.length === 0) {
                        this._tags.delete(tag);
                    }
                }
            }
        }

        console.log(`Unregistered tool: ${name}`);
        return true;
    }

    /**
     * Limpa todo o registry
     */
    public clear(): void {
        this._tools.length = 0;
        this._categories.clear();
        this._tags.clear();
        this._toolsByName.clear();
        console.log('Tool registry cleared');
    }

    /**
     * Obtém informações resumidas das tools
     */
    public getToolsSummary(): Array<{
        name: string;
        description: string;
        category: string;
        tags: string[];
        complexity: 'core' | 'advanced' | 'essential';
    }> {
        return this._tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            tags: tool.tags,
            complexity: tool.complexity
        }));
    }
}();

/**
 * Registry utilities
 */
export class ToolRegistryUtils {
    /**
     * Auto-registra tools de um módulo
     */
    static autoRegisterFromModule(module: any): number {
        let registered = 0;
        
        for (const exportName of Object.keys(module)) {
            const exported = module[exportName];
            
            // Verifica se é uma BaseTool válida
            if (exported && 
                typeof exported === 'function' && 
                exported.prototype &&
                exported.prototype instanceof Object &&
                typeof exported.prototype.constructor === 'function') {
                
                try {
                    const instance = new exported();
                    if (typeof instance.invoke === 'function' && 
                        instance.name &&
                        instance.description) {
                
                        ToolRegistry.registerTool(exported);
                        registered++;
                    }
                } catch (error) {
                    console.warn(`Failed to auto-register tool ${exportName}:`, error);
                }
            }
        }
        
        return registered;
    }

    /**
     * Valida e registra tool com relatório detalhado
     */
    static registerWithValidation(tool: BaseToolCtor): boolean {
        const validation = ToolRegistry.validateTool(tool);
        const instance = new tool();
        const toolName = instance.name;
        
        if (!validation.valid) {
            console.error(`Tool ${toolName} validation failed:`, validation.errors);
            return false;
        }
        
        if (validation.warnings.length > 0) {
            console.warn(`Tool ${toolName} validation warnings:`, validation.warnings);
        }
        
        ToolRegistry.registerTool(tool);
        return true;
    }

    /**
     * Cria snapshot do estado atual do registry
     */
    static createSnapshot(): {
        tools: Array<{ name: string; description: string; category: string; tags: string[] }>;
        stats: ReturnType<typeof ToolRegistry.getStats>;
        timestamp: number;
    } {
        return {
            tools: ToolRegistry.getToolsSummary(),
            stats: ToolRegistry.getStats(),
            timestamp: Date.now()
        };
    }

    /**
     * Carrega tools de configuração JSON
     */
    static loadFromConfig(config: {
        tools: Array<{
            module: string;
            export?: string;
            enabled?: boolean;
        }>;
    }): Promise<number> {
        // Esta função seria implementada para carregar tools dinamicamente
        // baseado em configuração externa
        return Promise.resolve(0);
    }
}