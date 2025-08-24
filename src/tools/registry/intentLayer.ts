/*---------------------------------------------------------------------------------------------
 * Intent Layer - Filtragem contextual de tools baseada em intenção (CLI puro - SEM VS Code)
 *--------------------------------------------------------------------------------------------*/

import { LanguageModelToolInformation } from '../execution/types';
import { IToolsService, CliRequest, ToolFilter } from './toolsService';
// Removed IBuildPromptContext as it's no longer available

/**
 * Tipos de intent suportados
 */
export enum IntentType {
    Agent = 'agent',           // Agent geral - quase todas as tools
    Editor = 'editor',         // Foco em edição de arquivos
    Search = 'search',         // Foco em busca e análise
    Debug = 'debug',           // Foco em debugging e análise
    Git = 'git',              // Foco em operações Git
    File = 'file',            // Foco em operações de arquivo
    AI = 'ai',                // Foco em operações de IA/LLM
    Utility = 'utility'       // Utilitários gerais
}

/**
 * Configuração de intent
 */
export interface IntentConfig {
    type: IntentType;
    allowedCategories?: string[];
    blockedCategories?: string[];
    allowedTools?: string[];
    blockedTools?: string[];
    requiredTags?: string[];
    blockedTags?: string[];
    maxTools?: number;
    priorityThreshold?: number;
    enableHealing?: boolean;
    contextAware?: boolean;
}

/**
 * Contexto de intent
 */
export interface IntentContext {
    currentFile?: {
        path: string;
        content?: string;
        language?: string;
    };
    workspace?: {
        rootPath: string;
        files: string[];
        gitRepository?: boolean;
    };
    userPreferences?: {
        verboseMode?: boolean;
        safeMode?: boolean;
        experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
    };
    sessionData?: {
        previousTools: string[];
        failedTools: string[];
        preferences: Record<string, unknown>;
    };
}

/**
 * Interface para invocação de intent
 */
export interface IIntentInvocation {
    /**
     * Tipo do intent
     */
    readonly type: IntentType;

    /**
     * Configuração do intent
     */
    readonly config: IntentConfig;

    /**
     * Request original
     */
    readonly request: CliRequest;

    /**
     * Contexto do intent
     */
    readonly context?: IntentContext;

    /**
     * Obtém tools disponíveis para este intent
     */
    getAvailableTools(): Promise<LanguageModelToolInformation[]>;

    /**
     * Filtra tools baseado no contexto
     */
    filterTools?(tools: LanguageModelToolInformation[]): LanguageModelToolInformation[];

    /**
     * Prioriza tools baseado no contexto
     */
    prioritizeTools?(tools: LanguageModelToolInformation[]): LanguageModelToolInformation[];

    /**
     * Valida se tool pode ser usada neste contexto
     */
    canUseTool?(toolName: string): boolean;
}

/**
 * Implementação base de intent
 */
export abstract class BaseIntentInvocation implements IIntentInvocation {
    public readonly type: IntentType;
    public readonly config: IntentConfig;
    public readonly request: CliRequest;
    public readonly context?: IntentContext;

    constructor(
        protected readonly toolsService: IToolsService,
        type: IntentType,
        request: CliRequest,
        config?: Partial<IntentConfig>,
        context?: IntentContext
    ) {
        this.type = type;
        this.request = request;
        this.context = context;
        this.config = {
            type,
            maxTools: 50,
            priorityThreshold: 0,
            enableHealing: true,
            contextAware: true,
            ...config
        };
    }

    /**
     * Implementação padrão de getAvailableTools
     */
    async getAvailableTools(): Promise<LanguageModelToolInformation[]> {
        // Obtém tools básicas do service
        const allTools = this.toolsService.getEnabledTools(this.request, this.createFilter());
        
        // Aplica filtros específicos do intent
        let filteredTools = this.applyIntentFilters(allTools);
        
        // Aplica filtro customizado se disponível
        if (this.filterTools) {
            filteredTools = this.filterTools(filteredTools);
        }
        
        // Prioriza tools se disponível
        if (this.prioritizeTools) {
            filteredTools = this.prioritizeTools(filteredTools);
        }
        
        // Aplica limite máximo
        if (this.config.maxTools && filteredTools.length > this.config.maxTools) {
            filteredTools = filteredTools.slice(0, this.config.maxTools);
        }
        
        return filteredTools;
    }

    /**
     * Cria filtro baseado na configuração do intent
     */
    private createFilter(): ToolFilter {
        return (tool: LanguageModelToolInformation) => {
            // Verifica tools bloqueadas
            if (this.config.blockedTools?.includes(tool.name)) {
                return false;
            }
            
            // Verifica tools permitidas (se especificado)
            if (this.config.allowedTools && !this.config.allowedTools.includes(tool.name)) {
                return false;
            }
            
            // Verifica tags bloqueadas
            if (this.config.blockedTags && tool.tags) {
                if (this.config.blockedTags && tool.tags.some(tag => this.config.blockedTags?.includes(tag))) {
                    return false;
                }
            }
            
            // Verifica tags obrigatórias
            if (this.config.requiredTags && tool.tags) {
                if (this.config.requiredTags && !this.config.requiredTags.every(tag => tool.tags?.includes(tag))) {
                    return false;
                }
            }
            
            return undefined; // Usa lógica padrão
        };
    }

