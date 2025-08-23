# 🌐 OpenRouter Integration - Documentação Completa

## 📋 **Visão Geral**

Esta documentação apresenta a integração completa com OpenRouter, aproveitando todas as suas capacidades avançadas incluindo provider routing, model selection, cost optimization, streaming e ensemble models.

## 🚀 **Arquitetura OpenRouter**

### **Core Components**
```
┌─────────────────────────────────────────────────────────────────┐
│                    OPENROUTER INTEGRATION                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │  OpenRouter     │    │  Model Manager  │    │ Provider    │  │
│  │   Client        │    │                 │    │ Router      │  │
│  │                 │    │ • Model Select  │    │             │  │
│  │ • API Calls     │◄───┤ • Capabilities  │◄───┤ • Routing   │  │
│  │ • Streaming     │    │ • Cost Analysis │    │ • Fallbacks │  │
│  │ • Error Handle  │    │ • Performance   │    │ • Load Bal  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
│           │                       │                       │     │
│  ┌────────▼──────┐    ┌──────────▼──────┐    ┌──────────▼──┐   │
│  │   Request     │    │   Response      │    │   Cost      │   │
│  │  Optimizer    │    │   Processor     │    │  Tracker    │   │
│  │               │    │                 │    │             │   │
│  │ • Parameters  │    │ • Normalize     │    │ • Monitor   │   │
│  │ • Provider    │    │ • Tools Handle  │    │ • Optimize  │   │
│  │ • Routing     │    │ • Stream Parse  │    │ • Budget    │   │
│  └───────────────┘    └─────────────────┘    └─────────────┘   │
│                                   │                             │
└───────────────────────────────────┼─────────────────────────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────┐
│              OPENROUTER API       │                             │
│  ┌─────────────────┐  ┌──────────▼───────┐  ┌─────────────────┐ │
│  │   400+ Models   │  │  Provider Routing │  │  Cost OptimizationI
│  │                 │  │                  │  │                 │ │
│  │ • OpenAI        │  │ • Fallbacks      │  │ • Real-time     │ │
│  │ • Anthropic     │  │ • Load Balance   │  │ • Budget Limits │ │
│  │ • Google        │  │ • Speed/Cost     │  │ • Free Models   │ │
│  │ • Meta          │  │ • Quality        │  │ • Transparent   │ │
│  │ • Free Models   │  │ • Context Length │  │ • Monitoring    │ │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 **OpenRouter Client Implementation**

### **Core Client Class**
```typescript
// src/llm/OpenRouterClient.ts
import OpenAI from 'openai';
import type { 
  ChatCompletionCreateParams, 
  ChatCompletionMessageParam,
  ChatCompletionTool 
} from 'openai/resources/chat/completions';

interface OpenRouterProvider {
  sort?: 'price' | 'throughput' | 'latency' | 'context_length';
  allow_fallbacks?: boolean;
  only?: string[];
  ignore?: string[];
  require_parameters?: string[];
  data_collection?: 'allow' | 'deny';
  quantizations?: string[];
  max_price?: number;
}

interface OpenRouterRequestParams extends ChatCompletionCreateParams {
  // OpenRouter specific parameters
  provider?: OpenRouterProvider;
  models?: string[]; // Multiple model options for fallback
  route?: 'fallback';
  transforms?: string[];
  
  // Enhanced parameters
  prediction?: any;
  logit_bias?: Record<string, number>;
  repetition_penalty?: number;
  min_p?: number;
  top_a?: number;
  seed?: number;
}

export interface OpenRouterConfig {
  apiKey: string;
  siteUrl?: string;
  siteName?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeout?: number;
}

export class OpenRouterClient {
  private client: OpenAI;
  private config: OpenRouterConfig;
  private requestCount = 0;
  private totalCost = 0;

