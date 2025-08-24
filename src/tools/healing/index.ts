/*---------------------------------------------------------------------------------------------
 * Tool Healing System - Main Export Index
 *--------------------------------------------------------------------------------------------*/

// Core types and interfaces
export * from './healingTypes';

// Healing utilities and LLM functions
export {
    correctOldStringMismatch,
    correctNewString,
    healPatch,
    _unescapeStringForGeminiBug,
    count,
    matchAndCount,
    trimPairIfPossible,
    extractPatchFromResponse,
    isWhitespaceOnly,
    normalizeLineEndings,
    detectLineEnding,
    createHealingContext,
    isGeminiModel,
    createUnescapeFunction
} from './healingUtils';

// String replacement healing with 4-phase algorithm
export {
    AbstractReplaceStringTool,
    EditStringTool,
    StringReplaceToolFactory
} from './stringReplaceHealing';

// Patch application healing
export {
    ApplyPatchTool,
    PatchToolFactory,
    Commit,
    DocText
} from './patchHealing';

// Feature flags and experimentation service
export {
    HealingExperimentationService,
    HealingFeatureFlagManager,
    FeatureFlagUtils,
    requiresHealingFlag,
    HealingFeatureFlags
} from './featureFlags';

/**
 * Main factory to create a complete tool healing system
 */
export function createToolHealingSystem(options?: {
    healEndpointProvider?: () => Promise<import('./healingTypes').HealingEndpoint>;
    telemetryService?: import('./healingTypes').TelemetryService;
    featureFlags?: Partial<import('./featureFlags').HealingFeatureFlags>;
    enableStringReplaceHealing?: boolean;
    enablePatchHealing?: boolean;
    enableDetailedTelemetry?: boolean;
}) {
    const {
        healEndpointProvider,
        telemetryService,
        featureFlags,
        enableStringReplaceHealing = true,
        enablePatchHealing = true,
        enableDetailedTelemetry = true
    } = options || {};

    // Create feature flag service
    const experimentationService = new HealingExperimentationService({
        codeEditingWithLLMStringReplaceHealing: enableStringReplaceHealing,
        patchApplyHealing: enablePatchHealing,
        healingDetailedTelemetry: enableDetailedTelemetry,
        ...featureFlags
    });

    // Create mock services if not provided
    const defaultHealEndpoint = healEndpointProvider || (() => 
        Promise.resolve(StringReplaceToolFactory.createMockHealEndpoint())
    );

    const defaultTelemetryService = telemetryService || 
        StringReplaceToolFactory.createMockTelemetryService();

    // Create healing tools
    const editStringTool = StringReplaceToolFactory.createEditStringTool(
        defaultHealEndpoint,
        experimentationService,
        defaultTelemetryService
    );

    const applyPatchTool = PatchToolFactory.createApplyPatchTool(
        defaultHealEndpoint,
        defaultTelemetryService
    );

    return {
        // Core tools
        editStringTool,
        applyPatchTool,
        
        // Services
        experimentationService,
        
        // Utility functions
        healString: async (
            uri: string,
            oldString: string,
            newString: string,
            fileContent: string,
            model?: { family: string; name: string }
        ) => {
            return editStringTool.execute(uri, oldString, newString, fileContent, model);
        },
        
        healPatch: async (
            patch: string,
            docText: import('./patchHealing').DocText,
            explanation = ''
        ) => {
            return applyPatchTool.applyPatch(patch, docText, explanation);
        },
        
        // Feature flag utilities
        isHealingEnabled: (type: 'string' | 'patch') => {
            return FeatureFlagUtils.isHealingEnabled(type);
        },
        
        getHealingTimeout: (type: 'string' | 'patch') => {
            return FeatureFlagUtils.getHealingTimeout(type);
        },
        
        getFlagsSummary: () => {
            return FeatureFlagUtils.createFlagsSummary();
        },
        
        // Configuration updates
        updateFlags: (newFlags: Partial<import('./featureFlags').HealingFeatureFlags>) => {
            experimentationService.setFlags(newFlags);
        },
        
        setOverride: (key: keyof import('./featureFlags').HealingFeatureFlags, value: any) => {
            experimentationService.setOverride(key, value);
        },
        
        clearOverrides: () => {
            experimentationService.clearAllOverrides();
        },
        
        // Monitoring
        getSystemStatus: () => ({
            stringReplaceHealing: {
                enabled: experimentationService.isStringReplaceHealingEnabled(),
                maxAttempts: experimentationService.getStringReplaceMaxAttempts(),
                timeout: experimentationService.getStringReplaceTimeout()
            },
            patchHealing: {
                enabled: experimentationService.isPatchHealingEnabled(),
                maxAttempts: experimentationService.getPatchHealingMaxAttempts(),
                timeout: experimentationService.getPatchHealingTimeout()
            },
            modelFixes: {
                geminiUnescape: experimentationService.isGeminiUnescapeFixEnabled()
            },
            telemetry: {
                detailed: experimentationService.isDetailedTelemetryEnabled(),
                performance: experimentationService.isPerformanceMetricsEnabled()
            },
            limits: {
                concurrent: experimentationService.getHealingConcurrentLimit(),
                contextTruncation: experimentationService.isContextTruncationEnabled()
            }
        })
    };
}