    /**
     * Aplica filtros específicos do intent
     */
    protected applyIntentFilters(tools: LanguageModelToolInformation[]): LanguageModelToolInformation[] {
        let filtered = tools;
        
        // Filtra por categorias permitidas
        if (this.config.allowedCategories) {
            filtered = filtered.filter(tool => {
                const copilotTool = this.toolsService.getBaseTool(tool.name);
                return copilotTool && this.config.allowedCategories?.includes(copilotTool.category || '') === true;
            });
        }
        
        // Remove categorias bloqueadas
        if (this.config.blockedCategories) {
            filtered = filtered.filter(tool => {
                const copilotTool = this.toolsService.getBaseTool(tool.name);
                return !copilotTool || !this.config.blockedCategories?.includes(copilotTool.category || '');
            });
        }
        
        // Priority filtering removed - priority property doesn't exist in current architecture
        // if (this.config.priorityThreshold > 0) {
        //     filtered = filtered.filter(tool => {
        //         const copilotTool = this.toolsService.getBaseTool(tool.name);
        //         return copilotTool && (copilotTool.priority || 0) >= this.config.priorityThreshold!;
        //     });
        // }
        
        return filtered;
    }

    /**
     * Implementação padrão de canUseTool
     */
    canUseTool(toolName: string): boolean {
        // Verifica tools bloqueadas
        if (this.config.blockedTools?.includes(toolName)) {
            return false;
        }
        
        // Verifica tools permitidas
        if (this.config.allowedTools && !this.config.allowedTools.includes(toolName)) {
            return false;
        }
        
        return true;
    }

    /**
     * Métodos opcionais que subclasses podem implementar
     */
    filterTools?(tools: LanguageModelToolInformation[]): LanguageModelToolInformation[];
    prioritizeTools?(tools: LanguageModelToolInformation[]): LanguageModelToolInformation[];
}

/**
 * Intent de Agent - disponibiliza quase todas as tools
 */
export class AgentIntentInvocation extends BaseIntentInvocation {
    constructor(
        toolsService: IToolsService,
        request: CliRequest,
        context?: IntentContext
    ) {
        super(toolsService, IntentType.Agent, request, {
            maxTools: 100,
            enableHealing: true,
            contextAware: true
        }, context);
    }

    filterTools(tools: LanguageModelToolInformation[]): LanguageModelToolInformation[] {
        // Agent pode usar quase todas as tools, exceto algumas perigosas em modo seguro
        if (this.context?.userPreferences?.safeMode) {
            return tools.filter(tool => !tool.tags?.includes('destructive'));
        }
        
        return tools;
    }

    prioritizeTools(tools: LanguageModelToolInformation[]): LanguageModelToolInformation[] {
        // Prioriza tools baseado no contexto atual
        const prioritized = [...tools];
        
        // Se há arquivo atual, prioriza tools de edição
        if (this.context?.currentFile) {
            prioritized.sort((a, b) => {
                const aIsEdit = a.tags?.includes('edit') || a.name.includes('edit');
                const bIsEdit = b.tags?.includes('edit') || b.name.includes('edit');
                
                if (aIsEdit && !bIsEdit) {return -1;}
                if (!aIsEdit && bIsEdit) {return 1;}
                return 0;
            });
        }
        
        // Se é repositório Git, prioriza tools de Git
        if (this.context?.workspace?.gitRepository) {
            prioritized.sort((a, b) => {
                const aIsGit = a.tags?.includes('git') || a.name.includes('git');
                const bIsGit = b.tags?.includes('git') || b.name.includes('git');
                
                if (aIsGit && !bIsGit) {return -1;}
                if (!aIsGit && bIsGit) {return 1;}
                return 0;
            });
        }
        
        return prioritized;
    }
}

/**
 * Intent de Editor - foco em edição de arquivos
 */
export class EditorIntentInvocation extends BaseIntentInvocation {
    constructor(
        toolsService: IToolsService,
        request: CliRequest,
        context?: IntentContext
    ) {
        super(toolsService, IntentType.Editor, request, {
            allowedCategories: ['file', 'code'],
            allowedTools: ['editFile', 'readFile', 'writeFile', 'multiEdit', 'search'],
            maxTools: 20,
            enableHealing: true
        }, context);
    }

    filterTools(tools: LanguageModelToolInformation[]): LanguageModelToolInformation[] {
        // Editor foca apenas em tools de edição e leitura
        return tools.filter(tool => {
            return tool.name.includes('edit') || 
                   tool.name.includes('read') || 
                   tool.name.includes('write') || 
                   tool.name.includes('search') ||
                   tool.tags?.includes('file');
        });
    }
}

/**
 * Intent de Search - foco em busca e análise
 */
export class SearchIntentInvocation extends BaseIntentInvocation {
    constructor(
        toolsService: IToolsService,
        request: CliRequest,
        context?: IntentContext
    ) {
        super(toolsService, IntentType.Search, request, {
            allowedCategories: ['search', 'utility'],
            requiredTags: ['search'],
            maxTools: 15,
            enableHealing: false
        }, context);
    }