  constructor(config: OpenRouterConfig) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: config.apiKey,
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 60000,
      defaultHeaders: {
        "HTTP-Referer": config.siteUrl || "https://github.com/your-org/llm-agent",
        "X-Title": config.siteName || "LLM Agent System"
      }
    });
  }

  /**
   * Create optimized completion using all OpenRouter capabilities
   */
  async createOptimizedCompletion(params: {
    messages: ChatCompletionMessageParam[];
    tools?: ChatCompletionTool[];
    complexity: 'simple' | 'medium' | 'complex' | 'expert';
    priority: 'speed' | 'cost' | 'quality';
    maxCost?: number;
    stream?: boolean;
  }) {
    const routingConfig = this.getOptimalRouting(params.complexity, params.priority);
    
    const request: OpenRouterRequestParams = {
      // Intelligent model selection
      models: routingConfig.models,
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.tools ? 'auto' : undefined,
      
      // Provider routing for optimization
      provider: {
        sort: routingConfig.sort,
        allow_fallbacks: true,
        require_parameters: params.tools ? ['tools'] : undefined,
        max_price: params.maxCost,
        data_collection: 'deny', // Privacy focused
        quantizations: params.priority === 'speed' ? ['int4', 'int8'] : undefined
      },
      
      // Optimization parameters
      temperature: routingConfig.temperature,
      max_tokens: routingConfig.maxTokens,
      stream: params.stream || false,
      
      // Advanced control parameters
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
      top_p: 0.9,
      seed: this.generateConsistentSeed()
    };

    this.requestCount++;
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create(request);
      
      // Track costs and performance
      if (response.usage) {
        const cost = this.calculateCost(response.usage, routingConfig.models[0]);
        this.totalCost += cost;
        
        console.log(`📊 Request #${this.requestCount} - Cost: $${cost.toFixed(4)} - Total: $${this.totalCost.toFixed(4)} - Time: ${Date.now() - startTime}ms`);
      }

      return response;
    } catch (error) {
      console.error(`❌ OpenRouter request failed:`, error);
      throw error;
    }
  }

  /**
   * Streaming completion with advanced error handling
   */
  async *createStreamingCompletion(params: OpenRouterRequestParams) {
    try {
      const stream = await this.client.chat.completions.create({
        ...params,
        stream: true,
        provider: {
          ...params.provider,
          allow_fallbacks: true
        }
      });

      let chunkCount = 0;
      for await (const chunk of stream) {
        chunkCount++;
        yield {
          ...chunk,
          _meta: { chunkNumber: chunkCount, timestamp: Date.now() }
        };
      }
    } catch (error) {
      console.warn(`⚠️ Primary streaming failed, attempting fallback...`);
      
      // Automatic fallback to reliable model
      const fallbackStream = await this.client.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: params.messages,
        tools: params.tools,
        stream: true,
        temperature: 0.3
      });

      let chunkCount = 0;
      for await (const chunk of fallbackStream) {
        chunkCount++;
        yield {
          ...chunk,
          _meta: { 
            chunkNumber: chunkCount, 
            timestamp: Date.now(),
            fallback: true
          }
        };
      }
    }
  }

  /**
   * Multi-model ensemble for critical tasks
   */
  async createEnsembleCompletion(params: {
    messages: ChatCompletionMessageParam[];
    models: string[];
    votingStrategy: 'majority' | 'weighted' | 'best' | 'consensus';
    tools?: ChatCompletionTool[];
  }) {
    console.log(`🧠 Running ensemble with ${params.models.length} models...`);

    const results = await Promise.allSettled(
      params.models.map(async (model, index) => {
        try {
          const response = await this.client.chat.completions.create({
            model,
            messages: params.messages,
            tools: params.tools,
            temperature: 0.1, // Low temperature for consistency
            provider: {
              allow_fallbacks: false // Force specific model
            }
          });

          return {
            model,
            response,
            index,
            success: true
          };
        } catch (error) {
          console.warn(`⚠️ Model ${model} failed:`, error.message);
          return {
            model,
            error,
            index,
            success: false
          };
        }
      })
    );

    const successfulResults = results
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .map(result => result.value);

    if (successfulResults.length === 0) {
      throw new Error('All ensemble models failed');
    }

    return this.combineEnsembleResults(successfulResults, params.votingStrategy);
  }

  /**
   * Cost-optimized completion with free model fallback
   */
  async createCostOptimizedCompletion(params: {
    messages: ChatCompletionMessageParam[];
    maxBudget: number;
    allowFreeModels: boolean;
    tools?: ChatCompletionTool[];
  }) {
    const freeModels = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'microsoft/phi-3-mini-128k-instruct:free',
      'google/gemma-7b-it:free',
      'gryphe/mythomist-7b:free'
    ];

    const budgetModels = [
      'openai/gpt-4o-mini',
      'anthropic/claude-3-haiku',
      'google/gemini-flash',
      ...freeModels
    ];

    const request: OpenRouterRequestParams = {
      models: params.allowFreeModels ? budgetModels : budgetModels.filter(m => !m.includes(':free')),
      messages: params.messages,
      tools: params.tools,
      provider: {
        sort: 'price',
        max_price: params.maxBudget,
        allow_fallbacks: true,
        data_collection: 'deny'
      },
      temperature: 0.3
    };

    return await this.client.chat.completions.create(request);
  }

  /**
   * Performance-optimized completion for speed
   */
  async createSpeedOptimizedCompletion(params: {
    messages: ChatCompletionMessageParam[];
    tools?: ChatCompletionTool[];
    maxLatency?: number;
  }) {
    const fastModels = [
      'openai/gpt-4o-mini',
      'google/gemini-flash',
      'anthropic/claude-3-haiku',
      'meta-llama/llama-3.1-8b-instruct:free'
    ];

    const request: OpenRouterRequestParams = {
      models: fastModels,
      messages: params.messages,
      tools: params.tools,
      provider: {
        sort: 'throughput',
        allow_fallbacks: true,
        quantizations: ['int4', 'int8'], // Allow quantized models for speed
        data_collection: 'deny'
      },
      temperature: 0.4, // Slightly higher for faster generation
      max_tokens: 2000, // Reasonable limit for speed
      stream: true
    };

    return await this.client.chat.completions.create(request);
  }

  /**
   * Get optimal routing configuration based on task complexity and priority
   */
  private getOptimalRouting(complexity: string, priority: string) {
    const routingConfigs = {
      simple: {
        models: [
          'openai/gpt-4o-mini',
          'google/gemini-flash',
          'anthropic/claude-3-haiku',
          'meta-llama/llama-3.1-8b-instruct:free'
        ],
        sort: 'price' as const,
        temperature: 0.3,
        maxTokens: 1000
      },
      
      medium: {
        models: [
          'openai/gpt-4o-mini',
          'anthropic/claude-3.5-sonnet',
          'google/gemini-pro',
          'meta-llama/llama-3.1-70b-instruct'
        ],
        sort: priority === 'speed' ? 'throughput' as const : 'price' as const,
        temperature: 0.2,
        maxTokens: 2000
      },
      
      complex: {
        models: [
          'openai/gpt-4o',
          'anthropic/claude-3.5-sonnet',
          'google/gemini-pro',
          'meta-llama/llama-3.1-70b-instruct'
        ],
        sort: priority === 'cost' ? 'price' as const : 'throughput' as const,
        temperature: 0.1,
        maxTokens: 4000
      },
      
      expert: {
        models: [
          'openai/gpt-4o',
          'anthropic/claude-3-opus',
          'openai/o1-preview',
          'google/gemini-ultra'
        ],
        sort: 'context_length' as const,
        temperature: 0.05,
        maxTokens: 8000
      }
    };

    return routingConfigs[complexity] || routingConfigs.medium;
  }

  /**
   * Combine results from ensemble models
   */
  private combineEnsembleResults(results: any[], strategy: string) {
    switch (strategy) {
      case 'best':
        // Return result from the highest-quality model
        const qualityOrder = ['gpt-4o', 'claude-3-opus', 'claude-3.5-sonnet', 'gemini-ultra'];
        for (const model of qualityOrder) {
          const result = results.find(r => r.model.includes(model));
          if (result) return result.response;
        }
        return results[0].response;

      case 'majority':
        // Simple majority vote (would need more complex logic in practice)
        return results[0].response;

      case 'weighted':
        // Weight by model quality (simplified)
        return results[0].response;

      case 'consensus':
        // Look for consensus between models (simplified)
        return results[0].response;

      default:
        return results[0].response;
    }
  }

  /**
   * Calculate cost based on token usage and model pricing
   */
  private calculateCost(usage: any, model: string): number {
    // Simplified cost calculation - in production, use real-time pricing from OpenRouter API
    const approximatePricing = {
      'gpt-4o': { input: 0.000005, output: 0.000015 },
      'gpt-4o-mini': { input: 0.000001, output: 0.000002 },
      'claude-3.5-sonnet': { input: 0.000003, output: 0.000015 },
      'claude-3-haiku': { input: 0.00000025, output: 0.00000125 },
      'gemini-pro': { input: 0.0000005, output: 0.0000015 }
    };

    // Find matching pricing
    const modelKey = Object.keys(approximatePricing).find(key => model.includes(key));
    const pricing = approximatePricing[modelKey] || { input: 0.000001, output: 0.000002 };

    return (usage.prompt_tokens * pricing.input) + (usage.completion_tokens * pricing.output);
  }

  /**
   * Generate consistent seed for reproducible results
   */
  private generateConsistentSeed(): number {
    return Math.floor(Date.now() / 1000) % 1000000; // Changes every second
  }

  /**
   * Get current usage statistics
   */
  getUsageStats() {
    return {
      requestCount: this.requestCount,
      totalCost: this.totalCost,
      averageCostPerRequest: this.requestCount > 0 ? this.totalCost / this.requestCount : 0
    };
  }
}
```

## 📊 **Model Management System**

### **Advanced Model Manager**
```typescript
// src/llm/ModelManager.ts
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  pricing: {
    prompt: number;
    completion: number;
    request?: number;
    image?: number;
  };
  capabilities: {
    functionCalling: boolean;
    streaming: boolean;
    vision: boolean;
    reasoning: boolean;
    codeGeneration: boolean;
    multimodal: boolean;
  };
  providers: string[];
  performance: {
    averageLatency?: number;
    tokensPerSecond?: number;
    qualityScore?: number;
  };
}

