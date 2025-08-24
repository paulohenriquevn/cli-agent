/*---------------------------------------------------------------------------------------------
 * Tool Normalization Tool - CLI interface for the normalization system
 *--------------------------------------------------------------------------------------------*/

import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult,
    CliTextPart,
    CliErrorPart
} from '../types/cliTypes';
import { 
    NormalizationIntegration, 
    ModelConfigurations, 
    NormalizationConfig,
    ModelConfig 
} from '../normalization/normalizationIntegration';

interface IToolNormalizationParams {
    action: 'normalize' | 'validate' | 'report' | 'health' | 'limitations' | 'clear_cache' | 'list_models';
    model_family?: string;
    model_name?: string;
    tools?: string[]; // Tool names to normalize (if empty, normalizes all)
    config?: {
        enable_cache?: boolean;
        strict_validation?: boolean;
        log_fixes?: boolean;
        max_description_length?: number;
    };
}

export class ToolNormalizationTool extends BaseTool<IToolNormalizationParams> {
    readonly name = 'tool_normalization';
    readonly description = `Advanced tool schema normalization system for LLM model compatibility.

Transforms tool schemas to work across different AI models (GPT-4, Claude, Gemini) by removing unsupported features and applying model-specific optimizations.

Use when: Preparing tools for different AI models, debugging tool compatibility issues, or analyzing normalization performance.

Features: Universal compatibility, intelligent caching, detailed reporting, health monitoring, and performance metrics.

Examples: Normalize all tools for GPT-4, validate tool schemas, generate performance reports, clear normalization cache.`;