/**
 * Quick setup functions for common scenarios
 */
export const HealingQuickSetup = {
    /**
     * Basic setup with healing enabled
     */
    basic: () => createToolHealingSystem({
        enableStringReplaceHealing: true,
        enablePatchHealing: true,
        enableDetailedTelemetry: false
    }),
    
    /**
     * Development setup with all features and detailed telemetry
     */
    development: () => createToolHealingSystem({
        enableStringReplaceHealing: true,
        enablePatchHealing: true,
        enableDetailedTelemetry: true,
        featureFlags: {
            stringReplaceHealingTimeout: 30000,
            patchHealingTimeout: 30000,
            healingPerformanceMetrics: true
        }
    }),
    
    /**
     * Production setup with optimized settings
     */
    production: () => createToolHealingSystem({
        enableStringReplaceHealing: true,
        enablePatchHealing: true,
        enableDetailedTelemetry: false,
        featureFlags: {
            healingConcurrentLimit: 2,
            healingContextTruncation: true,
            healingPerformanceMetrics: true,
            healingErrorReporting: true
        }
    }),
    
    /**
     * Testing setup with fast timeouts
     */
    testing: () => createToolHealingSystem({
        enableStringReplaceHealing: true,
        enablePatchHealing: true,
        enableDetailedTelemetry: false,
        featureFlags: {
            stringReplaceHealingTimeout: 5000,
            patchHealingTimeout: 5000,
            healingConcurrentLimit: 1,
            healingPerformanceMetrics: false
        }
    }),
    
    /**
     * Disabled setup for baseline testing
     */
    disabled: () => createToolHealingSystem({
        enableStringReplaceHealing: false,
        enablePatchHealing: false,
        enableDetailedTelemetry: false,
        featureFlags: {
            geminiUnescapeFix: false,
            claudeFormattingFix: false,
            gptContextFix: false
        }
    }),
    
    /**
     * String-only healing (patches disabled)
     */
    stringOnly: () => createToolHealingSystem({
        enableStringReplaceHealing: true,
        enablePatchHealing: false,
        enableDetailedTelemetry: true,
        featureFlags: {
            geminiUnescapeFix: true,
            healingPerformanceMetrics: true
        }
    }),
    
    /**
     * Patch-only healing (strings disabled)
     */
    patchOnly: () => createToolHealingSystem({
        enableStringReplaceHealing: false,
        enablePatchHealing: true,
        enableDetailedTelemetry: true,
        featureFlags: {
            patchHealingMaxAttempts: 3,
            healingPerformanceMetrics: true
        }
    })
};

/**
 * Integration helpers for tool calling loop
 */
export class HealingIntegration {
    /**
     * Creates a healing-enabled tool wrapper
     */
    static wrapTool(originalTool: any, healingSystem: ReturnType<typeof createToolHealingSystem>) {
        return {
            ...originalTool,
            
            // Enhanced execute method with healing
            execute: async (...args: any[]) => {
                try {
                    return await originalTool.execute(...args);
                } catch (error) {
                    // Try healing based on tool type
                    if (originalTool.type === 'string_replace') {
                        return healingSystem.healString(...args);
                    } else if (originalTool.type === 'patch_apply') {
                        return healingSystem.healPatch(...args);
                    }
                    
                    // Re-throw if healing not applicable
                    throw error;
                }
            },
            
            // Healing metadata
            healingEnabled: true,
            healingCapabilities: {
                stringReplace: healingSystem.isHealingEnabled('string'),
                patchApply: healingSystem.isHealingEnabled('patch')
            }
        };
    }
    
    /**
     * Creates healing middleware for tool calling loop
     */
    static createMiddleware(healingSystem: ReturnType<typeof createToolHealingSystem>) {
        return {
            beforeToolExecution: (toolCall: any) => {
                // Log healing attempt if applicable
                if (healingSystem.getFlagsSummary().detailedTelemetry) {
                    console.log(`Tool execution with healing support: ${toolCall.name}`);
                }
            },
            
            onToolError: async (toolCall: any, error: Error) => {
                // Attempt healing based on error type and tool
                const healingEnabled = healingSystem.isHealingEnabled(toolCall.type);
                
                if (healingEnabled) {
                    console.log(`Attempting healing for failed tool: ${toolCall.name}`);
                    // Healing logic would be implemented here
                }
                
                return error;
            },
            
            afterToolExecution: (toolCall: any, result: any) => {
                // Log successful healing if applicable
                if (result?.wasHealed) {
                    console.log(`Tool healing successful: ${toolCall.name}`);
                }
            }
        };
    }
}