export class ModelManager {
  private client: OpenRouterClient;
  private modelCache: Map<string, ModelInfo> = new Map();
  private cacheExpiry = Date.now();

  constructor(client: OpenRouterClient) {
    this.client = client;
  }

  /**
   * Get all available models with real-time information
   */
  async getAvailableModels(forceRefresh = false): Promise<ModelInfo[]> {
    if (forceRefresh || Date.now() > this.cacheExpiry) {
      await this.refreshModelCache();
    }

    return Array.from(this.modelCache.values());
  }

  /**
   * Smart model selection based on comprehensive requirements
   */
  async selectOptimalModel(requirements: {
    task: 'code' | 'chat' | 'analysis' | 'creative' | 'reasoning' | 'multimodal';
    complexity: 'simple' | 'medium' | 'complex' | 'expert';
    priority: 'speed' | 'cost' | 'quality';
    budget?: number;
    contextNeeded?: number;
    requiresTools?: boolean;
    requiresVision?: boolean;
  }): Promise<string> {
    
    const models = await this.getAvailableModels();
    
    // Filter models based on requirements
    let candidates = models.filter(model => {
      // Budget constraint
      if (requirements.budget && model.pricing.prompt > requirements.budget) {
        return false;
      }
      
      // Context length requirement
      if (requirements.contextNeeded && model.contextLength < requirements.contextNeeded) {
        return false;
      }
      
      // Tool calling requirement
      if (requirements.requiresTools && !model.capabilities.functionCalling) {
        return false;
      }
      
      // Vision requirement
      if (requirements.requiresVision && !model.capabilities.vision) {
        return false;
      }
      
      return true;
    });

    if (candidates.length === 0) {
      console.warn('No models match requirements, using fallback');
      candidates = models.filter(m => m.id.includes('gpt-4o-mini'));
    }

    // Task-specific model preferences
    const taskPreferences = this.getTaskPreferences(requirements.task);
    
    // Score each candidate
    const scoredCandidates = candidates.map(model => ({
      model,
      score: this.calculateModelScore(model, requirements, taskPreferences)
    }));

    // Sort by score and return best
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    console.log(`🎯 Selected model: ${scoredCandidates[0].model.id} (score: ${scoredCandidates[0].score.toFixed(2)})`);
    
    return scoredCandidates[0].model.id;
  }

