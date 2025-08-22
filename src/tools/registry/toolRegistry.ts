/*---------------------------------------------------------------------------------------------
 * Tool Registry - Central registry for all CLI tools
 * REFACTORED: Complete VSCode removal
 *--------------------------------------------------------------------------------------------*/

import { BaseTool } from '../base/baseTool';
import { CliExecutionContext, CliToolResult } from '../types/cliTypes';

export type ToolConstructor = new (context?: CliExecutionContext) => BaseTool;

/**
 * CLI Tool Registry - manages all available tools without VSCode dependencies
 */
export class ToolRegistry {
    private static instance: ToolRegistry;
    private tools: Map<string, ToolConstructor> = new Map();
    private defaultContext: CliExecutionContext;

    static getInstance(): ToolRegistry {
        if (!ToolRegistry.instance) {
            ToolRegistry.instance = new ToolRegistry();
        }
        return ToolRegistry.instance;
    }

    constructor(defaultContext?: CliExecutionContext) {
        this.defaultContext = defaultContext || {
            workingDirectory: process.cwd(),
            environment: process.env as Record<string, string>,
            sessionId: `cli-registry-${Date.now()}`,
            timeout: 30000,
            verbose: false
        };
    }

    /**
     * Register a new tool
     */
    registerTool(toolConstructor: ToolConstructor): void {
        // Create temporary instance to get metadata
        const tempInstance = new toolConstructor();
        const toolName = tempInstance.name;

        console.log(`📋 Registering CLI tool: ${toolName}`);
        this.tools.set(toolName, toolConstructor);
    }

