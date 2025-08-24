/*---------------------------------------------------------------------------------------------
 * Nested Tool Calls Support - Tools calling other tools with proper isolation
 *--------------------------------------------------------------------------------------------*/

import {
    IToolCall,
    IToolCallingLoopOptions,
    IToolCallRound,
    IToolCallLoopResult,
    LanguageModelToolInformation,
    LanguageModelToolResult2,
    ChatResponse,
    ThinkingDataItem
} from './types';

import { ToolCallingLoop, BasicToolCallingLoop, ToolCallingLoopProgress } from './toolCallingLoop';
import { PauseController, DisposableBase } from './pauseController';
import { ToolCallIdManager, ToolCallIdContext } from './toolCallIdManager';
import { ToolCallingValidator, ValidationResult } from './validation';

/**
 * Configuração específica para nested calls
 */
export interface NestedCallsConfig {
    maxDepth: number;
    maxCallsPerLevel: number;
    enableCrossLevelCommunication: boolean;
    isolateContextBetweenLevels: boolean;
    propagateErrorsUpward: boolean;
    timeoutPerLevel: number;
    enableParallelExecution: boolean;
}

/**
 * Contexto de execução de nested call
 */
export interface NestedExecutionContext {
    depth: number;
    parentCallId: string;
    parentRoundNumber: number;
    parentExecutionId: string;
    levelPath: string[]; // ["root", "tool1", "tool2"]
    sharedData?: Record<string, any>;
    isolatedData?: Record<string, any>;
    restrictions?: NestedCallRestrictions;
}

/**
 * Restrições para nested calls
 */
export interface NestedCallRestrictions {
    allowedTools?: string[];
    blockedTools?: string[];
    maxExecutionTime?: number;
    resourceLimits?: {
        maxMemory?: number;
        maxCPU?: number;
        maxFileAccess?: number;
    };
}

/**
 * Resultado de execução nested
 */
export interface NestedExecutionResult extends IToolCallLoopResult {
    depth: number;
    parentCallId: string;
    nestedResults: Map<string, NestedExecutionResult>;
    isolationLevel: 'full' | 'partial' | 'none';
    propagatedErrors: Error[];
    resourceUsage: {
        memoryUsed: number;
        cpuTime: number;
        executionTime: number;
    };
}

/**
 * Gerenciador de contexto hierárquico
 */
export class NestedContextManager extends DisposableBase {
    private readonly contexts = new Map<string, NestedExecutionContext>();
    private readonly parentChildMap = new Map<string, Set<string>>();
    private readonly config: NestedCallsConfig;

    constructor(config: NestedCallsConfig) {
        super();
        this.config = config;
    }

    /**
     * Cria contexto para nested call
     */
    createNestedContext(
        parentCallId: string,
        parentRound: number,
        parentExecutionId: string,
        depth: number,
        callId: string
    ): NestedExecutionContext {
        if (depth > this.config.maxDepth) {
            throw new Error(`Maximum nested depth ${this.config.maxDepth} exceeded`);
        }

        const parentContext = this.contexts.get(parentCallId);
        const levelPath = parentContext
            ? [...parentContext.levelPath, parentCallId]
            : ['root', parentCallId];

        const context: NestedExecutionContext = {
            depth,
            parentCallId,
            parentRoundNumber: parentRound,
            parentExecutionId,
            levelPath,
            sharedData: this.config.enableCrossLevelCommunication && parentContext
                ? { ...parentContext.sharedData }
                : {},
            isolatedData: {},
            restrictions: this.calculateRestrictions(depth, levelPath)
        };

        this.contexts.set(callId, context);
        
        // Atualiza mapeamento pai-filho
        if (!this.parentChildMap.has(parentCallId)) {
            this.parentChildMap.set(parentCallId, new Set());
        }
        this.parentChildMap.get(parentCallId)!.add(callId);

        return context;
    }

    /**
     * Obtém contexto de execução
     */
    getContext(callId: string): NestedExecutionContext | undefined {
        return this.contexts.get(callId);
    }

