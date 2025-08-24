/*---------------------------------------------------------------------------------------------
 * LLM Service for Tool Healing Metacognition - Real API Implementation
 *--------------------------------------------------------------------------------------------*/

import OpenAI from 'openai';
import { ToolParameters, NoMatchError } from '../types/cliTypes';
import { 
    APIConfig, 
    ModelConfig, 
    DEFAULT_API_CONFIG, 
    getModelConfig, 
    validateApiConfig 
} from './config/apiConfig';

export interface LLMRequest {
    model: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

export interface LLMResponse {
    success: boolean;
    content?: string;
    error?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model: string;
    finishReason?: string;
    responseTime: number;
}

export interface MetacognitionRequest {
    sourceModel: string;
    fileContent: string;
    originalParameters: ToolParameters;
    error: NoMatchError;
    attemptHistory: Array<{
        method: string;
        parameters: ToolParameters;
        success: boolean;
        error?: string;
    }>;
}

export interface MetacognitionResponse {
    success: boolean;
    correctedParameters?: ToolParameters;
    reasoning?: string;
    confidence: number;
    suggestedMethod: 'unescape' | 'llm_correction' | 'newstring_adjustment' | 'manual_intervention';
    error?: string;
    apiUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        estimatedCost: number;
    };
}

export interface LLMServiceMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokensUsed: number;
    totalCost: number;
    averageResponseTime: number;
    requestsByModel: Record<string, number>;
    errorsByType: Record<string, number>;
}

export class LLMService {
    private client: OpenAI;
    private config: APIConfig;
    private metrics: LLMServiceMetrics;
    private logger?: (level: string, message: string, data?: any) => void;

