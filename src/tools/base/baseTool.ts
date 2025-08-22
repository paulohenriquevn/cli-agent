/*---------------------------------------------------------------------------------------------
 * Base Tool Interface - CLI version without VSCode dependencies
 * REFACTORED: Complete VSCode removal
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs';
import {
    CliCancellationToken,
    CliToolResult,
    CliTextPart,
    CliErrorPart,
    CliToolInvocationOptions,
    CliPreparedToolInvocation,
    CliToolInvocationPrepareOptions,
    CliExecutionContext,
    createDefaultCliContext,
    CliMarkdownString
} from '../types/cliTypes';

export interface IToolParams {
    [key: string]: any;
}

export interface IToolResult {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
}

export interface IEditFilterData {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
}

/**
 * Base class for all CLI tools - completely removed VSCode dependencies
 */
export abstract class BaseTool<T extends IToolParams = IToolParams> {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly inputSchema: object;

    // Tag system for categorization
    abstract readonly tags: string[];
    abstract readonly category: string;
    abstract readonly complexity: 'core' | 'advanced' | 'essential';

    protected context: CliExecutionContext;

    constructor(context?: CliExecutionContext) {
        this.context = context || createDefaultCliContext();
    }

    // CLI-specific lifecycle hooks
    
    /**
     * Filter and confirm edits before execution
     * Returns confirmation data if user approval is needed
     */
    async filterEdits?(filePath: string): Promise<IEditFilterData | undefined> {
        return undefined; // No filtering by default
    }

    /**
     * Provide dynamic input based on context
     * Allows tools to suggest parameters based on current state
     */
    async provideInput?(context: CliExecutionContext): Promise<T | undefined> {
        return undefined; // No dynamic input by default
    }

    /**
     * Resolve and modify input parameters before execution
     * Allows for parameter transformation and validation
     */
    async resolveInput?(input: T, context: CliExecutionContext): Promise<T> {
        return input; // Return unchanged by default
    }

    /**
     * Alternative tool definition for conditional availability
     * Allows tools to change their schema based on context
     */
    alternativeDefinition?(): { name: string; description: string; inputSchema: any; } | undefined {
        return undefined; // Use standard definition by default
    }

    /**
     * Main tool execution method - CLI version
     */
    abstract invoke(
        options: CliToolInvocationOptions<T>,
        token: CliCancellationToken
    ): Promise<CliToolResult>;

    /**
     * Prepare tool invocation - CLI version
     */
    async prepareInvocation(
        _options: CliToolInvocationPrepareOptions<T>,
        _token: CliCancellationToken
    ): Promise<CliPreparedToolInvocation | undefined> {
        return {
            invocationMessage: `🔧 Executing ${this.name}...`
        };
    }

    // Helper methods for creating results
    protected createSuccessResult(data?: any, message?: string): CliToolResult {
        const content = message || (data ? JSON.stringify(data, null, 2) : 'Operation completed successfully');
        return new CliToolResult([
            new CliTextPart(content)
        ]);
    }

    protected createErrorResult(error: string | Error): CliToolResult {
        const errorMessage = error instanceof Error ? error.message : error;
        return new CliToolResult([
            new CliErrorPart(`❌ Error: ${errorMessage}`)
        ]);
    }

    // File system helpers without VSCode workspace dependencies
    protected validateWorkspace(): string | null {
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!fs.existsSync(workspaceRoot)) {
                return `Workspace directory does not exist: ${workspaceRoot}`;
            }
            return null;
        } catch (error) {
            return error instanceof Error ? error.message : 'Invalid workspace';
        }
    }

    protected getWorkspaceRoot(): string {
        return this.context.workingDirectory;
    }

    protected resolveFilePath(filePath: string): string {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        return path.join(this.getWorkspaceRoot(), filePath);
    }

    // Utility methods for file operations
    protected async readFile(filePath: string): Promise<string> {
        const resolvedPath = this.resolveFilePath(filePath);
        try {
            return await fs.promises.readFile(resolvedPath, 'utf-8');
        } catch (error) {
            throw new Error(`Failed to read file ${resolvedPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    protected async writeFile(filePath: string, content: string): Promise<void> {
        const resolvedPath = this.resolveFilePath(filePath);
        try {
            // Ensure directory exists
            const dir = path.dirname(resolvedPath);
            await fs.promises.mkdir(dir, { recursive: true });
            
            await fs.promises.writeFile(resolvedPath, content, 'utf-8');
        } catch (error) {
            throw new Error(`Failed to write file ${resolvedPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    protected async fileExists(filePath: string): Promise<boolean> {
        const resolvedPath = this.resolveFilePath(filePath);
        try {
            await fs.promises.access(resolvedPath);
            return true;
        } catch {
            return false;
        }
    }

    protected async ensureDirectory(dirPath: string): Promise<void> {
        const resolvedPath = this.resolveFilePath(dirPath);
        await fs.promises.mkdir(resolvedPath, { recursive: true });
    }

    // Tag system methods
    public getTags(): string[] {
        return this.tags;
    }

    public getCategory(): string {
        return this.category;
    }

    public getComplexity(): 'core' | 'advanced' | 'essential' {
        return this.complexity;
    }

    public hasTag(tag: string): boolean {
        return this.tags.includes(tag);
    }

    public getMetadata() {
        return {
            name: this.name,
            category: this.category,
            complexity: this.complexity,
            tags: this.tags,
            description: this.description,
            inputSchema: this.inputSchema
        };
    }

    // Context management
    public setContext(context: CliExecutionContext): void {
        this.context = context;
    }

    public getContext(): CliExecutionContext {
        return this.context;
    }
}