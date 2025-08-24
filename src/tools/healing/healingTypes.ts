/*---------------------------------------------------------------------------------------------
 * Tool Healing System - Types and Interfaces
 *--------------------------------------------------------------------------------------------*/

export interface HealingEndpoint {
    makeChatRequest(
        requestName: string,
        messages: any[],
        tools?: any,
        token?: any,
        location?: any
    ): Promise<{ type: string; value?: any; error?: any }>;
}

export interface HealingConfig {
    enabledForStringReplace: boolean;
    enabledForPatchApply: boolean;
    maxHealingAttempts: number;
    healingTimeout: number;
    model: string;
}

export interface HealingResult<T = any> {
    success: boolean;
    healedData?: T;
    originalError: Error;
    healingError?: Error;
    attempts: number;
    healingTime: number;
    strategy: string;
}

export interface HealingTelemetry {
    model: string;
    healError?: string;
    applicationError?: string;
    outcome: 'healingSucceeded' | 'healingFailed' | 'normalExecution';
    executionTime: number;
    healingAttempts: number;
}

export class NoMatchError extends Error {
    constructor(message: string, public readonly searchString: string, public readonly fileContent: string) {
        super(message);
        this.name = 'NoMatchError';
    }
}

export class HealedError extends Error {
    constructor(
        public readonly originalError: Error,
        public readonly healedError: Error,
        public readonly healedData: string
    ) {
        super(healedError.message);
        this.name = 'HealedError';
    }
}

export interface StringHealingParams {
    oldString: string;
    newString: string;
    expectedReplacements?: number;
    model?: { family: string; name: string };
}

export interface StringHealingResult {
    params: StringHealingParams;
    occurrences: number;
    healingApplied: boolean;
    strategy: 'none' | 'unescape' | 'llm_correction' | 'newstring_correction' | 'trim_optimization';
}

export interface ObjectJsonSchema {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
}

export const OLD_STRING_CORRECTION_SCHEMA: ObjectJsonSchema = {
    type: 'object',
    properties: {
        corrected_target_snippet: {
            type: 'string',
            description: 'The corrected version of the target snippet that exactly and uniquely matches a segment within the provided file content.',
        },
    },
    required: ['corrected_target_snippet'],
};

export const NEW_STRING_CORRECTION_SCHEMA: ObjectJsonSchema = {
    type: 'object',
    properties: {
        corrected_new_string: {
            type: 'string',
            description: 'The corrected version of the new string with proper escaping/formatting.',
        },
    },
    required: ['corrected_new_string'],
};

export const PATCH_HEALING_SCHEMA: ObjectJsonSchema = {
    type: 'object',
    properties: {
        corrected_patch: {
            type: 'string',
            description: 'The corrected patch that will apply cleanly to the file.',
        },
        explanation: {
            type: 'string',
            description: 'Brief explanation of what was corrected in the patch.',
        },
    },
    required: ['corrected_patch'],
};

export enum ChatFetchResponseType {
    Success = 'success',
    Error = 'error',
    Cancelled = 'cancelled',
    RateLimit = 'rate_limit'
}

export enum ChatRole {
    System = 'system',
    User = 'user',
    Assistant = 'assistant',
    Tool = 'tool'
}

export enum ChatCompletionContentPartKind {
    Text = 'text',
    Image = 'image_url'
}

export namespace Raw {
    export { ChatRole, ChatCompletionContentPartKind };
    
    export interface ChatMessage {
        role: ChatRole;
        content: Array<{ type: ChatCompletionContentPartKind; text?: string; image_url?: any }> | string;
    }
}

export enum ChatLocation {
    Chat = 'chat',
    Inline = 'inline',
    Other = 'other'
}

export const CHAT_MODEL = {
    GPT4OMINI: 'gpt-4o-mini',
    GPT4O: 'gpt-4o',
    CLAUDE_SONNET: 'claude-3-sonnet',
    GEMINI_PRO: 'gemini-pro'
} as const;

export type ChatModel = typeof CHAT_MODEL[keyof typeof CHAT_MODEL];

export interface ExperimentationService {
    getTreatmentVariable<T>(key: string, defaultValue: T): T;
}

export interface TelemetryService {
    sendMSFTTelemetryEvent(eventName: string, properties: Record<string, any>): void;
}