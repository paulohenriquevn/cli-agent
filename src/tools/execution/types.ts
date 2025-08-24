/*---------------------------------------------------------------------------------------------
 * Tool Calling Loop - Types and Interfaces
 *--------------------------------------------------------------------------------------------*/

// import { CliCancellationToken } from '../types/cliTypes'; // Unused import

export interface IToolCallingLoopOptions {
    toolCallLimit: number;
    enableStreaming: boolean;
    enableNestedCalls: boolean;
    enableTelemetry: boolean;
    model: {
        family: string;
        name: string;
    };
    request: {
        toolInvocationToken?: string;
    };
}

export interface IToolCall {
    id: string;
    name: string;
    arguments: string;
    originalId?: string; // Original ID before internal processing
}

export interface LanguageModelToolResult2 {
    content: string;
    error?: Error;
    executionTime: number;
    success: boolean;
}

export interface LanguageModelToolInformation {
    name: string;
    description: string;
    inputSchema: unknown;
    tags?: string[];
}

export interface IBuildPromptResult {
    prompt: string;
    messages: Raw.ChatMessage[];
    contextTokens: number;
}

export interface IBuildPromptContext {
    toolCallResults: Record<string, LanguageModelToolResult2>;
    toolCallRounds: IToolCallRound[];
    tools: {
        availableTools: LanguageModelToolInformation[];
        toolInvocationToken?: string;
    };
}

export interface IToolCallRound {
    response: Raw.ChatMessage;
    toolCalls: IToolCall[];
    toolInputRetry: number;
    statefulMarker?: string;
    thinking?: ThinkingDataItem;
    executionTime: number;
    timestamp: number;
}

export interface IToolCallSingleResult {
    response: ChatFetchResponse;
    round: IToolCallRound;
}

export interface IToolCallLoopResult extends IToolCallSingleResult {
    toolCallRounds: IToolCallRound[];
    totalExecutionTime: number;
    cancelled: boolean;
    hitToolCallLimit: boolean;
}

export enum ChatFetchResponseType {
    Success = 'success',
    Error = 'error',
    Cancelled = 'cancelled',
    RateLimit = 'rate_limit'
}

export interface ChatFetchResponse {
    type: ChatFetchResponseType;
    value?: Raw.ChatMessage;
    error?: Error;
    statusCode?: number;
}

export interface ChatResponse {
    type: ChatFetchResponseType;
    value: Raw.ChatMessage;
    thinking?: ThinkingDataItem;
    toolCalls?: IToolCall[];
}

export interface ChatResponseDelta {
    content?: string;
    toolCalls?: Raw.ToolCall[];
    thinking?: Partial<ThinkingDataItem>;
    finishReason?: string;
}

export interface ChatResponseStream {
    onData(callback: (delta: ChatResponseDelta) => void): void;
    onEnd(callback: () => void): void;
    onError(callback: (error: Error) => void): void;
    pause(): void;
    unpause(): void;
    destroy(): void;
}

export interface FetchStreamSource {
    update(text: string, delta: ChatResponseDelta): void;
    pause(): void;
    unpause(): void;
    complete(): void;
    error(error: Error): void;
}

export interface ThinkingDataItem {
    content: string;
    isEncrypted: boolean;
    timestamp: number;
    
    createOrUpdate?(existing: ThinkingDataItem | undefined, delta: Partial<ThinkingDataItem>): ThinkingDataItem;
    updateWithFetchResult(result: ChatFetchResponse): void;
}

export namespace Raw {
    export enum ChatRole {
        System = 'system',
        User = 'user',
        Assistant = 'assistant',
        Tool = 'tool'
    }

    export interface ChatMessage {
        role: ChatRole;
        content?: string;
        toolCalls?: ToolCall[];
        toolCallId?: string; // For tool role messages
        name?: string;
    }

    export interface SystemChatMessage extends ChatMessage {
        role: ChatRole.System;
        content: string;
    }

    export interface UserChatMessage extends ChatMessage {
        role: ChatRole.User;
        content: string;
    }

    export interface AssistantChatMessage extends ChatMessage {
        role: ChatRole.Assistant;
        content?: string;
        toolCalls?: ToolCall[];
    }

    export interface ToolChatMessage extends ChatMessage {
        role: ChatRole.Tool;
        content: string;
        toolCallId: string;
        name: string;
    }

    export interface ToolCall {
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }
}

export interface InteractionOutcomeComputer {
    compute(): InteractionOutcome;
}

export interface InteractionOutcome {
    success: boolean;
    errorType?: string;
    executionTime: number;
    tokensUsed?: number;
    cost?: number;
}

export interface DeferredPromise<T> {
    readonly p: Promise<T>;
    readonly isSettled: boolean;
    complete(value?: T): void;
    error(error: Error): void;
}

export interface Event<T> {
    (listener: (e: T) => void): { dispose(): void };
}

export interface Emitter<T> {
    readonly event: Event<T>;
    fire(event: T): void;
    dispose(): void;
}

export interface Disposable {
    dispose(): void;
}

export class CancellationError extends Error {
    constructor(message = 'Operation was cancelled') {
        super(message);
        this.name = 'CancellationError';
    }
}

export function isCancellationError(error: unknown): error is CancellationError {
    return error instanceof CancellationError || (error as {name?: string})?.name === 'CancellationError';
}

export enum ToolName {
    ReadFile = 'readFile',
    WriteFile = 'writeFile',
    EditFile = 'editFile',
    SearchFiles = 'searchFiles',
    Bash = 'bash'
}

export interface TelemetryService {
    sendMSFTTelemetryEvent(eventName: string, data: Record<string, unknown>): void;
}