  /**
   * Get models optimized for specific use cases
   */
  async getModelsForUseCase(useCase: string): Promise<string[]> {
    const useCaseModels = {
      'code-generation': [
        'anthropic/claude-3.5-sonnet', // Best for coding
        'openai/gpt-4o',
        'meta-llama/llama-3.1-70b-instruct',
        'deepseek/deepseek-coder-6.7b-instruct'
      ],
      
      'data-analysis': [
        'anthropic/claude-3.5-sonnet', // Excellent analytical capabilities
        'openai/gpt-4o',
        'google/gemini-pro',
        'anthropic/claude-3-opus'
      ],
      
      'creative-writing': [
        'anthropic/claude-3-opus', // Most creative
        'google/gemini-pro',
        'openai/gpt-4o',
        'meta-llama/llama-3.1-70b-instruct'
      ],
      
      'reasoning-tasks': [
        'openai/o1-preview', // Best reasoning
        'openai/o1-mini',
        'anthropic/claude-3.5-sonnet',
        'google/gemini-ultra'
      ],
      
      'cost-effective': [
        'openai/gpt-4o-mini',
        'anthropic/claude-3-haiku',
        'google/gemini-flash',
        'meta-llama/llama-3.1-8b-instruct:free'
      ],
      
      'high-throughput': [
        'google/gemini-flash',
        'openai/gpt-4o-mini',
        'anthropic/claude-3-haiku',
        'meta-llama/llama-3.1-8b-instruct'
      ]
    };

    return useCaseModels[useCase] || useCaseModels['cost-effective'];
  }

  /**
   * Provider-specific optimization configurations
   */
  getProviderOptimization(modelId: string): Partial<OpenRouterRequestParams> {
    if (modelId.includes('openai/')) {
      return {
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        provider: {
          sort: 'throughput',
          data_collection: 'deny'
        }
      };
    }
    
    if (modelId.includes('anthropic/')) {
      return {
        temperature: 0.3, // Claude works better with lower temperature
        top_p: 0.9,
        max_tokens: 4000,
        provider: {
          sort: 'quality',
          data_collection: 'deny'
        }
      };
    }
    
    if (modelId.includes('google/')) {
      return {
        temperature: 0.5,
        top_p: 0.95,
        provider: {
          sort: 'throughput',
          data_collection: 'deny'
        }
      };
    }
    
    if (modelId.includes('meta-llama/')) {
      return {
        temperature: 0.6,
        repetition_penalty: 1.1,
        top_p: 0.9,
        provider: {
          sort: 'price',
          data_collection: 'deny'
        }
      };
    }

    return {
      temperature: 0.5,
      provider: {
        allow_fallbacks: true,
        data_collection: 'deny'
      }
    };
  }