    /**
     * List all registered tools
     */
    listTools(): Array<{ name: string; description: string; category: string; complexity: string; tags: string[] }> {
        const toolList: Array<{ name: string; description: string; category: string; complexity: string; tags: string[] }> = [];
        
        for (const [, constructor] of this.tools) {
            const tempInstance = new constructor();
            toolList.push({
                name: tempInstance.name,
                description: tempInstance.description,
                category: tempInstance.category,
                complexity: tempInstance.complexity,
                tags: tempInstance.tags
            });
        }
        
        return toolList.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get default context
     */
    getDefaultContext(): CliExecutionContext {
        return this.defaultContext;
    }

    /**
     * Get tools by category
     */
    getToolsByCategory(category: string): Array<{ name: string; description: string; category: string; complexity: string; tags: string[] }> {
        return this.listTools().filter(tool => tool.category === category);
    }

    /**
     * Get tools by tag
     */
    getToolsByTag(tag: string): Array<{ name: string; description: string; category: string; complexity: string; tags: string[] }> {
        return this.listTools().filter(tool => tool.tags.includes(tag));
    }

    /**
     * Get a tool instance by name
     */
    getTool(name: string, context?: CliExecutionContext): BaseTool | null {
        const ToolConstructor = this.tools.get(name);
        if (!ToolConstructor) {
            return null;
        }
        
        return new ToolConstructor(context || this.defaultContext);
    }

    /**
     * Get all registered tool instances
     */
    getAllTools(context?: CliExecutionContext): BaseTool[] {
        const tools: BaseTool[] = [];
        const contextToUse = context || this.defaultContext;
        
        for (const [toolName, ToolConstructor] of this.tools) {
            try {
                const toolInstance = new ToolConstructor(contextToUse);
                tools.push(toolInstance);
            } catch (error) {
                console.error(`❌ Failed to create CLI tool ${toolName}:`, error);
            }
        }
        
        return tools;
    }

    /**
     * Get tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Check if tool exists
     */
    hasTool(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Execute a tool by name
     */
    async executeTool(
        toolName: string, 
        input: any, 
        context?: CliExecutionContext
    ): Promise<CliToolResult> {
        const tool = this.getTool(toolName, context);
        if (!tool) {
            throw new Error(`Tool '${toolName}' not found in registry`);
        }

        const token = new (await import('../types/cliTypes')).CliCancellationToken();
        const options = {
            input,
            toolName,
            requestId: `exec-${Date.now()}`,
            context: context || this.defaultContext
        };

        return await tool.invoke(options, token);
    }

    // Category and tag-based filtering (instances)
    getToolInstancesByCategory(category: string, context?: CliExecutionContext): BaseTool[] {
        return this.getAllTools(context).filter(tool => tool.getCategory() === category);
    }

    getToolInstancesByTag(tag: string, context?: CliExecutionContext): BaseTool[] {
        return this.getAllTools(context).filter(tool => tool.hasTag(tag));
    }

    getToolsByComplexity(complexity: 'core' | 'advanced' | 'essential', context?: CliExecutionContext): BaseTool[] {
        return this.getAllTools(context).filter(tool => tool.getComplexity() === complexity);
    }

    /**
     * Get category summary
     */
    getCategorySummary(): { [category: string]: number } {
        const summary: { [category: string]: number } = {};
        this.getAllTools().forEach(tool => {
            const category = tool.getCategory();
            summary[category] = (summary[category] || 0) + 1;
        });
        return summary;
    }

    /**
     * Get tag summary
     */
    getTagSummary(): { [tag: string]: number } {
        const summary: { [tag: string]: number } = {};
        this.getAllTools().forEach(tool => {
            tool.getTags().forEach(tag => {
                summary[tag] = (summary[tag] || 0) + 1;
            });
        });
        return summary;
    }

    /**
     * Get tools metadata
     */
    getToolsMetadata(): Array<{
        name: string;
        description: string;
        category: string;
        complexity: string;
        tags: string[];
        inputSchema: unknown;
    }> {
        return this.getAllTools().map(tool => tool.getMetadata());
    }

    /**
     * Validate all registered tools
     */
    async validateAllTools(context?: CliExecutionContext): Promise<{
        valid: string[];
        invalid: Array<{ name: string; error: string }>;
    }> {
        const valid: string[] = [];
        const invalid: Array<{ name: string; error: string }> = [];
        const contextToUse = context || this.defaultContext;

        for (const [toolName, ToolConstructor] of this.tools) {
            try {
                const tool = new ToolConstructor(contextToUse);
                
                // Basic validation
                if (!tool.name || !tool.description || !tool.inputSchema) {
                    throw new Error('Missing required properties: name, description, or inputSchema');
                }
                
                if (!tool.tags || !Array.isArray(tool.tags)) {
                    throw new Error('Missing or invalid tags array');
                }
                
                if (!tool.category || !tool.complexity) {
                    throw new Error('Missing category or complexity');
                }

                valid.push(toolName);
            } catch (error) {
                invalid.push({
                    name: toolName,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return { valid, invalid };
    }

    /**
     * Set default execution context for all tools
     */
    setDefaultContext(context: CliExecutionContext): void {
        this.defaultContext = context;
    }

    /**
     * Get registry statistics
     */
    getStatistics(): {
        totalTools: number;
        categories: { [category: string]: number };
        tags: { [tag: string]: number };
        complexity: { [level: string]: number };
    } {
        const allTools = this.getAllTools();
        const complexity: { [level: string]: number } = {
            core: 0,
            advanced: 0,
            essential: 0
        };

        allTools.forEach(tool => {
            complexity[tool.getComplexity()]++;
        });

        return {
            totalTools: allTools.length,
            categories: this.getCategorySummary(),
            tags: this.getTagSummary(),
            complexity
        };
    }

    /**
     * Clear all registered tools
     */
    clear(): void {
        this.tools.clear();
        console.log('🧹 Tool registry cleared');
    }

    /**
     * Remove a specific tool
     */
    unregisterTool(toolName: string): boolean {
        const removed = this.tools.delete(toolName);
        if (removed) {
            console.log(`🗑️ Tool '${toolName}' unregistered`);
        }
        return removed;
    }
}