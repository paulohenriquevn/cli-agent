/*---------------------------------------------------------------------------------------------
 * Tool Calling Loop - Abstract base class and concrete implementations
 *--------------------------------------------------------------------------------------------*/

import {
    IToolCallingLoopOptions,
    IToolCall,
    IToolCallRound,
    IToolCallLoopResult,
    IToolCallSingleResult,
    IBuildPromptContext,
    IBuildPromptResult,
    LanguageModelToolInformation,
    LanguageModelToolResult2,
    ChatResponse,
    ChatFetchResponse,
    ChatFetchResponseType,
    // ThinkingDataItem, // Unused import
    Raw
} from './types';

import { PauseController, DisposableBase } from './pauseController';
// import { StreamFactory, StreamProcessor } from './streamingSystem'; // Disabled - streamingSystem has architectural issues

/**
 * Progress tracking for tool calling loop execution
 */
export interface ToolCallingLoopProgress {
    currentRound: number;
    totalRounds?: number;
    toolCallsExecuted: number;
    toolCallsTotal?: number;
    executionTime: number;
    phase: 'building_prompt' | 'fetching' | 'executing_tools' | 'completed' | 'error';
    message?: string;
}

/**
 * Abstract base class for Tool Calling Loop implementations
 * 
 * Provides the core multi-turn execution logic with intelligent limits,
 * pause/resume support, and comprehensive error handling.
 */
export abstract class ToolCallingLoop<TOptions extends IToolCallingLoopOptions> extends DisposableBase {
    protected readonly options: TOptions;
    
    // Estado persistente do loop
    private toolCallResults: Record<string, LanguageModelToolResult2> = {};
    private toolCallRounds: IToolCallRound[] = [];
    private totalExecutionTime = 0;
    private cancelled = false;
    private hitToolCallLimit = false;
    
    // Controle de progresso
    private progress: ToolCallingLoopProgress = {
        currentRound: 0,
        toolCallsExecuted: 0,
        executionTime: 0,
        phase: 'building_prompt'
    };

    constructor(options: TOptions) {
        super();
        this.options = options;
    }

    /**
     * Métodos abstratos que subclasses devem implementar
     */
    protected abstract buildPrompt(
        context: IBuildPromptContext,
        progress: ToolCallingLoopProgress,
        token: PauseController
    ): Promise<IBuildPromptResult>;

    protected abstract getAvailableTools(
        stream: unknown,
        token: PauseController
    ): Promise<LanguageModelToolInformation[]>;

    protected abstract fetch(
        options: {
            messages: Raw.ChatMessage[];
            tools?: LanguageModelToolInformation[];
            stream?: boolean;
        },
        token: PauseController
    ): Promise<ChatResponse>;

    protected abstract executeTool(
        toolCall: IToolCall,
        token: PauseController
    ): Promise<LanguageModelToolResult2>;

    /**
     * Executa loop completo de tool calling com múltiplas rodadas
     */
    async executeLoop(
        pauseController?: PauseController
    ): Promise<IToolCallLoopResult> {
        const startTime = Date.now();
        const controller = pauseController || new PauseController();
        
        // Reset do estado
        this.reset();
        
        try {
            let currentResponse: ChatFetchResponse | undefined;
            let currentRound: IToolCallRound | undefined;

            // 🔄 Multi-turn execution loop
            while (this.toolCallRounds.length < this.options.toolCallLimit) {
                await controller.throwIfCancelledAsync();
                
                this.updateProgress({
                    currentRound: this.toolCallRounds.length + 1,
                    phase: 'building_prompt',
                    message: `Starting round ${this.toolCallRounds.length + 1}`
                });

                // 📝 Build context and prompt
                const context = this.buildContext();
                const promptResult = await this.buildPrompt(context, this.progress, controller);
                
                this.updateProgress({
                    phase: 'fetching',
                    message: 'Fetching model response'
                });

                // 🌐 Fetch model response
                const tools = await this.getAvailableTools(null, controller);
                const response = await this.fetch({
                    messages: promptResult.messages,
                    tools,
                    stream: this.options.enableStreaming
                }, controller);

                // 📊 Create round record
                const roundStartTime = Date.now();
                currentRound = {
                    response: response.value,
                    toolCalls: response.toolCalls || [],
                    toolInputRetry: 0,
                    thinking: response.thinking,
                    executionTime: 0,
                    timestamp: roundStartTime
                };

                currentResponse = {
                    type: response.type,
                    value: response.value,
                    error: undefined
                };

                // ⚠️ Handle non-success responses
                if (response.type !== ChatFetchResponseType.Success) {
                    currentRound.executionTime = Date.now() - roundStartTime;
                    this.toolCallRounds.push(currentRound);
                    
                    if (response.type === ChatFetchResponseType.Cancelled) {
                        this.cancelled = true;
                    }
                    break;
                }

                // 🛠️ Execute tool calls if present
                if (response.toolCalls && response.toolCalls.length > 0) {
                    this.updateProgress({
                        phase: 'executing_tools',
                        toolCallsTotal: response.toolCalls.length,
                        message: `Executing ${response.toolCalls.length} tool calls`
                    });

                    await this.executeToolCallsForRound(response.toolCalls, controller);
                    this.progress.toolCallsExecuted += response.toolCalls.length;
                }

                // ✅ Finalize round
                currentRound.executionTime = Date.now() - roundStartTime;
                this.toolCallRounds.push(currentRound);

                // 🏁 Check termination conditions
                if (!response.toolCalls || response.toolCalls.length === 0) {
                    // No more tool calls, conversation complete
                    break;
                }

                // ⚡ Check if we're at the limit
                if (this.toolCallRounds.length >= this.options.toolCallLimit) {
                    this.hitToolCallLimit = true;
                    break;
                }
            }

            this.totalExecutionTime = Date.now() - startTime;
            
            this.updateProgress({
                phase: 'completed',
                message: 'Tool calling loop completed'
            });

            return {
                response: currentResponse ?? { type: ChatFetchResponseType.Error, error: new Error('No response') },
                round: currentRound ?? { 
                    response: { role: Raw.ChatRole.Assistant, content: '' }, 
                    toolCalls: [], 
                    toolInputRetry: 0, 
                    executionTime: 0, 
                    timestamp: Date.now() 
                },
                toolCallRounds: [...this.toolCallRounds],
                totalExecutionTime: this.totalExecutionTime,
                cancelled: this.cancelled,
                hitToolCallLimit: this.hitToolCallLimit
            };

        } catch (error) {
            this.totalExecutionTime = Date.now() - startTime;
            this.cancelled = controller.isCancellationRequested;
            
            this.updateProgress({
                phase: 'error',
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            });

            throw error;
        } finally {
            if (pauseController !== controller) {
                controller.dispose();
            }
        }
    }