    /**
     * Atualiza dados compartilhados
     */
    updateSharedData(callId: string, data: Record<string, any>): void {
        const context = this.contexts.get(callId);
        if (!context || !this.config.enableCrossLevelCommunication) {return;}

        // Atualiza contexto atual
        context.sharedData = { ...context.sharedData, ...data };

        // Propaga para filhos se habilitado
        const children = this.parentChildMap.get(callId);
        if (children) {
            for (const childId of children) {
                const childContext = this.contexts.get(childId);
                if (childContext) {
                    childContext.sharedData = { ...childContext.sharedData, ...data };
                }
            }
        }
    }

    /**
     * Obtém hierarquia completa
     */
    getHierarchy(callId: string): {
        current: NestedExecutionContext;
        parent?: NestedExecutionContext;
        children: NestedExecutionContext[];
        siblings: NestedExecutionContext[];
    } | undefined {
        const current = this.contexts.get(callId);
        if (!current) {return undefined;}

        const parent = this.contexts.get(current.parentCallId);
        
        const children: NestedExecutionContext[] = [];
        const childIds = this.parentChildMap.get(callId);
        if (childIds) {
            for (const childId of childIds) {
                const child = this.contexts.get(childId);
                if (child) {children.push(child);}
            }
        }

        const siblings: NestedExecutionContext[] = [];
        if (parent) {
            const siblingIds = this.parentChildMap.get(parent.parentCallId);
            if (siblingIds) {
                for (const siblingId of siblingIds) {
                    if (siblingId !== callId) {
                        const sibling = this.contexts.get(siblingId);
                        if (sibling) {siblings.push(sibling);}
                    }
                }
            }
        }

        return { current, parent, children, siblings };
    }

    /**
     * Calcula restrições baseadas na profundidade e caminho
     */
    private calculateRestrictions(depth: number, levelPath: string[]): NestedCallRestrictions {
        // Restrições mais rigorosas em níveis mais profundos
        const baseTimeout = this.config.timeoutPerLevel;
        const depthMultiplier = Math.max(0.1, 1 - (depth * 0.2));
        
        return {
            maxExecutionTime: Math.floor(baseTimeout * depthMultiplier),
            resourceLimits: {
                maxMemory: Math.floor(1024 * 1024 * depthMultiplier), // MB
                maxCPU: Math.floor(100 * depthMultiplier), // %
                maxFileAccess: Math.floor(10 * depthMultiplier)
            }
        };
    }

    /**
     * Limpa contextos expirados
     */
    cleanup(): void {
        const now = Date.now();
        const expiredContexts: string[] = [];

        for (const [callId, context] of this.contexts) {
            // Remove contextos antigos (1 hora)
            if (now - context.parentRoundNumber > 3600000) {
                expiredContexts.push(callId);
            }
        }

        for (const callId of expiredContexts) {
            this.contexts.delete(callId);
            this.parentChildMap.delete(callId);
        }
    }

    dispose(): void {
        this.contexts.clear();
        this.parentChildMap.clear();
        super.dispose();
    }
}

/**
 * Tool Calling Loop com suporte a nested calls
 */
export class NestedToolCallingLoop extends ToolCallingLoop<IToolCallingLoopOptions> {
    private readonly nestedConfig: NestedCallsConfig;
    private readonly contextManager: NestedContextManager;
    private readonly idManager: ToolCallIdManager;
    private readonly validator: ToolCallingValidator;
    private readonly nestedResults = new Map<string, NestedExecutionResult>();
    
    constructor(
        options: IToolCallingLoopOptions,
        nestedConfig: NestedCallsConfig,
        private toolRegistry: Map<string, any> = new Map()
    ) {
        super(options);
        
        this.nestedConfig = {
            maxDepth: 5,
            maxCallsPerLevel: 10,
            enableCrossLevelCommunication: true,
            isolateContextBetweenLevels: true,
            propagateErrorsUpward: true,
            timeoutPerLevel: 30000,
            enableParallelExecution: false,
            ...nestedConfig
        };
        
        this.contextManager = new NestedContextManager(this.nestedConfig);
        this.idManager = new ToolCallIdManager();
        this.validator = new ToolCallingValidator();
        
        this._register(this.contextManager);
        this._register(this.idManager);
        this._register(this.validator);
    }

