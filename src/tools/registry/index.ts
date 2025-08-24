/*---------------------------------------------------------------------------------------------
 * Tool Registry System - Exportações principais e sistema completo integrado
 *--------------------------------------------------------------------------------------------*/

// Core registry components
export * from './toolRegistry';
export * from './toolsService';
export * from './intentLayer';
export * from './toolCallingLoopIntegration';

// Re-export execution system for convenience
export {
    createToolCallingSystem,
    QuickSetup as ExecutionQuickSetup
} from '../execution';

// Re-export healing system
export {
    createToolHealingSystem,
    HealingQuickSetup
} from '../healing';

// Main integration
import { IntegrationUtils, RegistryIntegratedLoopFactory } from './toolCallingLoopIntegration';
import { ToolRegistry, BaseToolCtor } from './toolRegistry';
import { ToolsServiceFactory } from './toolsService';
import { IntentType, IntentFactory, IntentContextManager } from './intentLayer';
import { createToolHealingSystem } from '../healing';

/**
 * Sistema completo integrado ToolRegistry ↔ Tool Calling Loop
 */
export function createIntegratedToolSystem(options?: {
    sessionId?: string;
    enableHealing?: boolean;
    enableStreaming?: boolean;
    enableNesting?: boolean;
    enableMonitoring?: boolean;
    autoRegisterTools?: boolean;
    persistContext?: boolean;
    defaultIntent?: IntentType;
    workingDirectory?: string;
}) {
    const {
        sessionId = `session_${Date.now()}`,
        enableHealing = true,
        enableStreaming = true,
        enableNesting = false,
        enableMonitoring = true,
        autoRegisterTools = true,
        persistContext = true,
        defaultIntent = IntentType.Agent,
        workingDirectory = process.cwd()
    } = options || {};

    // Inicializa sistemas base
    const healingSystem = enableHealing ? createToolHealingSystem() : undefined;
    const toolsService = enableHealing 
        ? ToolsServiceFactory.createWithHealing(healingSystem)
        : ToolsServiceFactory.createBasic();

    // Auto-registra tools se solicitado
    if (autoRegisterTools) {
        console.log('🔧 Auto-registering available tools...');
        // Aqui seria implementada a descoberta automática
    }

    return {
        // Core components
        registry: ToolRegistry,
        toolsService,
        healingSystem,
        
        // Session management
        sessionId,
        saveContext: (context: any) => IntentContextManager.saveContext(sessionId, context),
        getContext: () => IntentContextManager.getContext(sessionId),
        
        // Tool management
        registerTool: (toolCtor: BaseToolCtor) => {
            ToolRegistry.registerTool(toolCtor);
            return toolsService.addTool(toolCtor);
        },
        
        unregisterTool: (toolName: string) => {
            ToolRegistry.unregisterTool(toolName);
            return toolsService.removeTool(toolName);
        },
        
        listTools: () => ToolRegistry.getToolsSummary(),
        getToolStats: () => ToolRegistry.getStats(),
        
        // Execution factories
        createAgent: (query: string, overrides?: any) => 
            RegistryIntegratedLoopFactory.createAgent(query, sessionId, {
                enableHealing,
                enableStreaming,
                enableNestedCalls: enableNesting,
                enableTelemetry: enableMonitoring,
                persistContext,
                autoRegisterTools,
                ...overrides
            }),
            
        createEditor: (filePath: string, query: string, overrides?: any) =>
            RegistryIntegratedLoopFactory.createEditor(filePath, query, sessionId),
            
        createSearch: (query: string, workspace?: string, overrides?: any) =>
            RegistryIntegratedLoopFactory.createSearch(query, workspace || workingDirectory),
            
        createCustom: (intentType: IntentType, query: string, overrides?: any) => 
            RegistryIntegratedLoopFactory.createCustom({
                intentType,
                request: { 
                    query,
                    context: { workingDirectory }
                },
                sessionId,
                enableHealing,
                enableStreaming,
                enableNestedCalls: enableNesting,
                enableTelemetry: enableMonitoring,
                persistContext,
                autoRegisterTools,
                ...overrides
            }),
        
        // Intent management
        detectIntent: (query: string, request?: any, context?: any) =>
            IntentFactory.detectIntent(
                query, 
                toolsService, 
                request || { query, context: { workingDirectory } },
                context
            ),
        
        // Quick execution methods
        execute: async (query: string, options?: {
            intentType?: IntentType;
            filePath?: string;
            workspace?: string;
            context?: any;
        }) => {
            const { intentType, filePath, workspace, context } = options || {};
            
            let loop;
            
            if (filePath) {
                loop = RegistryIntegratedLoopFactory.createEditor(filePath, query, sessionId);
            } else if (intentType === IntentType.Search) {
                loop = RegistryIntegratedLoopFactory.createSearch(query, workspace);
            } else if (intentType) {
                loop = RegistryIntegratedLoopFactory.createCustom({
                    intentType,
                    request: { query, context: { workingDirectory: workspace || workingDirectory } },
                    sessionId,
                    enableHealing,
                    persistContext
                });
            } else {
                loop = RegistryIntegratedLoopFactory.createAgent(query, sessionId, {
                    autoDetectIntent: true
                });
            }
            
            const result = await loop.executeLoop();
            return {
                ...result,
                stats: loop.getIntegrationStats()
            };
        },
        
        // System status
        getSystemStatus: () => ({
            session: {
                id: sessionId,
                persistent: persistContext,
                hasContext: !!IntentContextManager.getContext(sessionId)
            },
            registry: {
                totalTools: ToolRegistry.getStats().totalTools,
                categories: ToolRegistry.getCategories().length,
                tags: ToolRegistry.getTags().length
            },
            service: toolsService.getStats(),
            healing: healingSystem ? {
                enabled: true,
                summary: healingSystem.getFlagsSummary()
            } : { enabled: false },
            features: {
                streaming: enableStreaming,
                nesting: enableNesting,
                monitoring: enableMonitoring,
                autoRegister: autoRegisterTools
            }
        }),
        
        // Utilities
        reloadTools: () => toolsService.reloadTools(),
        validateTool: (toolCtor: BaseToolCtor) => ToolRegistry.validateTool(toolCtor),
        
        // Cleanup
        dispose: () => {
            if (persistContext) {
                IntentContextManager.saveContext(sessionId, {
                    sessionData: {
                        previousTools: [],
                        failedTools: [],
                        preferences: { disposed: true }
                    }
                });
            }
        }
    };
}