    filterTools(tools: LanguageModelToolInformation[]): LanguageModelToolInformation[] {
        // Search foca em tools de busca, grep, e análise
        return tools.filter(tool => {
            return tool.name.includes('search') ||
                   tool.name.includes('grep') ||
                   tool.name.includes('find') ||
                   tool.name.includes('glob') ||
                   tool.tags?.includes('search');
        });
    }
}

/**
 * Intent de Debug - foco em debugging
 */
export class DebugIntentInvocation extends BaseIntentInvocation {
    constructor(
        toolsService: IToolsService,
        request: CliRequest,
        context?: IntentContext
    ) {
        super(toolsService, IntentType.Debug, request, {
            allowedCategories: ['debug', 'utility', 'ai'],
            requiredTags: ['debug'],
            maxTools: 25,
            enableHealing: true
        }, context);
    }

    filterTools(tools: LanguageModelToolInformation[]): LanguageModelToolInformation[] {
        // Debug permite tools de análise, teste, e execução
        return tools.filter(tool => {
            return tool.tags?.includes('debug') ||
                   tool.tags?.includes('analysis') ||
                   tool.name.includes('test') ||
                   tool.name.includes('analyze') ||
                   tool.name.includes('inspect');
        });
    }
}

/**
 * Factory para criação de intents
 */
export class IntentFactory {
    /**
     * Cria intent baseado no tipo
     */
    static createIntent(
        type: IntentType,
        toolsService: IToolsService,
        request: CliRequest,
        context?: IntentContext
    ): IIntentInvocation {
        switch (type) {
            case IntentType.Agent:
                return new AgentIntentInvocation(toolsService, request, context);
            
            case IntentType.Editor:
                return new EditorIntentInvocation(toolsService, request, context);
            
            case IntentType.Search:
                return new SearchIntentInvocation(toolsService, request, context);
            
            case IntentType.Debug:
                return new DebugIntentInvocation(toolsService, request, context);
            
            // Para outros tipos, usa implementação genérica
            default:
                return new class extends BaseIntentInvocation {
                    constructor() {
                        super(toolsService, type, request, {}, context);
                    }
                }();
        }
    }

    /**
     * Detecta intent automaticamente baseado na query
     */
    static detectIntent(
        query: string,
        toolsService: IToolsService,
        request: CliRequest,
        context?: IntentContext
    ): IIntentInvocation {
        const queryLower = query.toLowerCase();
        
        // Detecta intent de edição
        if (queryLower.includes('edit') || 
            queryLower.includes('change') || 
            queryLower.includes('modify') ||
            queryLower.includes('update')) {
            return this.createIntent(IntentType.Editor, toolsService, request, context);
        }
        
        // Detecta intent de busca
        if (queryLower.includes('search') || 
            queryLower.includes('find') || 
            queryLower.includes('grep') ||
            queryLower.includes('look for')) {
            return this.createIntent(IntentType.Search, toolsService, request, context);
        }
        
        // Detecta intent de debug
        if (queryLower.includes('debug') || 
            queryLower.includes('test') || 
            queryLower.includes('analyze') ||
            queryLower.includes('check')) {
            return this.createIntent(IntentType.Debug, toolsService, request, context);
        }
        
        // Default para Agent
        return this.createIntent(IntentType.Agent, toolsService, request, context);
    }

    /**
     * Cria intent customizado
     */
    static createCustomIntent(
        config: IntentConfig,
        toolsService: IToolsService,
        request: CliRequest,
        context?: IntentContext
    ): IIntentInvocation {
        return new class extends BaseIntentInvocation {
            constructor() {
                super(toolsService, config.type, request, config, context);
            }
        }();
    }
}

/**
 * Gerenciador de contexto de intent
 */
export class IntentContextManager {
    private static contexts = new Map<string, IntentContext>();
    
    /**
     * Salva contexto de sessão
     */
    static saveContext(sessionId: string, context: IntentContext): void {
        this.contexts.set(sessionId, context);
    }
    
    /**
     * Obtém contexto de sessão
     */
    static getContext(sessionId: string): IntentContext | undefined {
        return this.contexts.get(sessionId);
    }
    
    /**
     * Atualiza contexto baseado no histórico
     */
    static updateContext(sessionId: string, updates: Partial<IntentContext>): void {
        const existing = this.contexts.get(sessionId) || {};
        this.contexts.set(sessionId, { ...existing, ...updates });
    }
    
    /**
     * Cria contexto a partir do request
     */
    static createFromRequest(request: CliRequest): IntentContext {
        return {
            workspace: {
                rootPath: request.context?.workingDirectory || process.cwd(),
                files: request.context?.files || [],
                gitRepository: false // Seria detectado dinamicamente
            },
            userPreferences: {
                verboseMode: request.options?.verbose || false,
                safeMode: request.options?.dryRun || false,
                experienceLevel: 'intermediate'
            },
            sessionData: {
                previousTools: [],
                failedTools: [],
                preferences: {}
            }
        };
    }
}