    /**
     * Executa uma única rodada de tool calling
     */
    async executeSingle(
        pauseController?: PauseController
    ): Promise<IToolCallSingleResult> {
        const result = await this.executeLoop(pauseController);
        return {
            response: result.response,
            round: result.round
        };
    }

    /**
     * Executa tool calls para uma rodada específica
     */
    private async executeToolCallsForRound(
        toolCalls: IToolCall[],
        controller: PauseController
    ): Promise<void> {
        const toolPromises = toolCalls.map(async (toolCall) => {
            try {
                await controller.throwIfCancelledAsync();
                
                const result = await this.executeTool(toolCall, controller);
                this.toolCallResults[toolCall.id] = result;
                
                return result;
            } catch (error) {
                const errorResult: LanguageModelToolResult2 = {
                    content: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    error: error instanceof Error ? error : new Error(String(error)),
                    executionTime: 0,
                    success: false
                };
                
                this.toolCallResults[toolCall.id] = errorResult;
                return errorResult;
            }
        });

        await Promise.all(toolPromises);
    }

    /**
     * Constrói contexto para prompt building
     */
    private buildContext(): IBuildPromptContext {
        const availableTools: LanguageModelToolInformation[] = []; // Will be populated by subclass
        
        return {
            toolCallResults: { ...this.toolCallResults },
            toolCallRounds: [...this.toolCallRounds],
            tools: {
                availableTools,
                toolInvocationToken: this.options.request.toolInvocationToken
            }
        };
    }

    /**
     * Atualiza progresso da execução
     */
    private updateProgress(update: Partial<ToolCallingLoopProgress>): void {
        this.progress = {
            ...this.progress,
            ...update,
            executionTime: Date.now() - (this.progress.executionTime || Date.now())
        };
        
        // Emite evento de progresso (pode ser sobrescrito por subclasses)
        this.onProgressUpdate?.(this.progress);
    }

    /**
     * Reset do estado do loop
     */
    private reset(): void {
        this.toolCallResults = {};
        this.toolCallRounds = [];
        this.totalExecutionTime = 0;
        this.cancelled = false;
        this.hitToolCallLimit = false;
        this.progress = {
            currentRound: 0,
            toolCallsExecuted: 0,
            executionTime: 0,
            phase: 'building_prompt'
        };
    }

    /**
     * Hook para atualizações de progresso (pode ser sobrescrito)
     */
    protected onProgressUpdate?(progress: ToolCallingLoopProgress): void;

    /**
     * Getters para estado interno
     */
    get currentProgress(): ToolCallingLoopProgress {
        return { ...this.progress };
    }

    get currentToolCallResults(): Record<string, LanguageModelToolResult2> {
        return { ...this.toolCallResults };
    }

    get currentRounds(): IToolCallRound[] {
        return [...this.toolCallRounds];
    }

    get isExecuting(): boolean {
        return this.progress.phase !== 'completed' && this.progress.phase !== 'error';
    }
}

/**
 * Implementação concreta básica do Tool Calling Loop
 */
export class BasicToolCallingLoop extends ToolCallingLoop<IToolCallingLoopOptions> {
    private availableToolsCache?: LanguageModelToolInformation[];

