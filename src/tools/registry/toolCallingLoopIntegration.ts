/*---------------------------------------------------------------------------------------------
 * Tool Calling Loop Integration - Integração completa ToolRegistry ↔ Tool Calling Loop
 *--------------------------------------------------------------------------------------------*/

import { 
    ToolCallingLoop, 
    BasicToolCallingLoop, 
    ToolCallingLoopFactory,
    IToolCallingLoopOptions,
    ToolCallingLoopProgress 
} from '../execution/toolCallingLoop';

import { 
    PauseController 
} from '../execution/pauseController';

import {
    IToolCall,
    IToolCallRound,
    LanguageModelToolInformation,
    LanguageModelToolResult2,
    ChatResponse,
    ChatFetchResponseType,
    Raw
} from '../execution/types';

import { 
    IToolsService, 
    ToolsServiceImpl, 
    ToolsServiceFactory,
    CliRequest 
} from './toolsService';

import { 
    IIntentInvocation,
    IntentFactory,
    IntentType,
    IntentContext,
    IntentContextManager 
} from './intentLayer';

import { 
    ToolRegistry, 
    BaseToolCtor 
} from './toolRegistry';
import { CliToolInvocationOptions as ToolInvocationOptions } from '../types/cliTypes';

import { createToolHealingSystem } from '../healing';

/**
 * Configuração da integração
 */
export interface RegistryIntegrationOptions extends IToolCallingLoopOptions {
    // Intent configuration
    intentType?: IntentType;
    autoDetectIntent?: boolean;
    
    // Context configuration
    contextAware?: boolean;
    persistContext?: boolean;
    sessionId?: string;
    
    // Service configuration
    enableHealing?: boolean;
    healingConfig?: any;
    
    // Registry configuration
    autoRegisterTools?: boolean;
    toolCategories?: string[];
    toolTags?: string[];
    
    // Request context
    request?: CliRequest;
    intentContext?: IntentContext;
}

/**
 * Tool Calling Loop integrado com ToolRegistry
 */
export class RegistryIntegratedToolCallingLoop extends ToolCallingLoop<RegistryIntegrationOptions> {
    private readonly toolsService: IToolsService;
    private readonly intentInvocation: IIntentInvocation;
    private readonly healingSystem?: any;
    
    constructor(options: RegistryIntegrationOptions) {
        super(options);
        
        // Inicializa healing system se habilitado
        this.healingSystem = options.enableHealing 
            ? createToolHealingSystem(options.healingConfig)
            : undefined;
        
        // Inicializa tools service
        this.toolsService = options.enableHealing
            ? ToolsServiceFactory.createWithHealing(this.healingSystem)
            : ToolsServiceFactory.createBasic();
        
        // Configura intent
        this.intentInvocation = this.createIntent(options);
        
        // Auto-registra tools se solicitado
        if (options.autoRegisterTools) {
            this.autoRegisterTools();
        }
    }

    /**
     * Cria intent baseado na configuração
     */
    private createIntent(options: RegistryIntegrationOptions): IIntentInvocation {
        // Cria request padrão se não fornecido
        const request = options.request || {
            query: '',
            context: {
                workingDirectory: process.cwd()
            }
        };

        // Obtém ou cria contexto
        let context = options.intentContext;
        if (!context && options.contextAware) {
            context = options.sessionId 
                ? IntentContextManager.getContext(options.sessionId)
                : IntentContextManager.createFromRequest(request);
        }

        // Auto-detecta intent se habilitado
        if (options.autoDetectIntent && request.query) {
            return IntentFactory.detectIntent(request.query, this.toolsService, request, context);
        }

        // Usa intent especificado ou default para Agent
        const intentType = options.intentType || IntentType.Agent;
        return IntentFactory.createIntent(intentType, this.toolsService, request, context);
    }

    /**
     * Auto-registra tools do diretório de implementações
     */
    private autoRegisterTools(): void {
        // Esta seria a lógica para auto-descoberta de tools
        // Por enquanto registra tools básicas manualmente
        console.log('🔍 Auto-registering available tools...');
    }

    /**
     * Implementa getAvailableTools - ponte com Intent
     */
    protected async getAvailableTools(): Promise<LanguageModelToolInformation[]> {
        try {
            const tools = await this.intentInvocation.getAvailableTools();
            console.log(`🛠️ Available tools for ${this.intentInvocation.type}: ${tools.length}`);
            return tools;
        } catch (error) {
            console.error('Failed to get available tools:', error);
            // Fallback para todas as tools do service
            return this.toolsService.tools;
        }
    }

