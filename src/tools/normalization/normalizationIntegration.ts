/*---------------------------------------------------------------------------------------------
 * Tool Normalization Integration - Integrates normalization with the CLI agent system
 *--------------------------------------------------------------------------------------------*/

import { ToolNormalizer, OpenAiFunctionTool, NormalizationMetrics } from './toolNormalizer';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { CliExecutionContext } from '../types/cliTypes';

export interface NormalizationConfig {
    enableCache?: boolean;
    strictValidation?: boolean;
    logFixes?: boolean;
    maxDescriptionLength?: number;
    telemetryEnabled?: boolean;
}

export interface ModelConfig {
    family: string;
    name: string;
    limitations?: string[];
}

export class NormalizationIntegration {
    private normalizer: ToolNormalizer;
    private config: Required<NormalizationConfig>;
    private logger?: (level: string, message: string, data?: any) => void;
    
    constructor(config: NormalizationConfig = {}) {
        this.config = {
            enableCache: true,
            strictValidation: true,
            logFixes: true,
            maxDescriptionLength: 1024,
            telemetryEnabled: false,
            ...config
        };
        
        this.normalizer = new ToolNormalizer(this.config);
    }
    
    public setLogger(logger: (level: string, message: string, data?: any) => void): void {
        this.logger = logger;
    }
    