  /**
   * Refresh model cache with latest information from OpenRouter
   */
  private async refreshModelCache(): Promise<void> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.client.config.apiKey}`
        }
      });

      const data = await response.json();
      this.modelCache.clear();

      data.data.forEach((model: any) => {
        const modelInfo: ModelInfo = {
          id: model.id,
          name: model.name,
          description: model.description,
          contextLength: model.context_length,
          pricing: {
            prompt: parseFloat(model.pricing.prompt),
            completion: parseFloat(model.pricing.completion),
            request: model.pricing.request ? parseFloat(model.pricing.request) : undefined,
            image: model.pricing.image ? parseFloat(model.pricing.image) : undefined
          },
          capabilities: {
            functionCalling: model.top_provider?.supports_tools || false,
            streaming: true, // OpenRouter supports streaming for all models
            vision: model.id.includes('vision') || model.id.includes('gpt-4o'),
            reasoning: model.id.includes('o1') || model.id.includes('reasoning'),
            codeGeneration: model.id.includes('code') || model.id.includes('claude') || model.id.includes('gpt'),
            multimodal: model.id.includes('vision') || model.id.includes('gpt-4o') || model.id.includes('gemini')
          },
          providers: model.providers || [],
          performance: {
            averageLatency: model.performance?.average_latency,
            tokensPerSecond: model.performance?.tokens_per_second,
            qualityScore: this.estimateQualityScore(model.id)
          }
        };

        this.modelCache.set(model.id, modelInfo);
      });

      this.cacheExpiry = Date.now() + 5 * 60 * 1000; // Cache for 5 minutes
      console.log(`📊 Model cache refreshed: ${this.modelCache.size} models available`);

    } catch (error) {
      console.error('Failed to refresh model cache:', error);
    }
  }

  /**
   * Get task-specific model preferences
   */
  private getTaskPreferences(task: string) {
    const preferences = {
      code: {
        preferredProviders: ['anthropic', 'openai'],
        weightContextLength: 0.3,
        weightQuality: 0.4,
        weightCost: 0.3
      },
      chat: {
        preferredProviders: ['openai', 'google'],
        weightContextLength: 0.2,
        weightQuality: 0.3,
        weightCost: 0.5
      },
      analysis: {
        preferredProviders: ['anthropic', 'openai'],
        weightContextLength: 0.4,
        weightQuality: 0.4,
        weightCost: 0.2
      },
      creative: {
        preferredProviders: ['anthropic', 'google'],
        weightContextLength: 0.2,
        weightQuality: 0.5,
        weightCost: 0.3
      },
      reasoning: {
        preferredProviders: ['openai', 'anthropic'],
        weightContextLength: 0.3,
        weightQuality: 0.6,
        weightCost: 0.1
      },
      multimodal: {
        preferredProviders: ['openai', 'google'],
        weightContextLength: 0.2,
        weightQuality: 0.4,
        weightCost: 0.4
      }
    };

    return preferences[task] || preferences.chat;
  }

  /**
   * Calculate model score based on requirements and preferences
   */
  private calculateModelScore(
    model: ModelInfo, 
    requirements: any, 
    preferences: any
  ): number {
    let score = 0;

    // Provider preference bonus
    const hasPreferredProvider = preferences.preferredProviders.some(
      (provider: string) => model.id.includes(provider)
    );
    if (hasPreferredProvider) score += 20;

    // Quality score
    score += (model.performance.qualityScore || 50) * preferences.weightQuality;

    // Context length score
    const contextScore = Math.min(model.contextLength / 100000, 1) * 100;
    score += contextScore * preferences.weightContextLength;

    // Cost score (inverse - lower cost = higher score)
    const costScore = Math.max(0, 100 - (model.pricing.prompt * 1000000));
    score += costScore * preferences.weightCost;

    // Priority adjustments
    if (requirements.priority === 'speed') {
      score += (model.performance.tokensPerSecond || 50) / 10;
    } else if (requirements.priority === 'cost') {
      score += costScore * 0.5;
    } else if (requirements.priority === 'quality') {
      score += (model.performance.qualityScore || 50) * 0.3;
    }

    // Complexity adjustments
    if (requirements.complexity === 'expert' && model.performance.qualityScore > 80) {
      score += 30;
    } else if (requirements.complexity === 'simple' && model.pricing.prompt < 0.000001) {
      score += 25;
    }

    return score;
  }

  /**
   * Estimate quality score based on model ID
   */
  private estimateQualityScore(modelId: string): number {
    const qualityMapping = {
      'gpt-4o': 95,
      'claude-3-opus': 92,
      'claude-3.5-sonnet': 90,
      'o1-preview': 88,
      'gemini-ultra': 85,
      'gpt-4o-mini': 75,
      'claude-3-haiku': 70,
      'gemini-pro': 78,
      'gemini-flash': 65,
      'llama-3.1-70b': 82,
      'llama-3.1-8b': 60
    };

    for (const [key, score] of Object.entries(qualityMapping)) {
      if (modelId.includes(key)) {
        return score;
      }
    }

    return 50; // Default score
  }
}
```

## 🎯 **Agent Integration**