    constructor(
        options: IToolCallingLoopOptions,
        private toolRegistry: Map<string, unknown> = new Map()
    ) {
        super(options);
    }

    protected async buildPrompt(
        context: IBuildPromptContext,
        progress: ToolCallingLoopProgress,
        token: PauseController
    ): Promise<IBuildPromptResult> {
        await token.throwIfCancelledAsync();

        // Build messages from context
        const messages: Raw.ChatMessage[] = [];
        
        // Add tool call results as tool messages
        for (const round of context.toolCallRounds) {
            if (round.response) {
                messages.push(round.response);
            }
            
            // Add tool results
            for (const toolCall of round.toolCalls) {
                const result = context.toolCallResults[toolCall.id];
                if (result) {
                    messages.push({
                        role: Raw.ChatRole.Tool,
                        content: result.content,
                        toolCallId: toolCall.id,
                        name: toolCall.name
                    });
                }
            }
        }

        return {
            prompt: messages.map(m => m.content || '').join('\n'),
            messages,
            contextTokens: this.estimateTokens(messages)
        };
    }

    protected async getAvailableTools(
        stream: unknown,
        token: PauseController
    ): Promise<LanguageModelToolInformation[]> {
        await token.throwIfCancelledAsync();
        
        if (this.availableToolsCache) {
            return this.availableToolsCache;
        }

        // Convert tool registry to tool information
        const tools: LanguageModelToolInformation[] = [];
        for (const [name, tool] of this.toolRegistry) {
            const toolObj = tool as { description?: string; inputSchema?: unknown; tags?: string[] };
            tools.push({
                name,
                description: toolObj.description || `Execute ${name}`,
                inputSchema: toolObj.inputSchema || {},
                tags: toolObj.tags || []
            });
        }

        this.availableToolsCache = tools;
        return tools;
    }

    protected async fetch(
        options: {
            messages: Raw.ChatMessage[];
            tools?: LanguageModelToolInformation[];
            stream?: boolean;
        },
        token: PauseController
    ): Promise<ChatResponse> {
        await token.throwIfCancelledAsync();
        
        // Mock implementation - subclasses should override with actual API calls
        return {
            type: ChatFetchResponseType.Success,
            value: {
                role: Raw.ChatRole.Assistant,
                content: 'Mock response - override this method in subclass'
            }
        };
    }

    protected async executeTool(
        toolCall: IToolCall,
        token: PauseController
    ): Promise<LanguageModelToolResult2> {
        await token.throwIfCancelledAsync();
        
        const startTime = Date.now();
        
        try {
            const tool = this.toolRegistry.get(toolCall.name);
            if (!tool) {
                throw new Error(`Tool ${toolCall.name} not found in registry`);
            }

            // Parse arguments
            let args: Record<string, unknown> = {};
            try {
                args = JSON.parse(toolCall.arguments);
            } catch {
                throw new Error(`Invalid tool arguments: ${toolCall.arguments}`);
            }

            // Execute tool
            const toolObj = tool as { execute: (args: Record<string, unknown>, token: PauseController) => Promise<unknown> };
            const result = await toolObj.execute(args, token);
            
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
     * Adiciona tool ao registry
     */
    addTool(name: string, tool: unknown): void {
        this.toolRegistry.set(name, tool);
        this.availableToolsCache = undefined; // Clear cache
    }

    /**
     * Remove tool do registry
     */
    removeTool(name: string): void {
        this.toolRegistry.delete(name);
        this.availableToolsCache = undefined; // Clear cache
    }

    /**
     * Estima tokens aproximadamente
     */
    private estimateTokens(messages: Raw.ChatMessage[]): number {
        const text = messages.map(m => m.content || '').join('\n');
        return Math.ceil(text.length / 4); // Rough approximation
    }
}

/**
 * Factory para criação de tool calling loops
 */
export class ToolCallingLoopFactory {
    /**
     * Cria loop básico com configuração padrão
     */
    static createBasic(options?: Partial<IToolCallingLoopOptions>): BasicToolCallingLoop {
        const defaultOptions: IToolCallingLoopOptions = {
            toolCallLimit: 10,
            enableStreaming: true,
            enableNestedCalls: false,
            enableTelemetry: false,
            model: {
                family: 'openai',
                name: 'gpt-4o-mini'
            },
            request: {}
        };

        return new BasicToolCallingLoop({
            ...defaultOptions,
            ...options
        });
    }

    /**
     * Cria loop com configuração para streaming
     */
    static createWithStreaming(options?: Partial<IToolCallingLoopOptions>): BasicToolCallingLoop {
        return this.createBasic({
            ...options,
            enableStreaming: true
        });
    }

    /**
     * Cria loop com suporte a nested calls
     */
    static createWithNesting(options?: Partial<IToolCallingLoopOptions>): BasicToolCallingLoop {
        return this.createBasic({
            ...options,
            enableNestedCalls: true,
            toolCallLimit: 20 // Increase limit for nested calls
        });
    }
}