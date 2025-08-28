/*---------------------------------------------------------------------------------------------
 * CLI Types - Substitutos para tipos VSCode
 * Remove completamente dependência do VSCode
 *--------------------------------------------------------------------------------------------*/

/**
 * Cancellation token for CLI operations
 */
export class CliCancellationToken {
    private _isCancelled = false;
    private _onCancellationRequestedCallbacks: (() => void)[] = [];

    get isCancellationRequested(): boolean {
        return this._isCancelled;
    }

    cancel(): void {
        this._isCancelled = true;
        this._onCancellationRequestedCallbacks.forEach(callback => callback());
    }

    onCancellationRequested(callback: () => void): void {
        this._onCancellationRequestedCallbacks.push(callback);
    }
}

/**
 * Tool result parts for CLI output
 */
export class CliTextPart {
    public readonly type = 'text';
    constructor(public value: string) {}
    
    get text(): string {
        return this.value;
    }
}

export class CliErrorPart {
    public readonly type = 'error';
    constructor(public value: Error | string) {}
    
    get text(): string {
        return this.value instanceof Error ? this.value.message : this.value;
    }
}

export type CliResultPart = CliTextPart | CliErrorPart;

/**
 * Tool invocation result for CLI
 */
export class CliToolResult {
    constructor(public parts: CliResultPart[]) {}

    getText(): string {
        return this.parts
            .filter(part => part instanceof CliTextPart)
            .map(part => (part as CliTextPart).value)
            .join('');
    }

    getErrors(): (Error | string)[] {
        return this.parts
            .filter(part => part instanceof CliErrorPart)
            .map(part => (part as CliErrorPart).value);
    }

    hasErrors(): boolean {
        return this.parts.some(part => part instanceof CliErrorPart);
    }
}

/**
 * Tool invocation options for CLI
 */
export interface CliToolInvocationOptions<T = unknown> {
    input: T;
    toolName: string;
    requestId?: string;
    context?: {
        workingDirectory?: string;
        environment?: Record<string, string>;
        user?: string;
        sessionId?: string;
    };
}

/**
 * Prepared tool invocation for CLI
 */
export interface CliPreparedToolInvocation {
    invocationMessage: string;
}

/**
 * Tool preparation options for CLI
 */
export interface CliToolInvocationPrepareOptions<T = unknown> {
    input: T;
    toolName: string;
}

/**
 * CLI Tool interface definition
 */
export interface CliToolInformation {
    name: string;
    description: string;
    inputSchema: unknown;
    outputSchema?: unknown;
    category?: string;
    tags?: string[];
    complexity?: 'core' | 'advanced' | 'essential';
}

/**
 * File system interface for CLI operations
 */
export interface CliFileSystem {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    readdir(path: string): Promise<string[]>;
}

/**
 * Tool parameters interface for healing system
 */
export interface ToolParameters {
    [key: string]: unknown;
    oldString?: string;
    newString?: string;
    filePath?: string;
}

/**
 * No match error for tool healing
 */
export class NoMatchError extends Error {
    public readonly type = 'NoMatchError';
    public filePath?: string;
    
    constructor(message: string, filePath?: string) {
        super(message);
        this.name = 'NoMatchError';
        this.filePath = filePath;
    }
}

/**
 * Tool execution context for CLI
 */
export interface CliExecutionContext {
    workingDirectory: string;
    environment: Record<string, string>;
    user?: string;
    sessionId?: string;
    timeout?: number;
    verbose?: boolean;
    fileSystem?: CliFileSystem;
}

/**
 * Default CLI execution context
 */
export const createDefaultCliContext = (): CliExecutionContext => ({
    workingDirectory: process.cwd(),
    environment: process.env as Record<string, string>,
    sessionId: `cli-${Date.now()}`,
    timeout: 30000,
    verbose: false
});

/**
 * Markdown string replacement for CLI
 */
export class CliMarkdownString {
    constructor(public value: string) {}

    appendMarkdown(value: string): void {
        this.value += value;
    }

    appendText(value: string): void {
        this.value += value;
    }
}