    /**
     * Executa tool call com suporte a nested calls
     */
    protected async executeTool(
        toolCall: IToolCall,
        token: PauseController
    ): Promise<LanguageModelToolResult2> {
        const startTime = Date.now();
        
        try {
            // Valida tool call
            const validation = this.validator.validateToolCall(toolCall);
            if (!validation.valid) {
                throw new Error(`Invalid tool call: ${validation.errors.map(e => e.message).join(', ')}`);
            }

            const tool = this.toolRegistry.get(toolCall.name);
            if (!tool) {
                throw new Error(`Tool ${toolCall.name} not found in registry`);
            }

            // Parse argumentos
            let args: any = {};
            try {
                args = JSON.parse(toolCall.arguments);
            } catch (error) {
                throw new Error(`Invalid tool arguments: ${toolCall.arguments}`);
            }

            // Verifica se o tool suporta nested calls
            const supportsNested = tool.supportsNestedCalls || false;
            let result: any;

            if (supportsNested && this.shouldExecuteNested(toolCall, args)) {
                result = await this.executeNestedTool(toolCall, args, token);
            } else {
                result = await this.executeRegularTool(tool, args, token);
            }

            return {
                content: typeof result === 'string' ? result : JSON.stringify(result),
                executionTime: Date.now() - startTime,
                success: true
            };

        } catch (error) {
            return {
                content: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error: error instanceof Error ? error : new Error(String(error)),
                executionTime: Date.now() - startTime,
                success: false
            };
        }
    }

    /**
     * Executa tool regular (não nested)
     */
    private async executeRegularTool(
        tool: any,
        args: any,
        token: PauseController
    ): Promise<any> {
        return await tool.execute(args, token);
    }

    /**
     * Executa tool com nested calls
     */
    private async executeNestedTool(
        toolCall: IToolCall,
        args: any,
        token: PauseController
    ): Promise<any> {
        // Determina contexto atual
        const currentContext = this.contextManager.getContext(toolCall.id) || 
            this.createRootContext(toolCall.id);
        
        // Verifica limites de profundidade
        if (currentContext.depth >= this.nestedConfig.maxDepth) {
            throw new Error(`Maximum nested depth ${this.nestedConfig.maxDepth} reached`);
        }

        // Identifica tools que precisam ser chamados
        const nestedCalls = this.extractNestedCalls(args);
        
        if (nestedCalls.length === 0) {
            // Não há nested calls, executa normalmente
            const tool = this.toolRegistry.get(toolCall.name);
            return await tool.execute(args, token);
        }

        // Executa nested calls
        const nestedResults: Record<string, any> = {};
        
        if (this.nestedConfig.enableParallelExecution) {
            await this.executeNestedCallsParallel(nestedCalls, currentContext, token, nestedResults);
        } else {
            await this.executeNestedCallsSequential(nestedCalls, currentContext, token, nestedResults);
        }

        // Combina resultados
        const enhancedArgs = {
            ...args,
            __nestedResults: nestedResults,
            __context: this.nestedConfig.enableCrossLevelCommunication 
                ? currentContext.sharedData 
                : undefined
        };

        // Executa tool principal com resultados nested
        const tool = this.toolRegistry.get(toolCall.name);
        return await tool.execute(enhancedArgs, token);
    }

