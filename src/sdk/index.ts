/*---------------------------------------------------------------------------------------------
 * CLI Agent SDK - Public API for external integration
 *--------------------------------------------------------------------------------------------*/

export { CliAgentSDK } from './cliAgentSDK';
// export { ToolRegistrySDK } from './toolRegistrySDK';
// export { HealingSDK } from './healingSDK';
// export { NormalizationSDK } from './normalizationSDK';

// Types and interfaces
export type {
    SDKConfig,
    SDKToolResult,
    SDKExecutionContext,
    SDKToolInfo,
    SDKStats,
    ToolExecutionResult,
    HealingResult,
    NormalizationResult
} from './types/sdkTypes';

// Re-export core tool types for convenience
export type {
    CliToolResult,
    CliExecutionContext,
    CliCancellationToken
} from '../tools/types/cliTypes';

export type { IToolParams } from '../tools/base/baseTool';

export { BaseTool } from '../tools/base/baseTool';

// Utility functions
export {
    createDefaultSDKConfig,
    validateSDKConfig,
    createExecutionContext
} from './utils/sdkUtils';