    constructor(config: Partial<APIConfig> = {}) {
        this.config = { ...DEFAULT_API_CONFIG, ...config };
        this.metrics = {} as LLMServiceMetrics;

        // Validate configuration
        const validation = validateApiConfig(this.config);
        if (!validation.valid) {
            throw new Error(`LLM Service configuration invalid: ${validation.errors.join(', ')}`);
        }

        // Initialize OpenAI client with OpenRouter
        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: this.config.openRouterApiKey!,
            defaultHeaders: {
                'HTTP-Referer': this.config.siteUrl,
                'X-Title': this.config.siteName,
            },
        });

        this.resetMetrics();
    }

    public setLogger(logger: (level: string, message: string, data?: any) => void): void {
        this.logger = logger;
    }

    /**
     * Perform metacognitive analysis using real LLM
     */
    public async performMetacognition(request: MetacognitionRequest): Promise<MetacognitionResponse> {
        const startTime = performance.now();
        
        try {
            this.logger?.('debug', 'Starting real LLM metacognitive analysis', {
                sourceModel: request.sourceModel,
                errorType: request.error.type || 'unknown',
                attemptCount: request.attemptHistory.length,
                originalParamsKeys: Object.keys(request.originalParameters)
            });

            const metacognitionPrompt = this.buildMetacognitionPrompt(request);
            const modelConfig = getModelConfig(this.config.defaultModel);
            
            const llmRequest: LLMRequest = {
                model: modelConfig.openRouterName,
                messages: [
                    {
                        role: 'system',
                        content: this.getMetacognitionSystemPrompt()
                    },
                    {
                        role: 'user',
                        content: metacognitionPrompt
                    }
                ],
                temperature: 0.1, // Low temperature for consistent analysis
                maxTokens: Math.min(2000, modelConfig.maxTokens),
                timeout: this.config.timeout
            };

            const response = await this.callLLMWithRetry(llmRequest);
            
            if (!response.success || !response.content) {
                this.updateMetrics(false, response.model, 0, 0, 0, response.responseTime, response.error);
                return {
                    success: false,
                    error: response.error || 'No response content from LLM',
                    confidence: 0,
                    suggestedMethod: 'manual_intervention'
                };
            }

            const analysis = this.parseMetacognitionResponse(response.content);
            const responseTime = performance.now() - startTime;
            
            // Update metrics
            this.updateMetrics(
                true, 
                response.model, 
                response.usage?.promptTokens || 0,
                response.usage?.completionTokens || 0,
                response.usage?.totalTokens || 0,
                responseTime
            );

            // Calculate API cost
            const cost = this.calculateCost(
                response.model, 
                response.usage?.promptTokens || 0,
                response.usage?.completionTokens || 0
            );

            this.logger?.('info', 'Real LLM metacognitive analysis completed', {
                success: analysis.success,
                confidence: analysis.confidence,
                method: analysis.suggestedMethod,
                responseTime: Math.round(responseTime),
                tokensUsed: response.usage?.totalTokens || 0,
                estimatedCost: cost
            });

            return {
                ...analysis,
                apiUsage: {
                    promptTokens: response.usage?.promptTokens || 0,
                    completionTokens: response.usage?.completionTokens || 0,
                    totalTokens: response.usage?.totalTokens || 0,
                    estimatedCost: cost
                }
            };

        } catch (error) {
            const responseTime = performance.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.updateMetrics(false, this.config.defaultModel, 0, 0, 0, responseTime, errorMessage);
            
            this.logger?.('error', 'Real LLM metacognitive analysis failed', {
                error: errorMessage,
                responseTime: Math.round(responseTime)
            });

            return {
                success: false,
                error: errorMessage,
                confidence: 0,
                suggestedMethod: 'manual_intervention'
            };
        }
    }

    /**
     * Call LLM API with retry logic
     */
    private async callLLMWithRetry(request: LLMRequest): Promise<LLMResponse> {
        let lastError: Error | null = null;
        const startTime = performance.now();

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                this.logger?.('debug', `LLM API call attempt ${attempt}/${this.config.maxRetries}`, {
                    model: request.model,
                    temperature: request.temperature,
                    maxTokens: request.maxTokens
                });

                const completion = await this.client.chat.completions.create({
                    model: request.model,
                    messages: request.messages,
                    temperature: request.temperature || 0.1,
                    max_tokens: request.maxTokens || 2000,
                });

                const responseTime = performance.now() - startTime;

                this.logger?.('debug', 'LLM API call successful', {
                    model: completion.model,
                    finishReason: completion.choices[0]?.finish_reason,
                    promptTokens: completion.usage?.prompt_tokens,
                    completionTokens: completion.usage?.completion_tokens,
                    responseTime: Math.round(responseTime)
                });

                return {
                    success: true,
                    content: completion.choices[0]?.message?.content || '',
                    model: completion.model || request.model,
                    finishReason: completion.choices[0]?.finish_reason,
                    usage: completion.usage ? {
                        promptTokens: completion.usage.prompt_tokens,
                        completionTokens: completion.usage.completion_tokens,
                        totalTokens: completion.usage.total_tokens
                    } : undefined,
                    responseTime
                };

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                this.logger?.('warn', `LLM API call attempt ${attempt} failed`, {
                    error: lastError.message,
                    attempt,
                    maxRetries: this.config.maxRetries
                });

                // If this is not the last attempt, wait before retrying
                if (attempt < this.config.maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        const responseTime = performance.now() - startTime;
        return {
            success: false,
            error: lastError?.message || 'All retry attempts failed',
            model: request.model,
            responseTime
        };
    }

    /**
     * Build metacognition prompt for real LLM
     */
    private buildMetacognitionPrompt(request: MetacognitionRequest): string {
        const previousAttemptsText = request.attemptHistory.length > 0 
            ? `\n**PREVIOUS HEALING ATTEMPTS:**\n${request.attemptHistory.map((attempt, index) => 
                `${index + 1}. Method: ${attempt.method}\n   Result: ${attempt.success ? 'SUCCESS' : 'FAILED' + (attempt.error ? ': ' + attempt.error : '')}\n   Parameters used: ${JSON.stringify(attempt.parameters, null, 2)}`
            ).join('\n\n')}`
            : '\n**PREVIOUS HEALING ATTEMPTS:** None';

        return `**TOOL PARAMETER HEALING ANALYSIS REQUEST**

You are an expert system for analyzing and correcting LLM-generated tool parameters that failed to execute. Your task is to identify the root cause and provide corrected parameters.

**CONTEXT:**
- Source Model: ${request.sourceModel}
- Error Type: ${request.error.type || 'unknown'}
- Error Message: "${request.error.message}"
- File Path: ${(request.error as any).filePath || 'unknown'}

**FAILED PARAMETERS:**
\`\`\`json
${JSON.stringify(request.originalParameters, null, 2)}
\`\`\`

**FILE CONTENT SAMPLE (first 800 chars):**
\`\`\`
${request.fileContent.slice(0, 800)}${request.fileContent.length > 800 ? '\n... [truncated]' : ''}
\`\`\`

${previousAttemptsText}

**YOUR ANALYSIS TASK:**
1. **Identify the Issue:** What specific problem prevents the parameters from matching the file content?
2. **Determine Root Cause:** Is this a typical ${request.sourceModel} issue? (over-escaping, whitespace, format problems)
3. **Generate Solution:** Provide corrected parameters that will match the file content exactly
4. **Assess Confidence:** How certain are you that this correction will work?
5. **Choose Method:** Which healing approach is most appropriate?

**HEALING METHODS:**
- \`unescape\`: Fix over-escaped characters (\\\\n → \\n, \\\\t → \\t, \\\\\" → \", etc.)
- \`llm_correction\`: Intelligent parameter reformatting and content matching
- \`newstring_adjustment\`: Adjust spacing, whitespace, or string boundaries
- \`manual_intervention\`: Problem too complex for automated healing

**RESPONSE FORMAT:**
Respond with a JSON object only (no markdown, no explanation outside JSON):

\`\`\`json
{
  "success": true,
  "correctedParameters": {
    "oldString": "corrected version that matches file exactly",
    "newString": "corresponding corrected new string",
    "...": "other parameters as needed"
  },
  "reasoning": "Brief explanation of what was wrong and how you fixed it",
  "confidence": 0.85,
  "suggestedMethod": "unescape"
}
\`\`\`

**IMPORTANT REQUIREMENTS:**
- The \`oldString\` MUST exist exactly once in the provided file content
- Preserve the original intent while fixing formatting/escaping issues
- Be conservative: if unsure, suggest \`manual_intervention\`
- Consider model-specific bug patterns (${request.sourceModel} tends to have certain issues)
        `.trim();
    }

    /**
     * Get system prompt for metacognition
     */
    private getMetacognitionSystemPrompt(): string {
        return `You are an advanced metacognitive system specialized in analyzing and correcting tool parameter failures from Large Language Models.

CORE EXPERTISE:
- LLM parameter generation patterns and common failure modes
- Model-specific bugs (Gemini over-escaping, Claude whitespace, DeepSeek JSON issues, GPT formatting)
- String matching and text processing precision requirements
- Automated healing strategies and their effectiveness

ANALYSIS PRINCIPLES:
1. **Precision First**: Corrected parameters must match file content exactly
2. **Pattern Recognition**: Identify model-specific error patterns quickly  
3. **Conservative Approach**: When uncertain, recommend manual intervention
4. **Context Awareness**: Consider file type, content structure, and error context
5. **Efficiency**: Prefer simpler solutions (unescape > pattern > LLM correction)

OUTPUT REQUIREMENTS:
- Always respond with valid JSON only
- Provide specific, testable corrections
- Explain reasoning clearly but concisely
- Assess confidence honestly (0.0 to 1.0)
- Choose the most appropriate healing method

FAILURE MODES TO DETECT:
- Over-escaping: \\\\n, \\\\t, \\\\", \\\\\\\\ 
- Under-escaping: Missing escapes where needed
- Whitespace issues: Extra spaces, wrong indentation, mixed tabs/spaces
- Line ending problems: \\r\\n vs \\n inconsistencies
- JSON escaping: Incorrect \\" handling
- Unicode/encoding issues: Character representation problems
- Context misunderstanding: Wrong text selection from file

Be systematic, precise, and helpful. Your corrections directly impact tool execution success.`;
    }

    /**
     * Parse metacognition response from real LLM
     */
    private parseMetacognitionResponse(content: string): MetacognitionResponse {
        try {
            // Clean the response - remove markdown code blocks and extra whitespace
            let cleanContent = content.trim();
            
            // Remove markdown code blocks if present
            cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Try to find JSON in the response
            const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON object found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            
            // Validate response structure
            if (typeof parsed.success !== 'boolean') {
                throw new Error('Invalid response: missing or invalid success field');
            }

            if (parsed.success && !parsed.correctedParameters) {
                throw new Error('Invalid response: success=true but no correctedParameters provided');
            }

            if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
                throw new Error('Invalid response: confidence must be a number between 0 and 1');
            }

            const validMethods = ['unescape', 'llm_correction', 'newstring_adjustment', 'manual_intervention'];
            if (!validMethods.includes(parsed.suggestedMethod)) {
                throw new Error(`Invalid response: suggestedMethod must be one of ${validMethods.join(', ')}`);
            }

            return {
                success: parsed.success,
                correctedParameters: parsed.correctedParameters,
                reasoning: parsed.reasoning || 'No reasoning provided',
                confidence: parsed.confidence,
                suggestedMethod: parsed.suggestedMethod,
                error: parsed.error
            };

        } catch (error) {
            this.logger?.('error', 'Failed to parse LLM metacognition response', {
                content: content.slice(0, 500),
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                success: false,
                error: `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`,
                confidence: 0,
                suggestedMethod: 'manual_intervention'
            };
        }
    }

    /**
     * Calculate estimated cost for API usage
     */
    private calculateCost(modelName: string, promptTokens: number, completionTokens: number): number {
        // Extract base model name from OpenRouter format
        const baseModelName = modelName.split('/').pop() || modelName;
        const modelConfig = getModelConfig(baseModelName);
        
        if (!modelConfig) {
            return 0;
        }

        const promptCost = (promptTokens / 1000) * modelConfig.costPer1kTokens.prompt;
        const completionCost = (completionTokens / 1000) * modelConfig.costPer1kTokens.completion;
        
        return promptCost + completionCost;
    }

    /**
     * Update service metrics
     */
    private updateMetrics(
        success: boolean, 
        model: string, 
        promptTokens: number, 
        completionTokens: number, 
        totalTokens: number, 
        responseTime: number,
        error?: string
    ): void {
        this.metrics.totalRequests++;
        
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
            if (error) {
                const errorType = this.categorizeError(error);
                this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
            }
        }

        this.metrics.totalTokensUsed += totalTokens;
        this.metrics.totalCost += this.calculateCost(model, promptTokens, completionTokens);
        
        // Update average response time
        const totalRequests = this.metrics.totalRequests;
        this.metrics.averageResponseTime = 
            ((this.metrics.averageResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;

        // Track requests by model
        const baseModelName = model.split('/').pop() || model;
        this.metrics.requestsByModel[baseModelName] = (this.metrics.requestsByModel[baseModelName] || 0) + 1;
    }

    /**
     * Categorize error for metrics
     */
    private categorizeError(error: string): string {
        const errorLower = error.toLowerCase();
        if (errorLower.includes('timeout')) {return 'timeout';}
        if (errorLower.includes('rate limit')) {return 'rate_limit';}
        if (errorLower.includes('auth')) {return 'authentication';}
        if (errorLower.includes('quota')) {return 'quota_exceeded';}
        if (errorLower.includes('network') || errorLower.includes('connection')) {return 'network';}
        return 'other';
    }

    /**
     * Reset metrics to initial state
     */
    private resetMetrics(): void {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokensUsed: 0,
            totalCost: 0,
            averageResponseTime: 0,
            requestsByModel: {},
            errorsByType: {}
        };
    }

    /**
     * Get service metrics
     */
    public getMetrics(): LLMServiceMetrics {
        return { ...this.metrics };
    }

    /**
     * Get service configuration
     */
    public getConfig(): APIConfig {
        // Return config without sensitive data
        return {
            ...this.config,
            openRouterApiKey: this.config.openRouterApiKey ? '[CONFIGURED]' : '[NOT SET]'
        } as APIConfig;
    }

    /**
     * Test API connection
     */
    public async testConnection(): Promise<{ success: boolean; error?: string; model?: string; responseTime?: number }> {
        try {
            const startTime = performance.now();
            
            const response = await this.client.chat.completions.create({
                model: getModelConfig(this.config.defaultModel).openRouterName,
                messages: [{ role: 'user', content: 'Test connection. Respond with: "OK"' }],
                max_tokens: 10,
                temperature: 0
            });

            const responseTime = performance.now() - startTime;

            return {
                success: true,
                model: response.model,
                responseTime
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

export default LLMService;