    /**
     * Executa nested calls sequencialmente
     */
    private async executeNestedCallsSequential(
        nestedCalls: IToolCall[],
        parentContext: NestedExecutionContext,
        token: PauseController,
        results: Record<string, any>
    ): Promise<void> {
        for (const nestedCall of nestedCalls) {
            await token.throwIfCancelledAsync();
            
            const childContext = this.contextManager.createNestedContext(
                parentContext.parentCallId,
                parentContext.parentRoundNumber,
                parentContext.parentExecutionId,
                parentContext.depth + 1,
                nestedCall.id
            );

            const nestedLoop = this.createNestedLoop(childContext);
            const result = await nestedLoop.executeSingle(token);
            
            results[nestedCall.name] = {
                success: result.response.type === 'success',
                content: result.response.value?.content || '',
                toolCalls: result.round.toolCalls.length,
                executionTime: result.round.executionTime
            };

            // Atualiza dados compartilhados
            if (this.nestedConfig.enableCrossLevelCommunication) {
                this.contextManager.updateSharedData(nestedCall.id, {
                    [nestedCall.name]: results[nestedCall.name]
                });
            }
        }
    }

    /**
     * Executa nested calls em paralelo
     */
    private async executeNestedCallsParallel(
        nestedCalls: IToolCall[],
        parentContext: NestedExecutionContext,
        token: PauseController,
        results: Record<string, any>
    ): Promise<void> {
        const promises = nestedCalls.map(async (nestedCall) => {
            const childContext = this.contextManager.createNestedContext(
                parentContext.parentCallId,
                parentContext.parentRoundNumber,
                parentContext.parentExecutionId,
                parentContext.depth + 1,
                nestedCall.id
            );

            const nestedLoop = this.createNestedLoop(childContext);
            const result = await nestedLoop.executeSingle(token);
            
            return {
                name: nestedCall.name,
                result: {
                    success: result.response.type === 'success',
                    content: result.response.value?.content || '',
                    toolCalls: result.round.toolCalls.length,
                    executionTime: result.round.executionTime
                }
            };
        });

        const parallelResults = await Promise.all(promises);
        
        for (const { name, result } of parallelResults) {
            results[name] = result;
        }
    }

    /**
     * Cria loop para nested execution
     */
    private createNestedLoop(context: NestedExecutionContext): BasicToolCallingLoop {
        const nestedOptions: IToolCallingLoopOptions = {
            ...this.options,
            toolCallLimit: Math.min(this.options.toolCallLimit, this.nestedConfig.maxCallsPerLevel)
        };

        const nestedLoop = new BasicToolCallingLoop(nestedOptions, this.toolRegistry);
        
        // Aplica restrições
        if (context.restrictions?.allowedTools) {
            this.applyToolRestrictions(nestedLoop, context.restrictions);
        }

        return nestedLoop;
    }

    /**
     * Aplica restrições de tools
     */
    private applyToolRestrictions(loop: BasicToolCallingLoop, restrictions: NestedCallRestrictions): void {
        if (restrictions.allowedTools) {
            // Remove tools não permitidos
            for (const [name] of this.toolRegistry) {
                if (!restrictions.allowedTools.includes(name)) {
                    loop.removeTool(name);
                }
            }
        }

        if (restrictions.blockedTools) {
            // Remove tools bloqueados
            for (const blockedTool of restrictions.blockedTools) {
                loop.removeTool(blockedTool);
            }
        }
    }

    /**
     * Extrai nested calls dos argumentos
     */
    private extractNestedCalls(args: any): IToolCall[] {
        const nestedCalls: IToolCall[] = [];
        
        // Procura por padrão específico de nested calls
        if (args.__nestedCalls && Array.isArray(args.__nestedCalls)) {
            for (const call of args.__nestedCalls) {
                if (call.name && call.arguments) {
                    nestedCalls.push({
                        id: this.idManager.createId(call),
                        name: call.name,
                        arguments: typeof call.arguments === 'string' 
                            ? call.arguments 
                            : JSON.stringify(call.arguments)
                    });
                }
            }
        }

        return nestedCalls;
    }

    /**
     * Determina se deve executar como nested
     */
    private shouldExecuteNested(toolCall: IToolCall, args: any): boolean {
        return args.__nestedCalls && Array.isArray(args.__nestedCalls) && args.__nestedCalls.length > 0;
    }