    readonly tags = ['normalization', 'compatibility', 'llm', 'tools', 'schemas'];
    readonly category = 'development';
    readonly complexity: 'advanced' = 'advanced';
    
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['normalize', 'validate', 'report', 'health', 'limitations', 'clear_cache', 'list_models'],
                description: 'Action to perform with the normalization system'
            },
            model_family: {
                type: 'string',
                description: 'Target model family (e.g., gpt-4, claude-3, deepseek-coder)',
                examples: ['gpt-4', 'claude-3', 'gemini-', 'o1-', 'deepseek-coder', 'deepseek-chat']
            },
            model_name: {
                type: 'string',
                description: 'Specific model name for better identification',
                examples: ['GPT-4', 'Claude 3 Sonnet', 'Gemini Pro', 'DeepSeek Coder', 'DeepSeek Chat']
            },
            tools: {
                type: 'array',
                items: {
                    type: 'string'
                },
                description: 'Specific tool names to process (empty = all tools)',
                examples: [['readFile', 'writeFile'], ['task', 'bash_command']]
            },
            config: {
                type: 'object',
                properties: {
                    enable_cache: {
                        type: 'boolean',
                        description: 'Enable normalization caching for performance',
                        default: true
                    },
                    strict_validation: {
                        type: 'boolean',
                        description: 'Enable strict schema validation',
                        default: true
                    },
                    log_fixes: {
                        type: 'boolean',
                        description: 'Log all applied normalization fixes',
                        default: true
                    },
                    max_description_length: {
                        type: 'number',
                        description: 'Maximum description length (for GPT-4)',
                        default: 1024,
                        minimum: 100,
                        maximum: 4096
                    }
                },
                description: 'Normalization configuration options'
            }
        },
        required: ['action']
    };

    private integration: NormalizationIntegration;

    constructor() {
        super();
        this.integration = new NormalizationIntegration();
        this.integration.setLogger((level, message, data) => {
            if (level === 'error') {
                console.error(`[Normalization] ${message}`, data ? JSON.stringify(data, null, 2) : '');
            } else if (level === 'info') {
                console.log(`[Normalization] ${message}`, data ? JSON.stringify(data, null, 2) : '');
            } else {
                console.debug(`[Normalization] ${message}`, data ? JSON.stringify(data, null, 2) : '');
            }
        });
    }

    async invoke(
        options: CliToolInvocationOptions<IToolNormalizationParams>,
        token: CliCancellationToken
    ): Promise<CliToolResult> {

        const { action, model_family, model_name, tools, config } = options.input;

        try {
            // Apply configuration if provided
            if (config) {
                this.integration = new NormalizationIntegration(config as NormalizationConfig);
            }

            switch (action) {
                case 'normalize':
                    return await this.handleNormalize(model_family, model_name, tools);
                
                case 'validate':
                    return await this.handleValidate(tools);
                
                case 'report':
                    return await this.handleReport();
                
                case 'health':
                    return await this.handleHealth();
                
                case 'limitations':
                    return await this.handleLimitations(model_family);
                
                case 'clear_cache':
                    return await this.handleClearCache();
                
                case 'list_models':
                    return await this.handleListModels();
                
                default:
                    return this.createErrorResult(`Unknown action: ${action}`);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return this.createErrorResult(`Tool normalization failed: ${errorMessage}`);
        }
    }

    private async handleNormalize(
        modelFamily?: string,
        modelName?: string,
        toolNames?: string[]
    ): Promise<CliToolResult> {
        
        if (!modelFamily) {
            return this.createErrorResult('model_family is required for normalization');
        }

        const modelConfig: ModelConfig = {
            family: modelFamily,
            name: modelName || modelFamily
        };

        const registry = ToolRegistry;
        let toolsToNormalize = registry.getAllTools(this.context);

        // Filter specific tools if requested
        if (toolNames && toolNames.length > 0) {
            toolsToNormalize = toolsToNormalize.filter(tool => 
                toolNames.includes(tool.name)
            );
            
            if (toolsToNormalize.length === 0) {
                return this.createErrorResult(`No tools found matching names: ${toolNames.join(', ')}`);
            }
        }

        const startTime = performance.now();
        const normalizedTools = await this.integration.normalizeRegistryTools(
            modelConfig, 
            this.context
        );
        const duration = performance.now() - startTime;

        const report = {
            model: modelConfig,
            original_count: toolsToNormalize.length,
            normalized_count: normalizedTools.length,
            duration_ms: Math.round(duration),
            normalized_tools: normalizedTools.map(tool => ({
                name: tool.function.name,
                description: tool.function.description,
                parameters_type: tool.function.parameters.type,
                properties_count: Object.keys(tool.function.parameters.properties || {}).length
            })),
            limitations_applied: this.integration.getModelLimitations(modelFamily)
        };

        return this.createSuccessResult(
            report,
            `✅ Successfully normalized ${toolsToNormalize.length} tools for ${modelConfig.name} in ${Math.round(duration)}ms`
        );
    }

    private async handleValidate(toolNames?: string[]): Promise<CliToolResult> {
        const registry = ToolRegistry;
        let toolsToValidate = registry.getAllTools(this.context);

        // Filter specific tools if requested
        if (toolNames && toolNames.length > 0) {
            toolsToValidate = toolsToValidate.filter(tool => 
                toolNames.includes(tool.name)
            );
        }

        const results = toolsToValidate.map(tool => {
            const validation = this.integration.validateToolSchema(tool);
            return {
                name: tool.name,
                category: tool.category,
                complexity: tool.complexity,
                is_valid: validation.isValid,
                errors: validation.errors
            };
        });

        const validCount = results.filter(r => r.is_valid).length;
        const invalidCount = results.length - validCount;

        const report = {
            summary: {
                total_tools: results.length,
                valid_tools: validCount,
                invalid_tools: invalidCount,
                validation_rate: `${((validCount / results.length) * 100).toFixed(1)}%`
            },
            results,
            invalid_tools: results.filter(r => !r.is_valid)
        };

        const status = invalidCount === 0 
            ? `✅ All ${results.length} tools passed validation`
            : `⚠️  ${invalidCount} of ${results.length} tools failed validation`;

        return this.createSuccessResult(report, status);
    }

    private async handleReport(): Promise<CliToolResult> {
        const report = this.integration.generateReport();
        const metrics = this.integration.getMetrics();
        
        const summary = `📊 Normalization System Report

🔢 **Summary Statistics:**
- Total Normalizations: ${report.summary.totalNormalizations}
- Unique Models: ${report.summary.uniqueModels}
- Most Active Model: ${report.summary.mostActiveModel}
- Avg Fixes per Normalization: ${report.summary.averageFixesPerNormalization.toFixed(2)}

⚡ **Performance Metrics:**
- Average Normalization Time: ${report.performance.averageTime.toFixed(1)}ms
- Cache Hit Rate: ${(report.performance.cacheHitRate * 100).toFixed(1)}%
- Cache Size: ${report.performance.cacheSize} entries

🔧 **Top Applied Fixes:**
${report.commonFixes.slice(0, 5).map((fix, i) => 
    `${i + 1}. ${fix.fix} (${fix.count}x, ${fix.percentage.toFixed(1)}%)`
).join('\n')}`;

        return this.createSuccessResult(report, summary);
    }

    private async handleHealth(): Promise<CliToolResult> {
        const health = this.integration.healthCheck();
        
        const statusEmoji = {
            'healthy': '✅',
            'warning': '⚠️',
            'error': '❌'
        };

        const message = `${statusEmoji[health.status]} Normalization System Health: ${health.status.toUpperCase()}

${health.issues.length > 0 ? `🚨 **Issues Detected:**\n${health.issues.map(issue => `- ${issue}`).join('\n')}\n` : ''}

📊 **Current Metrics:**
- Total Operations: ${health.metrics.successfulNormalizations + health.metrics.validationFailures}
- Success Rate: ${((health.metrics.successfulNormalizations / (health.metrics.successfulNormalizations + health.metrics.validationFailures || 1)) * 100).toFixed(1)}%
- Cache Hit Rate: ${(health.metrics.cacheHitRate * 100).toFixed(1)}%
- Average Processing Time: ${health.metrics.averageNormalizationTime.toFixed(1)}ms`;

        return this.createSuccessResult(health, message);
    }

    private async handleLimitations(modelFamily?: string): Promise<CliToolResult> {
        if (!modelFamily) {
            const allLimitations = {
                'gpt-4': this.integration.getModelLimitations('gpt-4'),
                'claude-3': this.integration.getModelLimitations('claude-3'),
                'gemini-': this.integration.getModelLimitations('gemini-'),
                'o1-': this.integration.getModelLimitations('o1-')
            };

            const message = `🔒 **AI Model Limitations Overview:**

${Object.entries(allLimitations).map(([family, limitations]) => 
    `**${family.toUpperCase()}:**\n${limitations.map(l => `- ${l}`).join('\n')}\n`
).join('\n')}`;

            return this.createSuccessResult(allLimitations, message);
        }

        const limitations = this.integration.getModelLimitations(modelFamily);
        const message = `🔒 **${modelFamily.toUpperCase()} Model Limitations:**

${limitations.length > 0 
    ? limitations.map(limitation => `- ${limitation}`).join('\n')
    : 'No specific limitations documented for this model family.'
}`;

        return this.createSuccessResult({ model_family: modelFamily, limitations }, message);
    }

    private async handleClearCache(): Promise<CliToolResult> {
        const stats = this.integration.getCacheStats();
        this.integration.clearCache();
        
        const message = `🧹 **Cache Cleared Successfully**

**Previous Cache Stats:**
- Size: ${stats.size} entries
- Hits: ${stats.hits}
- Misses: ${stats.misses}
- Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%

Cache has been reset and will rebuild on next normalization.`;

        return this.createSuccessResult({ cleared_stats: stats }, message);
    }

    private async handleListModels(): Promise<CliToolResult> {
        const models = ModelConfigurations.getAll();
        
        const message = `🤖 **Supported AI Models:**

${models.map(model => 
    `**${model.name}** (${model.family})\n` +
    `  Limitations: ${this.integration.getModelLimitations(model.family).length} documented`
).join('\n\n')}

To normalize tools for a specific model, use:
\`tool_normalization normalize --model_family "gpt-4" --model_name "GPT-4"\``;

        return this.createSuccessResult({ models }, message);
    }
}