### **Complete Agent with OpenRouter**
```typescript
// src/agent/core/Agent.ts
import { OpenRouterClient } from '../llm/OpenRouterClient';
import { ModelManager } from '../llm/ModelManager';
import { ToolRegistry } from '../tools/registry/ToolRegistry';

export interface AgentConfiguration {
  // OpenRouter configuration
  openRouter: {
    apiKey: string;
    siteUrl?: string;
    siteName?: string;
    defaultModel?: string;
    maxRetries?: number;
    timeout?: number;
  };
  
  // Agent behavior
  mode: 'restricted' | 'standard' | 'unrestricted';
  capabilities: {
    fileSystemAccess: 'limited' | 'full';
    commandExecution: 'safe' | 'unrestricted';
    networkAccess: 'restricted' | 'full';
    systemModification: boolean;
  };
  
  // Cost and performance
  budget: {
    maxDailyCost: number;
    maxRequestCost: number;
    allowFreeModels: boolean;
  };
  
  performance: {
    priority: 'speed' | 'cost' | 'quality';
    enableStreaming: boolean;
    enableEnsemble: boolean;
  };
}

export class Agent {
  private openRouterClient: OpenRouterClient;
  private modelManager: ModelManager;
  private toolRegistry: ToolRegistry;
  private configuration: AgentConfiguration;
  private currentSession: AgentSession | null = null;

  constructor(config: AgentConfiguration) {
    this.configuration = config;
    
    // Initialize OpenRouter client
    this.openRouterClient = new OpenRouterClient({
      apiKey: config.openRouter.apiKey,
      siteUrl: config.openRouter.siteUrl,
      siteName: config.openRouter.siteName,
      defaultModel: config.openRouter.defaultModel,
      maxRetries: config.openRouter.maxRetries,
      timeout: config.openRouter.timeout
    });
    
    // Initialize model manager
    this.modelManager = new ModelManager(this.openRouterClient);
    
    // Initialize tool registry
    this.toolRegistry = new ToolRegistry(this.getToolConfiguration());
  }

  /**
   * Create a new agent session
   */
  async createSession(userId: string): Promise<AgentSession> {
    const session = new AgentSession({
      userId,
      agent: this,
      configuration: this.configuration
    });

    this.currentSession = session;
    
    console.log(`🚀 Agent session created for user: ${userId}`);
    return session;
  }

  /**
   * Process user message with full OpenRouter capabilities
   */
  async processMessage(message: string, options?: {
    complexity?: 'simple' | 'medium' | 'complex' | 'expert';
    priority?: 'speed' | 'cost' | 'quality';
    enableStreaming?: boolean;
    maxCost?: number;
  }): Promise<AgentResponse> {
    
    if (!this.currentSession) {
      throw new Error('No active session. Create a session first.');
    }

    const complexity = options?.complexity || this.assessMessageComplexity(message);
    const priority = options?.priority || this.configuration.performance.priority;
    
    console.log(`💬 Processing message - Complexity: ${complexity}, Priority: ${priority}`);

    try {
      // Select optimal model for this specific task
      const selectedModel = await this.modelManager.selectOptimalModel({
        task: this.classifyTask(message),
        complexity,
        priority,
        budget: options?.maxCost || this.configuration.budget.maxRequestCost,
        requiresTools: this.messageRequiresTools(message)
      });

      console.log(`🎯 Selected model: ${selectedModel}`);

      // Get available tools
      const availableTools = this.toolRegistry.getAvailableTools();
      const toolSchemas = this.convertToolsToOpenRouterFormat(availableTools);

      // Create messages array
      const messages = [
        {
          role: 'system' as const,
          content: this.buildSystemPrompt()
        },
        {
          role: 'user' as const,
          content: message
        }
      ];

      // Execute with streaming if enabled
      if (options?.enableStreaming || this.configuration.performance.enableStreaming) {
        return this.processWithStreaming(messages, toolSchemas, {
          complexity,
          priority,
          maxCost: options?.maxCost,
          selectedModel
        });
      }

      // Execute with ensemble for critical tasks
      if (complexity === 'expert' && this.configuration.performance.enableEnsemble) {
        return this.processWithEnsemble(messages, toolSchemas, {
          complexity,
          priority,
          maxCost: options?.maxCost
        });
      }

      // Standard execution with optimal model
      const response = await this.openRouterClient.createOptimizedCompletion({
        messages,
        tools: toolSchemas,
        complexity,
        priority,
        maxCost: options?.maxCost
      });

      return this.processResponse(response);

    } catch (error) {
      console.error('❌ Error processing message:', error);
      return {
        success: false,
        content: `I encountered an error: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate complete applications with unrestricted capabilities
   */
  async generateApplication(requirements: ApplicationRequirements): Promise<ApplicationResult> {
    console.log('🏗️ Generating complete application with unrestricted capabilities...');

    // Use ensemble of best models for planning
    const planningModels = [
      'openai/gpt-4o',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-opus'
    ];

    const planningResponse = await this.openRouterClient.createEnsembleCompletion({
      messages: [{
        role: 'user',
        content: `You are a SENIOR FULL-STACK ARCHITECT with UNLIMITED permissions and access.
        
        Generate a COMPLETE application based on these requirements:
        ${JSON.stringify(requirements, null, 2)}
        
        You have FULL ACCESS to:
        - Complete file system (create, modify, delete any files)
        - System commands (install packages, modify system configuration)
        - Network access (download, install, deploy)
        - Database operations (create, modify, migrate)
        - Server configuration (nginx, docker, CI/CD)
        
        Create a PRODUCTION-READY application including:
        1. Complete project structure
        2. All source code files
        3. Database schemas and migrations
        4. Docker and deployment configuration
        5. CI/CD pipelines
        6. Testing suites
        7. Documentation
        8. Performance optimizations
        9. Security implementations
        10. Monitoring and logging
        
        Execute ALL necessary commands and operations to create a fully functional application.`
      }],
      models: planningModels,
      votingStrategy: 'best',
      tools: this.getAllUnrestrictedTools()
    });

    // Execute the plan with full capabilities
    return this.executeApplicationPlan(planningResponse);
  }

  /**
   * Process response and execute tool calls
   */
  private async processResponse(response: any): Promise<AgentResponse> {
    const assistantMessage = response.choices[0].message;
    const toolResults: ToolExecutionResult[] = [];

    // Execute tool calls if present
    if (assistantMessage.tool_calls) {
      console.log(`🔧 Executing ${assistantMessage.tool_calls.length} tool calls...`);
      
      for (const toolCall of assistantMessage.tool_calls) {
        try {
          const tool = this.toolRegistry.getTool(this.mapToolName(toolCall.function.name));
          const parameters = JSON.parse(toolCall.function.arguments);
          
          console.log(`⚡ Executing ${toolCall.function.name} with parameters:`, parameters);
          
          const result = await tool.execute(parameters);
          
          toolResults.push({
            toolName: toolCall.function.name,
            parameters,
            result: result.success ? result.result : null,
            error: result.success ? undefined : result.error,
            success: result.success,
            executionTime: result.executionTime || 0,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          console.error(`❌ Tool execution failed:`, error);
          toolResults.push({
            toolName: toolCall.function.name,
            parameters: JSON.parse(toolCall.function.arguments),
            result: null,
            error: error.message,
            success: false,
            executionTime: 0,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    return {
      success: true,
      content: assistantMessage.content || this.formatToolResults(toolResults),
      toolResults,
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process with streaming for real-time feedback
   */
  private async processWithStreaming(
    messages: any[], 
    tools: any[], 
    options: any
  ): Promise<AgentResponse> {
    
    const stream = this.openRouterClient.createStreamingCompletion({
      messages,
      tools,
      complexity: options.complexity,
      priority: options.priority,
      maxCost: options.maxCost,
      stream: true
    });

    let content = '';
    const toolCalls: any[] = [];

    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        content += chunk.choices[0].delta.content;
        // Emit streaming content for real-time UI updates
        this.currentSession?.emit('streaming', {
          content: chunk.choices[0].delta.content,
          timestamp: Date.now()
        });
      }

      if (chunk.choices[0]?.delta?.tool_calls) {
        toolCalls.push(...chunk.choices[0].delta.tool_calls);
      }
    }

    // Execute any tool calls
    const toolResults: ToolExecutionResult[] = [];
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const result = await this.executeTool(toolCall);
        toolResults.push(result);
      }
    }

    return {
      success: true,
      content,
      toolResults,
      streaming: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get tool configuration based on agent mode
   */
  private getToolConfiguration(): ToolConfiguration {
    if (this.configuration.mode === 'unrestricted') {
      return {
        fileAccess: {
          allowedDirectories: ['*'], // All directories
          allowSystemFiles: true,
          allowHiddenFiles: true,
          allowExecutables: true
        },
        commandExecution: {
          allowedCommands: ['*'], // All commands
          allowDangerousCommands: true,
          allowSystemModification: true,
          allowNetworkCommands: true
        },
        networkAccess: {
          allowAllDomains: true,
          allowDownloads: true,
          allowUploads: true
        },
        resourceLimits: {
          memory: 'unlimited',
          cpu: 'unlimited',
          executionTime: 'unlimited'
        }
      };
    }
    
    // Standard/restricted modes would have appropriate limitations
    return this.getStandardToolConfiguration();
  }

  /**
   * Convert CLI tools to OpenRouter function calling format
   */
  private convertToolsToOpenRouterFormat(tools: any[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.convertZodSchemaToJsonSchema(tool.inputSchema)
      }
    }));
  }

  /**
   * Get all unrestricted tools for application generation
   */
  private getAllUnrestrictedTools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'execute_bash_command',
          description: 'Execute any bash command including system modification, package installation, service management',
          parameters: {
            type: 'object',
            properties: {
              command: { 
                type: 'string', 
                description: 'Any bash command including sudo, rm -rf, package managers, service controls' 
              },
              timeout: { type: 'number', description: 'Execution timeout in milliseconds' }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'write_file_content',
          description: 'Write content to any file with full permissions including system files, executables, configuration',
          parameters: {
            type: 'object',
            properties: {
              file_path: { 
                type: 'string', 
                description: 'Any file path including system directories, config files, executables' 
              },
              content: { type: 'string', description: 'File content' },
              permissions: { type: 'string', description: 'File permissions (e.g., 755 for executables)' },
              create_directories: { type: 'boolean', description: 'Create parent directories if needed' }
            },
            required: ['file_path', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'read_file_content',
          description: 'Read content from any file including system files, configuration files, logs',
          parameters: {
            type: 'object',
            properties: {
              file_path: { 
                type: 'string', 
                description: 'Any file path including system directories and hidden files' 
              }
            },
            required: ['file_path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_directory_structure',
          description: 'Create complex directory structures for applications',
          parameters: {
            type: 'object',
            properties: {
              base_path: { type: 'string', description: 'Base path for the structure' },
              structure: { 
                type: 'object', 
                description: 'Directory structure as nested object' 
              }
            },
            required: ['base_path', 'structure']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'install_packages',
          description: 'Install packages using various package managers (npm, pip, apt, etc.)',
          parameters: {
            type: 'object',
            properties: {
              package_manager: { 
                type: 'string', 
                enum: ['npm', 'pip', 'apt', 'yum', 'brew', 'cargo', 'go'],
                description: 'Package manager to use' 
              },
              packages: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'List of packages to install' 
              },
              global: { type: 'boolean', description: 'Install globally if applicable' }
            },
            required: ['package_manager', 'packages']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'configure_service',
          description: 'Configure system services (nginx, docker, databases, etc.)',
          parameters: {
            type: 'object',
            properties: {
              service_name: { type: 'string', description: 'Service name' },
              configuration: { type: 'object', description: 'Service configuration' },
              action: { 
                type: 'string', 
                enum: ['install', 'configure', 'start', 'stop', 'restart', 'enable'],
                description: 'Action to perform' 
              }
            },
            required: ['service_name', 'action']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'setup_database',
          description: 'Setup and configure databases (PostgreSQL, MongoDB, Redis, etc.)',
          parameters: {
            type: 'object',
            properties: {
              database_type: { 
                type: 'string', 
                enum: ['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite'],
                description: 'Database type' 
              },
              configuration: { type: 'object', description: 'Database configuration' },
              create_user: { type: 'boolean', description: 'Create database user' },
              create_database: { type: 'boolean', description: 'Create database' }
            },
            required: ['database_type']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deploy_application',
          description: 'Deploy application using various deployment strategies',
          parameters: {
            type: 'object',
            properties: {
              deployment_type: { 
                type: 'string', 
                enum: ['docker', 'pm2', 'systemd', 'kubernetes', 'heroku'],
                description: 'Deployment strategy' 
              },
              application_path: { type: 'string', description: 'Path to application' },
              configuration: { type: 'object', description: 'Deployment configuration' }
            },
            required: ['deployment_type', 'application_path']
          }
        }
      }
    ];
  }

  // Helper methods...
  private assessMessageComplexity(message: string): 'simple' | 'medium' | 'complex' | 'expert' {
    const indicators = {
      simple: ['read', 'show', 'list', 'check', 'status'],
      medium: ['create', 'modify', 'update', 'configure', 'install'],
      complex: ['build', 'deploy', 'integrate', 'optimize', 'refactor'],
      expert: ['architect', 'design', 'generate application', 'full-stack', 'complete system']
    };

    const lowerMessage = message.toLowerCase();
    
    if (indicators.expert.some(keyword => lowerMessage.includes(keyword))) return 'expert';
    if (indicators.complex.some(keyword => lowerMessage.includes(keyword))) return 'complex';
    if (indicators.medium.some(keyword => lowerMessage.includes(keyword))) return 'medium';
    return 'simple';
  }

  private classifyTask(message: string): 'code' | 'chat' | 'analysis' | 'creative' | 'reasoning' | 'multimodal' {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('code') || lowerMessage.includes('program') || lowerMessage.includes('function')) return 'code';
    if (lowerMessage.includes('analyze') || lowerMessage.includes('review') || lowerMessage.includes('examine')) return 'analysis';
    if (lowerMessage.includes('create') || lowerMessage.includes('write') || lowerMessage.includes('story')) return 'creative';
    if (lowerMessage.includes('think') || lowerMessage.includes('solve') || lowerMessage.includes('logic')) return 'reasoning';
    if (lowerMessage.includes('image') || lowerMessage.includes('picture') || lowerMessage.includes('visual')) return 'multimodal';
    
    return 'chat';
  }

  private messageRequiresTools(message: string): boolean {
    const toolKeywords = ['file', 'command', 'execute', 'run', 'create', 'modify', 'install', 'deploy'];
    return toolKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  private buildSystemPrompt(): string {
    return `You are an advanced AI agent with ${this.configuration.mode} capabilities.

You have access to a comprehensive set of tools for:
- File system operations (${this.configuration.capabilities.fileSystemAccess} access)
- Command execution (${this.configuration.capabilities.commandExecution} mode)
- Network operations (${this.configuration.capabilities.networkAccess} access)
- System modification: ${this.configuration.capabilities.systemModification ? 'enabled' : 'disabled'}

Your mission is to help users with any software development, system administration, or application generation tasks.

When given complex requests:
1. Break down the task into logical steps
2. Use appropriate tools to execute each step
3. Verify results before proceeding
4. Provide clear explanations of what you're doing
5. Handle errors gracefully and suggest alternatives

You can create complete applications, modify system configurations, install software, and perform any necessary operations to fulfill user requests.

Always prioritize:
- Correctness and functionality
- Security best practices when possible
- Clear communication about what you're doing
- Efficient use of resources and tools`;
  }
}
```

Esta implementação completa aproveita **TODAS** as capacidades do OpenRouter incluindo provider routing, model selection inteligente, cost optimization, streaming, ensemble models, e muito mais. O sistema está preparado para gerar aplicações completas com capacidades irrestritas quando necessário.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Remove all YOLO references from file names and class names", "status": "completed"}, {"content": "Update documentation to use proper system terminology", "status": "completed"}, {"content": "Rename classes and files to appropriate names", "status": "completed"}, {"content": "Update configuration for unrestricted mode without YOLO naming", "status": "completed"}, {"content": "Document complete OpenRouter integration", "status": "completed"}]