/*---------------------------------------------------------------------------------------------
 * CLI Agent SDK for LangGraph - Main Export File
 * 
 * Exports all bridge functionality for easy import in external LangGraph projects
 *--------------------------------------------------------------------------------------------*/

// Main SDK classes and interfaces
export {
    SDKLangGraph,
    CLIAgentTools,
    type LangChainToolInterface,
    type SDKLangGraphConfig,
    type ToolMetadata,
    type SDKExecutionResult
} from './SDKLangGraph';

// Import for use in QuickStart class
import { CLIAgentTools } from './SDKLangGraph';

// Examples for reference (commented out to avoid execution)
// export * from './examples/basicUsage';
// export * from './examples/realWorldExample';

// Re-export useful types from the registry for external use
export type { BaseToolCtor } from '../tools/registry/toolRegistry';
export type { BaseTool, IToolParams } from '../tools/base/baseTool';

// Quick start convenience functions
export class QuickStart {
    /**
     * Get all tools with default configuration
     */
    static getAllTools() {
        return CLIAgentTools.getAllTools();
    }

    /**
     * Get recommended tools for general use
     */
    static getRecommendedTools() {
        return CLIAgentTools.getAllTools({
            includeComplexity: ['essential', 'core']
        });
    }

    /**
     * Get tools for code analysis workflows
     */
    static getCodeAnalysisTools() {
        const bridge = CLIAgentTools.createSDK({
            includeCategories: ['file_operations', 'search-analysis'],
            includeTags: ['core', 'essential', 'search-analysis']
        });
        return bridge.getAllTools();
    }

    /**
     * Get tools for web-based workflows
     */
    static getWebWorkflowTools() {
        const bridge = CLIAgentTools.createSDK({
            includeCategories: ['file_operations', 'web', 'network'],
            includeTags: ['core', 'essential', 'web', 'api']
        });
        return bridge.getAllTools();
    }
}

// Version info
export const BRIDGE_VERSION = '1.0.0';

// Usage instructions
export const USAGE_INSTRUCTIONS = `
# CLI Agent Tools for LangGraph

## Quick Start:
import { CLIAgentTools } from 'path/to/cli-agent/src/bridge';
const tools = CLIAgentTools.getAllTools();

## In your LangGraph project:
const agent = createReactAgent({ llm: model, tools });

## See README.md for complete documentation and examples.
`;

console.log('CLI Agent SDK loaded - 30+ CLI Agent tools ready for LangGraph projects! 🚀');