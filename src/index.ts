/*---------------------------------------------------------------------------------------------
 * CLI Agent Tools SDK - Main Export File
 * 
 * Direct access to CLI tools without framework dependencies or wrappers
 *--------------------------------------------------------------------------------------------*/

// Import all tools to ensure they're registered
import './tools/implementations/readFileTool';
import './tools/implementations/writeFileTool';
import './tools/implementations/editFileTool';
import './tools/implementations/bashCommandTool';
import './tools/implementations/executeCommandTool';
import './tools/implementations/globTool';
import './tools/implementations/grepTool';
import './tools/implementations/listDirectoryTool';
import './tools/implementations/webSearchTool';
import './tools/implementations/webFetchTool';
import './tools/implementations/taskTool';
import './tools/implementations/todoWriteTool';
import './tools/implementations/multiEditTool';
import './tools/implementations/advancedDiffTool';
import './tools/implementations/advancedNotebookTool';
import './tools/implementations/advancedPatchTool';
import './tools/implementations/computerUseTool';
import './tools/implementations/createExecutionPlanTool';
import './tools/implementations/enhancedWebSearchTool';
import './tools/implementations/exitPlanModeTool';
import './tools/implementations/fetchDocumentationTool';
import './tools/implementations/intelligentTestAnalyzerTool';
import './tools/implementations/mcpIntegrationTool';
import './tools/implementations/notebookEditTool';
import './tools/implementations/notebookReadTool';
import './tools/implementations/searchCodeTool';
import './tools/implementations/symbolAnalysisTool';
import './tools/implementations/textEditorTool';
import './tools/implementations/memoryTool';

// Core exports - direct access to tools
export { ToolRegistry } from './tools/registry/toolRegistry';
import { ToolRegistry } from './tools/registry/toolRegistry';
export { BaseTool } from './tools/base/baseTool';
export type { IToolParams, IToolResult } from './tools/base/baseTool';
import type { IToolResult } from './tools/base/baseTool';
export type { BaseToolCtor } from './tools/registry/toolRegistry';

// CLI types
export type { 
    CliExecutionContext, 
    CliCancellationToken, 
    CliToolResult,
    CliTextPart,
    CliErrorPart,
    CliToolInvocationOptions
} from './tools/types/cliTypes';

/**
 * Simple convenience class for tool discovery and usage
 * No framework dependencies, no conversions, no wrappers
 */
export class CLIAgentTools {
    
    /**
     * Get all registered tools directly from registry
     */
    static getAllTools() {
        return Array.from(ToolRegistry.getTools());
    }
    
    /**
     * Get tools by category
     */
    static getToolsByCategory(category: string) {
        return Array.from(ToolRegistry.getToolsByCategory(category));
    }
    
    /**
     * Get tools by tag
     */
    static getToolsByTag(tag: string) {
        return Array.from(ToolRegistry.getToolsByTag(tag));
    }
    
    /**
     * Get a specific tool by name
     */
    static getTool(name: string) {
        return ToolRegistry.getTool(name);
    }
    
    /**
     * Get file operation tools
     */
    static getFileTools() {
        return this.getToolsByCategory('file_operations');
    }
    
    /**
     * Get search and analysis tools
     */
    static getSearchTools() {
        return this.getToolsByCategory('search-analysis');
    }
    
    /**
     * Get web-related tools
     */
    static getWebTools() {
        return this.getToolsByTag('web');
    }
    
    /**
     * Get development tools
     */
    static getDevTools() {
        return this.getToolsByCategory('development');
    }
    
    /**
     * Get essential tools only
     */
    static getEssentialTools() {
        return ToolRegistry.filterTools({ complexity: 'essential' });
    }
    
    /**
     * Get core tools
     */
    static getCoreTools() {
        return ToolRegistry.filterTools({ complexity: 'core' });
    }
    
    /**
     * Get registry statistics
     */
    static getStats() {
        return ToolRegistry.getStats();
    }
    
    /**
     * Execute a tool directly - Returns IToolResult with required methods
     */
    static async executeTool(toolName: string, input: Record<string, unknown>, context?: any): Promise<IToolResult> {
        try {
            const result = await ToolRegistry.executeTool(toolName, input as any, context);
            
            // Convert CliToolResult to IToolResult
            if (result && typeof result === 'object' && 'parts' in result) {
                // Extract text from CliToolResult parts
                const parts = (result as any).parts || [];
                const hasErrors = parts.some((part: any) => part.type === 'error');
                const errors = parts
                    .filter((part: any) => part.type === 'error')
                    .map((part: any) => part.text || 'Unknown error');
                const allText = parts
                    .map((part: any) => part.text || '')
                    .join('\n')
                    .trim();
                
                return {
                    success: !hasErrors,
                    data: allText,
                    error: hasErrors ? errors[0] : undefined,
                    hasErrors: () => hasErrors,
                    getErrors: () => errors,
                    getText: () => allText
                };
            }
            
            // Fallback for unexpected result format
            return {
                success: true,
                data: result,
                hasErrors: () => false,
                getErrors: () => [],
                getText: () => typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                success: false,
                error: errorMessage,
                hasErrors: () => true,
                getErrors: () => [errorMessage],
                getText: () => `Error: ${errorMessage}`
            };
        }
    }
}

// Version info
export const SDK_VERSION = '2.1.2';

// Usage instructions
export const USAGE_INSTRUCTIONS = `
# CLI Agent Tools SDK - Direct Access

## Quick Start:
import { CLIAgentTools, ToolRegistry } from '@paulohenriquevn/sdkagent';

// Get all tools
const tools = CLIAgentTools.getAllTools();

// Get specific tool
const readTool = CLIAgentTools.getTool('read_file');

// Execute tool directly
const result = await CLIAgentTools.executeTool('read_file', { 
    filePath: './package.json' 
});

// Or use registry directly
const tool = ToolRegistry.getTool('read_file');
const result = await tool.invoke({ input: { filePath: './package.json' } }, cancellationToken);

## No framework dependencies, no conversions, just pure CLI tools!
`;

console.log('🛠️  CLI Agent SDK loaded - 30+ tools ready for direct use!');