/*---------------------------------------------------------------------------------------------
 * Tool Calling Loop Robusto - Main Export Index
 *--------------------------------------------------------------------------------------------*/

// Core types and interfaces
export * from './types';

// Pause and cancellation system
export {
    PauseController,
    DeferredPromiseImpl,
    EventEmitter,
    DisposableBase,
    CancellationUtils
} from './pauseController';

// Streaming system with pause/unpause support
export {
    ThinkingDataItemImpl,
    FetchStreamSourceImpl,
    ResponsiveChatResponseStream,
    StreamProcessor,
    StreamFactory,
    StreamUtils,
    StreamBuffer
} from './streamingSystem';

// Abstract tool calling loop and implementations
export {
    ToolCallingLoop,
    BasicToolCallingLoop,
    ToolCallingLoopFactory,
    ToolCallingLoopProgress
} from './toolCallingLoop';

// Tool call ID management system
export {
    ToolCallIdManager,
    ToolCallIdManagerFactory,
    ToolCallIdUtils,
    ToolCallIdContext,
    ToolCallRecord,
    IdGenerationStrategy
} from './toolCallIdManager';

// Validation and sanitization layer
export {
    ToolCallingValidator,
    ValidationFactory,
    ValidationResult,
    ValidationError,
    ValidationWarning,
    ValidationConfig,
    ValidationSchema,
    ValidationContext
} from './validation';

// Nested tool calls support
export {
    NestedToolCallingLoop,
    NestedToolCallingLoopFactory,
    NestedContextManager,
    NestedExecutionContext,
    NestedExecutionResult,
    NestedCallsConfig,
    NestedCallRestrictions
} from './nestedCalls';

// Comprehensive monitoring system
export {
    ToolCallingMonitor,
    MonitoringFactory,
    MetricsCollector,
    AlertSystem,
    PerformanceMetrics,
    MonitoringEvent,
    Alert,
    AlertConfig,
    AlertChannel,
    SystemSnapshot,
    MetricsCollectionConfig
} from './monitoring';

/**
 * Main factory function to create a complete tool calling system
 */
export function createToolCallingSystem(options?: {
    loopOptions?: Partial<import('./types').IToolCallingLoopOptions>;
    nestedCallsConfig?: Partial<import('./nestedCalls').NestedCallsConfig>;
    validationConfig?: Partial<import('./validation').ValidationConfig>;
    metricsConfig?: Partial<import('./monitoring').MetricsCollectionConfig>;
    alertConfig?: Partial<import('./monitoring').AlertConfig>;
    enableMonitoring?: boolean;
    enableNesting?: boolean;
    enableStreaming?: boolean;
}) {
    const {
        loopOptions = {},
        nestedCallsConfig = {},
        validationConfig = {},
        metricsConfig = {},
        alertConfig = {},
        enableMonitoring = true,
        enableNesting = false,
        enableStreaming = true
    } = options || {};

    // Create core components
    const idManager = ToolCallIdManagerFactory.createHierarchical();
    const validator = ValidationFactory.createBalanced();
    const pauseController = new PauseController();
    
    // Create monitoring system if enabled
    const monitor = enableMonitoring 
        ? MonitoringFactory.createProduction()
        : undefined;

    // Create appropriate loop implementation
    let loop: ToolCallingLoop<any>;
    
    if (enableNesting) {
        const defaultNestedConfig: import('./nestedCalls').NestedCallsConfig = {
            maxDepth: 3,
            maxCallsPerLevel: 5,
            enableCrossLevelCommunication: true,
            isolateContextBetweenLevels: false,
            propagateErrorsUpward: true,
            timeoutPerLevel: 30000,
            enableParallelExecution: false,
            ...nestedCallsConfig
        };
        
        loop = new NestedToolCallingLoop(
            {
                toolCallLimit: 20,
                enableStreaming,
                enableNestedCalls: true,
                enableTelemetry: enableMonitoring,
                model: { family: 'openai', name: 'gpt-4o-mini' },
                request: {},
                ...loopOptions
            },
            defaultNestedConfig
        );
    } else {
        loop = ToolCallingLoopFactory.createWithStreaming({
            toolCallLimit: 10,
            enableStreaming,
            enableNestedCalls: false,
            enableTelemetry: enableMonitoring,
            model: { family: 'openai', name: 'gpt-4o-mini' },
            request: {},
            ...loopOptions
        });
    }

    return {
        // Core components
        loop,
        idManager,
        validator,
        pauseController,
        monitor,
        
        // Utility methods
        addTool: (name: string, tool: any) => {
            if ('addTool' in loop) {
                (loop as any).addTool(name, tool);
            }
            if ('addNestedTool' in loop) {
                (loop as any).addNestedTool(name, tool);
            }
        },
        
        execute: async (pauseController?: PauseController) => {
            const controller = pauseController || new PauseController();
            const execution = monitor?.monitorExecution(`exec_${Date.now()}`);
            
            try {
                execution?.start();
                const result = await loop.executeLoop(controller);
                const metrics = execution?.end(result.toolCallRounds);
                
                return {
                    ...result,
                    metrics
                };
            } catch (error) {
                execution?.logEvent('error', { 
                    error: error instanceof Error ? error.message : String(error)
                });
                throw error;
            }
        },
        
        getDashboard: () => monitor?.getDashboard(),
        
        dispose: () => {
            loop.dispose();
            idManager.dispose();
            validator.dispose();
            pauseController.dispose();
            monitor?.dispose();
        }
    };
}

/**
 * Quick setup functions for common scenarios
 */
export const QuickSetup = {
    /**
     * Basic setup for simple tool calling
     */
    basic: () => createToolCallingSystem({
        enableMonitoring: false,
        enableNesting: false,
        enableStreaming: true
    }),
    
    /**
     * Development setup with monitoring
     */
    development: () => createToolCallingSystem({
        enableMonitoring: true,
        enableNesting: false,
        enableStreaming: true,
        loopOptions: { toolCallLimit: 20 }
    }),
    
    /**
     * Production setup with all features
     */
    production: () => createToolCallingSystem({
        enableMonitoring: true,
        enableNesting: true,
        enableStreaming: true,
        loopOptions: {
            toolCallLimit: 10,
            enableTelemetry: true
        },
        nestedCallsConfig: {
            maxDepth: 2,
            enableParallelExecution: true
        }
    }),
    
    /**
     * High-performance setup for concurrent workloads
     */
    highPerformance: () => createToolCallingSystem({
        enableMonitoring: true,
        enableNesting: true,
        enableStreaming: true,
        loopOptions: {
            toolCallLimit: 50,
            enableTelemetry: true
        },
        nestedCallsConfig: {
            maxDepth: 5,
            enableParallelExecution: true,
            maxCallsPerLevel: 20
        },
        metricsConfig: {
            collectionInterval: 500,
            enableRealTimeMetrics: true
        }
    })
};