    /**
     * Convert BaseTool instances to OpenAI function format
     */
    private convertBaseToolsToOpenAI(tools: BaseTool[]): OpenAiFunctionTool[] {
        return tools.map(tool => ({
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema as any
            }
        }));
    }
    
    /**
     * Normalize tools from ToolRegistry for a specific model
     */
    public async normalizeRegistryTools(
        modelConfig: ModelConfig,
        context?: CliExecutionContext
    ): Promise<OpenAiFunctionTool[]> {
        
        const registry = ToolRegistry.getInstance();
        const allTools = registry.getAllTools(context);
        
        this.logger?.('debug', `Normalizing ${allTools.length} tools for model: ${modelConfig.name}`);
        
        const openAiTools = this.convertBaseToolsToOpenAI(allTools);
        
        const fixes: Array<{ tool: string; message: string }> = [];
        
        const normalized = this.normalizer.normalizeToolSchema(
            modelConfig.family,
            openAiTools,
            (toolName, message) => {
                fixes.push({ tool: toolName, message });
                this.logger?.('debug', `Tool normalization fix: ${toolName} - ${message}`);
            }
        );
        
        // Log summary
        if (fixes.length > 0) {
            const affectedTools = new Set(fixes.map(f => f.tool));
            this.logger?.('info', `Applied ${fixes.length} normalization fixes to ${affectedTools.size} tools for ${modelConfig.name}`);
            
            if (this.config.telemetryEnabled) {
                this.sendTelemetry('normalization_completed', {
                    modelFamily: modelConfig.family,
                    modelName: modelConfig.name,
                    totalTools: openAiTools.length,
                    fixesApplied: fixes.length,
                    affectedTools: affectedTools.size,
                    fixes: fixes.reduce((acc, fix) => {
                        acc[fix.message] = (acc[fix.message] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>)
                });
            }
        } else {
            this.logger?.('info', `No normalization fixes needed for ${modelConfig.name}`);
        }
        
        return normalized;
    }
    
    /**
     * Normalize specific tools
     */
    public normalizeTools(
        modelConfig: ModelConfig,
        tools: BaseTool[]
    ): OpenAiFunctionTool[] {
        
        const openAiTools = this.convertBaseToolsToOpenAI(tools);
        
        return this.normalizer.normalizeToolSchema(
            modelConfig.family,
            openAiTools,
            (toolName, message) => {
                this.logger?.('debug', `Tool normalization: ${toolName} - ${message}`);
            }
        );
    }
    
    /**
     * Validate a tool schema without normalization
     */
    public validateToolSchema(tool: BaseTool): { isValid: boolean; errors: string[] } {
        try {
            const isValid = ToolNormalizer.validate(tool.inputSchema as any);
            return {
                isValid,
                errors: isValid ? [] : ['Schema validation failed']
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
    
    /**
     * Get model limitations for display
     */
    public getModelLimitations(modelFamily: string): string[] {
        return ToolNormalizer.getModelLimitations(modelFamily);
    }
    
    /**
     * Get normalization metrics
     */
    public getMetrics(): NormalizationMetrics {
        return this.normalizer.getMetrics();
    }
    
    /**
     * Get cache statistics
     */
    public getCacheStats() {
        return this.normalizer.getCacheStats();
    }
    
    /**
     * Clear normalization cache
     */
    public clearCache(): void {
        this.normalizer.clearCache();
        this.logger?.('info', 'Normalization cache cleared');
    }
    
    /**
     * Health check for the normalization system
     */
    public healthCheck(): {
        status: 'healthy' | 'warning' | 'error';
        issues: string[];
        metrics: NormalizationMetrics;
        cache: any;
    } {
        const metrics = this.getMetrics();
        const cache = this.getCacheStats();
        const issues: string[] = [];
        let status: 'healthy' | 'warning' | 'error' = 'healthy';
        
        // Check failure rate
        const totalOperations = metrics.successfulNormalizations + metrics.validationFailures;
        if (totalOperations > 0) {
            const failureRate = metrics.validationFailures / totalOperations;
            if (failureRate > 0.1) { // 10% failure rate
                issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
                status = 'warning';
            }
            if (failureRate > 0.25) { // 25% failure rate
                status = 'error';
            }
        }
        
        // Check performance
        if (metrics.averageNormalizationTime > 100) { // 100ms
            issues.push(`Slow normalization: ${metrics.averageNormalizationTime.toFixed(1)}ms average`);
            if (status === 'healthy') {status = 'warning';}
        }
        
        // Check cache efficiency
        if (this.config.enableCache && metrics.cacheHitRate < 0.5 && totalOperations > 10) {
            issues.push(`Low cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
            if (status === 'healthy') {status = 'warning';}
        }
        
        return {
            status,
            issues,
            metrics,
            cache
        };
    }
    
    /**
     * Generate normalization report
     */
    public generateReport(): {
        summary: {
            totalNormalizations: number;
            uniqueModels: number;
            mostActiveModel: string;
            averageFixesPerNormalization: number;
        };
        modelBreakdown: Record<string, {
            normalizations: number;
            fixes: number;
            avgFixesPerNormalization: number;
        }>;
        commonFixes: Array<{
            fix: string;
            count: number;
            percentage: number;
        }>;
        performance: {
            averageTime: number;
            cacheHitRate: number;
            cacheSize: number;
        };
    } {
        const metrics = this.getMetrics();
        const cache = this.getCacheStats();
        
        // Calculate summary
        const totalFixes = Object.values(metrics.fixesAppliedByModel).reduce((sum, count) => sum + count, 0);
        const uniqueModels = Object.keys(metrics.fixesAppliedByModel).length;
        const mostActiveModel = Object.entries(metrics.fixesAppliedByModel)
            .reduce((max, [model, count]) => count > max.count ? { model, count } : max, { model: '', count: 0 }).model;
        
        // Calculate model breakdown
        const modelBreakdown: Record<string, any> = {};
        for (const [model, fixes] of Object.entries(metrics.fixesAppliedByModel)) {
            // Assuming equal distribution of normalizations across models for simplicity
            const normalizations = Math.ceil(metrics.totalNormalizations / uniqueModels);
            modelBreakdown[model] = {
                normalizations,
                fixes,
                avgFixesPerNormalization: fixes / normalizations
            };
        }
        
        // Calculate common fixes
        const totalFixInstances = Object.values(metrics.mostCommonFixes).reduce((sum, count) => sum + count, 0);
        const commonFixes = Object.entries(metrics.mostCommonFixes)
            .map(([fix, count]) => ({
                fix,
                count,
                percentage: (count / totalFixInstances) * 100
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10 most common fixes
        
        return {
            summary: {
                totalNormalizations: metrics.totalNormalizations,
                uniqueModels,
                mostActiveModel,
                averageFixesPerNormalization: totalFixes / metrics.totalNormalizations || 0
            },
            modelBreakdown,
            commonFixes,
            performance: {
                averageTime: metrics.averageNormalizationTime,
                cacheHitRate: metrics.cacheHitRate,
                cacheSize: cache.size
            }
        };
    }
    
    private sendTelemetry(eventName: string, data: any): void {
        if (!this.config.telemetryEnabled) {return;}
        
        // In a real implementation, this would send to your telemetry service
        this.logger?.('info', `Telemetry: ${eventName}`, data);
    }
}

// Factory function for common model configurations
export class ModelConfigurations {
    public static readonly GPT4 = { family: 'gpt-4', name: 'GPT-4' };
    public static readonly GPT4O = { family: 'gpt-4o', name: 'GPT-4o' };
    public static readonly CLAUDE3_SONNET = { family: 'claude-3', name: 'Claude 3 Sonnet' };
    public static readonly CLAUDE3_OPUS = { family: 'claude-3', name: 'Claude 3 Opus' };
    public static readonly CLAUDE3_HAIKU = { family: 'claude-3', name: 'Claude 3 Haiku' };
    public static readonly GEMINI_PRO = { family: 'gemini-', name: 'Gemini Pro' };
    public static readonly O1_PREVIEW = { family: 'o1-', name: 'O1 Preview' };
    public static readonly DEEPSEEK_CODER = { family: 'deepseek-coder', name: 'DeepSeek Coder' };
    public static readonly DEEPSEEK_CHAT = { family: 'deepseek-chat', name: 'DeepSeek Chat' };
    
    public static getAll(): ModelConfig[] {
        return [
            this.GPT4,
            this.GPT4O,
            this.CLAUDE3_SONNET,
            this.CLAUDE3_OPUS,
            this.CLAUDE3_HAIKU,
            this.GEMINI_PRO,
            this.O1_PREVIEW,
            this.DEEPSEEK_CODER,
            this.DEEPSEEK_CHAT
        ];
    }
    
    public static findByName(name: string): ModelConfig | undefined {
        return this.getAll().find(config => 
            config.name.toLowerCase() === name.toLowerCase() ||
            config.family.toLowerCase().includes(name.toLowerCase())
        );
    }
}

export default NormalizationIntegration;