    /**
     * Cria contexto raiz para execução
     */
    private createRootContext(callId: string): NestedExecutionContext {
        return this.contextManager.createNestedContext(
            'root',
            0,
            `exec_${Date.now()}`,
            0,
            callId
        );
    }

    /**
     * Métodos abstratos implementados
     */
    protected async buildPrompt(): Promise<any> {
        // Implementação básica - sobrescreva conforme necessário
        return {
            prompt: '',
            messages: [],
            contextTokens: 0
        };
    }

    protected async getAvailableTools(): Promise<LanguageModelToolInformation[]> {
        const tools: LanguageModelToolInformation[] = [];
        for (const [name, tool] of this.toolRegistry) {
            tools.push({
                name,
                description: tool.description || `Execute ${name}`,
                inputSchema: tool.inputSchema || {},
                tags: tool.tags || []
            });
        }
        return tools;
    }

    protected async fetch(): Promise<ChatResponse> {
        // Mock - sobrescreva com implementação real
        return {
            type: 'success' as any,
            value: {
                role: 'assistant' as any,
                content: 'Mock nested response'
            }
        };
    }

    /**
     * Obtém estatísticas de nested calls
     */
    getNestedStats(): {
        totalNestedCalls: number;
        maxDepthReached: number;
        averageNestingLevel: number;
        parallelExecutions: number;
        contextSwitches: number;
    } {
        let totalNested = 0;
        let maxDepth = 0;
        let totalDepth = 0;
        let parallelExecs = 0;
        
        for (const result of this.nestedResults.values()) {
            totalNested++;
            maxDepth = Math.max(maxDepth, result.depth);
            totalDepth += result.depth;
            
            if (result.nestedResults.size > 1) {
                parallelExecs++;
            }
        }

        return {
            totalNestedCalls: totalNested,
            maxDepthReached: maxDepth,
            averageNestingLevel: totalNested > 0 ? totalDepth / totalNested : 0,
            parallelExecutions: parallelExecs,
            contextSwitches: this.contextManager.getStats?.() || 0
        };
    }

    /**
     * Adiciona tool que suporta nested calls
     */
    addNestedTool(name: string, tool: any): void {
        tool.supportsNestedCalls = true;
        this.toolRegistry.set(name, tool);
    }
}

/**
 * Factory para nested tool calling loops
 */
export class NestedToolCallingLoopFactory {
    /**
     * Cria loop com configuração básica de nested calls
     */
    static createBasic(options?: Partial<IToolCallingLoopOptions>): NestedToolCallingLoop {
        const defaultOptions: IToolCallingLoopOptions = {
            toolCallLimit: 20, // Maior limite para nested calls
            enableStreaming: true,
            enableNestedCalls: true,
            enableTelemetry: true,
            model: { family: 'openai', name: 'gpt-4o-mini' },
            request: {}
        };

        const defaultNestedConfig: NestedCallsConfig = {
            maxDepth: 3,
            maxCallsPerLevel: 5,
            enableCrossLevelCommunication: true,
            isolateContextBetweenLevels: false,
            propagateErrorsUpward: true,
            timeoutPerLevel: 30000,
            enableParallelExecution: false
        };

        return new NestedToolCallingLoop(
            { ...defaultOptions, ...options },
            defaultNestedConfig
        );
    }

    /**
     * Cria loop com execução paralela habilitada
     */
    static createParallel(options?: Partial<IToolCallingLoopOptions>): NestedToolCallingLoop {
        const loop = this.createBasic(options);
        loop['nestedConfig'].enableParallelExecution = true;
        return loop;
    }

    /**
     * Cria loop com isolamento rígido entre níveis
     */
    static createIsolated(options?: Partial<IToolCallingLoopOptions>): NestedToolCallingLoop {
        const loop = this.createBasic(options);
        loop['nestedConfig'].isolateContextBetweenLevels = true;
        loop['nestedConfig'].enableCrossLevelCommunication = false;
        return loop;
    }
}