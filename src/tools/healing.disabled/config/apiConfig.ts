/*---------------------------------------------------------------------------------------------
 * API Configuration for LLM Services
 *--------------------------------------------------------------------------------------------*/

export interface APIConfig {
    openRouterApiKey?: string;
    siteUrl?: string;
    siteName?: string;
    defaultModel: string;
    timeout: number;
    maxRetries: number;
}

export interface ModelConfig {
    openRouterName: string;
    displayName: string;
    contextWindow: number;
    costPer1kTokens: {
        prompt: number;
        completion: number;
    };
    maxTokens: number;
}

export const DEFAULT_API_CONFIG: APIConfig = {
    openRouterApiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
    siteUrl: process.env.SITE_URL || '',
    siteName: process.env.SITE_NAME || '',
    defaultModel: 'openai/gpt-4o-mini',
    timeout: 30000,
    maxRetries: 3
};

export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
    'gpt-4o-mini': {
        openRouterName: 'openai/gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        contextWindow: 128000,
        costPer1kTokens: { prompt: 0.00015, completion: 0.0006 },
        maxTokens: 4096
    },
    'gpt-4o': {
        openRouterName: 'openai/gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        costPer1kTokens: { prompt: 0.005, completion: 0.015 },
        maxTokens: 4096
    },
    'gpt-4-turbo': {
        openRouterName: 'openai/gpt-4-turbo',
        displayName: 'GPT-4 Turbo',
        contextWindow: 128000,
        costPer1kTokens: { prompt: 0.01, completion: 0.03 },
        maxTokens: 4096
    },
    'claude-3-haiku': {
        openRouterName: 'anthropic/claude-3-haiku',
        displayName: 'Claude 3 Haiku',
        contextWindow: 200000,
        costPer1kTokens: { prompt: 0.00025, completion: 0.00125 },
        maxTokens: 4096
    },
    'claude-3-sonnet': {
        openRouterName: 'anthropic/claude-3-sonnet',
        displayName: 'Claude 3 Sonnet',
        contextWindow: 200000,
        costPer1kTokens: { prompt: 0.003, completion: 0.015 },
        maxTokens: 4096
    },
    'gemini-pro': {
        openRouterName: 'google/gemini-pro',
        displayName: 'Gemini Pro',
        contextWindow: 30720,
        costPer1kTokens: { prompt: 0.000125, completion: 0.000375 },
        maxTokens: 2048
    },
    'deepseek-coder': {
        openRouterName: 'deepseek/deepseek-coder',
        displayName: 'DeepSeek Coder',
        contextWindow: 16000,
        costPer1kTokens: { prompt: 0.00014, completion: 0.00028 },
        maxTokens: 4096
    }
};

export function getModelConfig(modelName: string): ModelConfig {
    return AVAILABLE_MODELS[modelName] || AVAILABLE_MODELS['gpt-4o-mini'];
}

export function validateApiConfig(config: Partial<APIConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.openRouterApiKey) {
        errors.push('OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable.');
    }

    if (config.timeout && (config.timeout < 5000 || config.timeout > 300000)) {
        errors.push('Timeout must be between 5000ms and 300000ms');
    }

    if (config.maxRetries && (config.maxRetries < 1 || config.maxRetries > 10)) {
        errors.push('Max retries must be between 1 and 10');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}