    /**
     * Implementa executeTool com integração completa
     */
    protected async executeTool(
        toolCall: IToolCall,
        token: PauseController
    ): Promise<LanguageModelToolResult2> {
        const startTime = Date.now();
        
        try {
            // Valida se tool pode ser usada no contexto atual
            if (!this.intentInvocation.canUseTool || !this.intentInvocation.canUseTool(toolCall.name)) {
                throw new Error(`Tool ${toolCall.name} is not allowed in current context`);
            }

            // Parse argumentos
            let parsedArgs: any;
            try {
                parsedArgs = JSON.parse(toolCall.arguments);
            } catch (parseError) {
                throw new Error(`Invalid tool arguments: ${toolCall.arguments}`);
            }

            // Cria opções de invocação
            const invocationOptions: ToolInvocationOptions = {
                input: parsedArgs,
                model: {
                    family: this.options.model.family,
                    name: this.options.model.name
                },
                context: this.buildPromptContext(),
                cancellationToken: token
            };

            // Executa tool através do service (com healing automático)
            const result = await this.toolsService.invokeTool(
                toolCall.name,
                invocationOptions,
                token
            );

            // Atualiza contexto se persistente
            if (this.options.persistContext && this.options.sessionId) {
                this.updateSessionContext(toolCall.name, result.success);
            }

            return result;

        } catch (error) {
            const errorResult: LanguageModelToolResult2 = {
                content: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error: error instanceof Error ? error : new Error(String(error)),
                executionTime: Date.now() - startTime,
                success: false
            };

            // Atualiza contexto com falha se persistente
            if (this.options.persistContext && this.options.sessionId) {
                this.updateSessionContext(toolCall.name, false);
            }

            return errorResult;
        }
    }

    /**
     * Constrói contexto de prompt para tools
     */
    private buildPromptContext(): IBuildPromptContext {
        const intentContext = this.intentInvocation.context;
        
        return {
            userQuery: this.options.request?.query || '',
            currentFile: intentContext?.currentFile ? {
                uri: intentContext.currentFile.path,
                content: intentContext.currentFile.content || '',
                language: intentContext.currentFile.language
            } : undefined,
            workspaceInfo: intentContext?.workspace ? {
                rootPath: intentContext.workspace.rootPath,
                files: intentContext.workspace.files
            } : undefined,
            conversationHistory: [],
            metadata: {
                sessionId: this.options.sessionId,
                intentType: this.intentInvocation.type,
                healingEnabled: !!this.healingSystem
            }
        };
    }

    /**
     * Atualiza contexto da sessão
     */
    private updateSessionContext(toolName: string, success: boolean): void {
        if (!this.options.sessionId) {return;}

        const currentContext = IntentContextManager.getContext(this.options.sessionId) || {
            sessionData: { previousTools: [], failedTools: [], preferences: {} }
        };

        // Atualiza histórico de tools
        currentContext.sessionData = currentContext.sessionData || { 
            previousTools: [], 
            failedTools: [], 
            preferences: {} 
        };

        currentContext.sessionData.previousTools.push(toolName);
        
        if (!success) {
            currentContext.sessionData.failedTools.push(toolName);
        }

        // Limita histórico
        if (currentContext.sessionData.previousTools.length > 50) {
            currentContext.sessionData.previousTools = currentContext.sessionData.previousTools.slice(-50);
        }
        
        if (currentContext.sessionData.failedTools.length > 20) {
            currentContext.sessionData.failedTools = currentContext.sessionData.failedTools.slice(-20);
        }

        IntentContextManager.saveContext(this.options.sessionId, currentContext);
    }

    /**
     * Implementações abstratas restantes
     */
    protected async buildPrompt(): Promise<any> {
        // Implementação básica - seria sobrescrita por subclasses
        return {
            prompt: this.options.request?.query || '',
            messages: [{
                role: Raw.ChatRole.User,
                content: this.options.request?.query || 'Help me with this task'
            }],
            contextTokens: 100
        };
    }

    protected async fetch(): Promise<ChatResponse> {
        // Mock implementation - seria conectado com API real
        return {
            type: ChatFetchResponseType.Success,
            value: {
                role: Raw.ChatRole.Assistant,
                content: 'I will help you with that task.',
                toolCalls: []
            }
        };
    }

    /**
     * Obtém estatísticas da integração
     */
    getIntegrationStats(): {
        toolsService: ReturnType<IToolsService['getStats']>;
        registry: ReturnType<typeof ToolRegistry.getStats>;
        intent: {
            type: IntentType;
            availableTools: number;
            contextAware: boolean;
        };
        healing: {
            enabled: boolean;
            summary?: Record<string, boolean>;
        };
        session: {
            id?: string;
            persistent: boolean;
            toolsUsed: number;
            failedTools: number;
        };
    } {
        const intentContext = this.intentInvocation.context;
        
        return {
            toolsService: this.toolsService.getStats(),
            registry: ToolRegistry.getStats(),
            intent: {
                type: this.intentInvocation.type,
                availableTools: 0, // Seria calculado dinamicamente
                contextAware: !!intentContext
            },
            healing: {
                enabled: !!this.healingSystem,
                summary: this.healingSystem?.getFlagsSummary()
            },
            session: {
                id: this.options.sessionId,
                persistent: !!this.options.persistContext,
                toolsUsed: intentContext?.sessionData?.previousTools.length || 0,
                failedTools: intentContext?.sessionData?.failedTools.length || 0
            }
        };
    }