/**
 * Quick setup presets for common scenarios
 */
export const IntegratedQuickSetup = {
    /**
     * Setup básico para desenvolvimento
     */
    development: () => createIntegratedToolSystem({
        enableHealing: true,
        enableStreaming: true,
        enableMonitoring: true,
        persistContext: true,
        autoRegisterTools: true
    }),
    
    /**
     * Setup otimizado para produção
     */
    production: () => createIntegratedToolSystem({
        enableHealing: true,
        enableStreaming: true,
        enableNesting: true,
        enableMonitoring: true,
        persistContext: true,
        autoRegisterTools: true
    }),
    
    /**
     * Setup para edição de arquivos
     */
    editor: (filePath: string) => {
        const system = createIntegratedToolSystem({
            defaultIntent: IntentType.Editor,
            enableHealing: true,
            persistContext: false
        });
        return {
            ...system,
            edit: (query: string) => system.createEditor(filePath, query)
        };
    },
    
    /**
     * Setup para busca e análise
     */
    search: (workspacePath?: string) => {
        const system = createIntegratedToolSystem({
            defaultIntent: IntentType.Search,
            workingDirectory: workspacePath,
            enableHealing: false,
            enableStreaming: false
        });
        return {
            ...system,
            search: (query: string) => system.createSearch(query, workspacePath)
        };
    },
    
    /**
     * Setup mínimo para testes
     */
    testing: () => createIntegratedToolSystem({
        enableHealing: false,
        enableStreaming: false,
        enableMonitoring: false,
        persistContext: false,
        autoRegisterTools: false
    }),
    
    /**
     * Setup completo com todas as funcionalidades
     */
    complete: () => createIntegratedToolSystem({
        enableHealing: true,
        enableStreaming: true,
        enableNesting: true,
        enableMonitoring: true,
        persistContext: true,
        autoRegisterTools: true
    })
};

/**
 * Função de conveniência para execução rápida
 */
export async function quickExecute(
    query: string,
    options?: {
        intent?: IntentType;
        filePath?: string;
        workspace?: string;
        healing?: boolean;
        streaming?: boolean;
        sessionId?: string;
    }
): Promise<any> {
    const system = createIntegratedToolSystem({
        enableHealing: options?.healing ?? true,
        enableStreaming: options?.streaming ?? true,
        sessionId: options?.sessionId
    });
    
    return system.execute(query, {
        intentType: options?.intent,
        filePath: options?.filePath,
        workspace: options?.workspace
    });
}

/**
 * Exemplo de uso completo
 */
export function createExampleUsage() {
    return {
        // Exemplo 1: Sistema básico
        basic: async () => {
            const system = IntegratedQuickSetup.development();
            const result = await system.execute("List all Python files in the project");
            console.log('Result:', result);
        },
        
        // Exemplo 2: Editor de arquivos  
        editing: async () => {
            const system = IntegratedQuickSetup.editor('/path/to/file.py');
            const result = await system.edit("Add a docstring to the main function");
            console.log('Edit result:', result);
        },
        
        // Exemplo 3: Busca com contexto
        searching: async () => {
            const system = IntegratedQuickSetup.search('/project/path');
            const result = await system.search("Find all TODO comments");
            console.log('Search result:', result);
        },
        
        // Exemplo 4: Agent completo
        agent: async () => {
            const system = IntegratedQuickSetup.complete();
            
            // Registra tool customizada
            // system.registerTool(MyCustomTool);
            
            // Executa com agent
            const result = await system.createAgent(
                "Analyze the codebase and suggest improvements"
            ).executeLoop();
            
            console.log('Agent result:', result);
            console.log('System status:', system.getSystemStatus());
        }
    };
}

// Exporta sistema integrado como default
export default createIntegratedToolSystem;