    /**
     * Adiciona tool dinamicamente
     */
    addTool(toolCtor: BaseToolCtor): boolean {
        return this.toolsService.addTool(toolCtor);
    }

    /**
     * Remove tool
     */
    removeTool(toolName: string): boolean {
        return this.toolsService.removeTool(toolName);
    }

    /**
     * Recarrega tools do registry
     */
    reloadTools(): void {
        this.toolsService.reloadTools();
    }
}

/**
 * Factory para loops integrados com registry
 */
export class RegistryIntegratedLoopFactory {
    /**
     * Cria loop básico com registry
     */
    static createBasic(options?: Partial<RegistryIntegrationOptions>): RegistryIntegratedToolCallingLoop {
        const defaultOptions: RegistryIntegrationOptions = {
            toolCallLimit: 10,
            enableStreaming: true,
            enableNestedCalls: false,
            enableTelemetry: false,
            model: {
                family: 'openai',
                name: 'gpt-4o-mini'
            },
            request: {},
            
            // Registry specific
            intentType: IntentType.Agent,
            autoDetectIntent: false,
            contextAware: true,
            persistContext: false,
            enableHealing: true,
            autoRegisterTools: true
        };

        return new RegistryIntegratedToolCallingLoop({
            ...defaultOptions,
            ...options
        });
    }

    /**
     * Cria loop para Agent com healing completo
     */
    static createAgent(
        query: string,
        sessionId?: string,
        options?: Partial<RegistryIntegrationOptions>
    ): RegistryIntegratedToolCallingLoop {
        return this.createBasic({
            intentType: IntentType.Agent,
            autoDetectIntent: true,
            persistContext: true,
            sessionId,
            request: { query },
            enableHealing: true,
            ...options
        });
    }

    /**
     * Cria loop para Editor
     */
    static createEditor(
        filePath: string,
        query: string,
        sessionId?: string
    ): RegistryIntegratedToolCallingLoop {
        return this.createBasic({
            intentType: IntentType.Editor,
            persistContext: true,
            sessionId,
            request: { query },
            intentContext: {
                currentFile: { path: filePath },
                userPreferences: { safeMode: false }
            },
            enableHealing: true,
            toolCategories: ['file', 'code']
        });
    }

    /**
     * Cria loop para Search/Debug
     */
    static createSearch(
        query: string,
        workspacePath?: string
    ): RegistryIntegratedToolCallingLoop {
        return this.createBasic({
            intentType: IntentType.Search,
            request: { 
                query,
                context: workspacePath ? { workingDirectory: workspacePath } : undefined
            },
            enableHealing: false,
            toolCategories: ['search', 'utility']
        });
    }

    /**
     * Cria loop customizado
     */
    static createCustom(
        options: RegistryIntegrationOptions
    ): RegistryIntegratedToolCallingLoop {
        return new RegistryIntegratedToolCallingLoop(options);
    }
}

/**
 * Utilitários de integração
 */
export class IntegrationUtils {
    /**
     * Registra tools do diretório de implementações
     */
    static async registerImplementationTools(): Promise<number> {
        // Auto-descoberta e registro de tools
        // Esta seria a implementação para escanear o diretório implementations/
        return 0;
    }

    /**
     * Cria sistema completo integrado
     */
    static createIntegratedSystem(options?: {
        sessionId?: string;
        enableHealing?: boolean;
        autoRegisterTools?: boolean;
        persistContext?: boolean;
    }) {
        const {
            sessionId,
            enableHealing = true,
            autoRegisterTools = true,
            persistContext = true
        } = options || {};

        // Cria healing system
        const healingSystem = enableHealing ? createToolHealingSystem() : undefined;
        
        // Cria tools service
        const toolsService = enableHealing 
            ? ToolsServiceFactory.createWithHealing(healingSystem)
            : ToolsServiceFactory.createBasic();

        return {
            // Core components
            toolsService,
            healingSystem,
            registry: ToolRegistry,
            
            // Factory methods
            createAgent: (query: string) => 
                RegistryIntegratedLoopFactory.createAgent(query, sessionId, {
                    enableHealing,
                    persistContext,
                    autoRegisterTools
                }),
                
            createEditor: (filePath: string, query: string) =>
                RegistryIntegratedLoopFactory.createEditor(filePath, query, sessionId),
                
            createSearch: (query: string, workspacePath?: string) =>
                RegistryIntegratedLoopFactory.createSearch(query, workspacePath),
                
            // Utility methods
            addTool: (toolCtor: BaseToolCtor) => toolsService.addTool(toolCtor),
            getStats: () => ({
                toolsService: toolsService.getStats(),
                registry: ToolRegistry.getStats(),
                healing: healingSystem?.getFlagsSummary()
            }),
            
            // Context management
            saveContext: (context: IntentContext) => 
                sessionId ? IntentContextManager.saveContext(sessionId, context) : undefined,
                
            getContext: () =>
                sessionId ? IntentContextManager.getContext(sessionId) : undefined
        };
    }
}