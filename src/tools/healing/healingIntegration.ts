/*---------------------------------------------------------------------------------------------
 * Tool Healing Integration - Connects healing system with CLI agent pipeline
 *--------------------------------------------------------------------------------------------*/

import { ToolHealer, HealingResult, HealingMetrics, ModelBugPattern } from './toolHealer';
import { BaseTool } from '../base/baseTool';
import { NoMatchError, ToolParameters } from '../types/cliTypes';
import { CliExecutionContext } from '../types/cliTypes';

export interface HealingConfig {
    enableHealing?: boolean;
    enableMetacognition?: boolean;
    maxHealingAttempts?: number;
    healingTimeout?: number;
    logHealing?: boolean;
    cacheHealings?: boolean;
    metacognitionModel?: string;
    openRouterApiKey?: string;
    siteUrl?: string;
    siteName?: string;
}

export interface HealingIntegrationResult {
    success: boolean;
    originalError?: NoMatchError;
    healedParameters?: ToolParameters;
    healingAttempts: number;
    healingTime: number;
    healingMethod?: string;
    metacognitionUsed: boolean;
    confidence?: number;
}

export class HealingIntegration {
    private healer: ToolHealer;
    private config: HealingConfig & {
        enableHealing: boolean;
        enableMetacognition: boolean;
        maxHealingAttempts: number;
        healingTimeout: number;
        logHealing: boolean;
        cacheHealings: boolean;
        metacognitionModel: string;
    };
    private logger?: (level: string, message: string, data?: any) => void;

    constructor(config: HealingConfig = {}) {
        this.config = {
            enableHealing: true,
            enableMetacognition: true,
            maxHealingAttempts: 3,
            healingTimeout: 30000, // 30 seconds
            logHealing: true,
            cacheHealings: true,
            metacognitionModel: 'gpt-4o-mini',
            ...config
        };

        this.healer = new ToolHealer({
            enableMetacognition: this.config.enableMetacognition,
            maxAttempts: this.config.maxHealingAttempts,
            timeout: this.config.healingTimeout,
            enableCaching: this.config.cacheHealings,
            metacognitionModel: this.config.metacognitionModel,
            openRouterApiKey: this.config.openRouterApiKey,
            siteUrl: this.config.siteUrl,
            siteName: this.config.siteName
        });
    }

    public setLogger(logger: (level: string, message: string, data?: any) => void): void {
        this.logger = logger;
    }

    /**
     * Attempt to heal tool parameters when tool execution fails
     */
    public async attemptHealing(
        sourceModel: string,
        tool: BaseTool,
        originalParameters: ToolParameters,
        error: NoMatchError,
        context?: CliExecutionContext
    ): Promise<HealingIntegrationResult> {
        
        const startTime = performance.now();
        let attempts = 0;
        let lastError = error;
        
        if (!this.config.enableHealing) {
            this.logger?.('info', 'Tool healing disabled in configuration');
            return {
                success: false,
                originalError: error,
                healingAttempts: 0,
                healingTime: 0,
                metacognitionUsed: false
            };
        }

        this.logger?.('info', `Starting healing process for tool: ${tool.name}`, {
            sourceModel,
            errorType: error.type || 'unknown',
            originalParams: this.sanitizeParametersForLogging(originalParameters)
        });

        // Read the target file to provide context for healing
        let fileContent = '';
        if (error.filePath && context?.fileSystem) {
            try {
                fileContent = await context.fileSystem.readFile(error.filePath);
            } catch (readError) {
                this.logger?.('debug', `Could not read file for healing context: ${error.filePath}`);
            }
        }

        while (attempts < this.config.maxHealingAttempts) {
            attempts++;
            
            this.logger?.('debug', `Healing attempt ${attempts}/${this.config.maxHealingAttempts}`);
            
            try {
                const healingResult = await this.healer.healToolParameters(
                    sourceModel,
                    fileContent,
                    originalParameters,
                    lastError
                );

                if (healingResult.success) {
                    const duration = performance.now() - startTime;
                    
                    this.logger?.('info', `Tool healing successful after ${attempts} attempts`, {
                        tool: tool.name,
                        healingTime: Math.round(duration),
                        healingMethod: healingResult.healingMethod,
                        metacognitionUsed: healingResult.metacognitionUsed
                    });

                    return {
                        success: true,
                        healedParameters: healingResult.healedParameters,
                        healingAttempts: attempts,
                        healingTime: Math.round(duration),
                        healingMethod: healingResult.healingMethod,
                        metacognitionUsed: healingResult.metacognitionUsed,
                        confidence: healingResult.confidence
                    };
                } else if (healingResult.newError) {
                    // Update error for next attempt
                    lastError = healingResult.newError;
                    this.logger?.('debug', `Healing attempt ${attempts} failed, trying again`, {
                        newError: healingResult.newError.message
                    });
                }

            } catch (healingError) {
                this.logger?.('error', `Healing attempt ${attempts} threw error`, {
                    error: healingError instanceof Error ? healingError.message : String(healingError)
                });
                
                // Continue to next attempt
                continue;
            }
        }

        const duration = performance.now() - startTime;
        
        this.logger?.('warn', `Tool healing failed after ${attempts} attempts`, {
            tool: tool.name,
            totalTime: Math.round(duration),
            finalError: lastError.message
        });

        return {
            success: false,
            originalError: error,
            healingAttempts: attempts,
            healingTime: Math.round(duration),
            metacognitionUsed: this.config.enableMetacognition
        };
    }

    /**
     * Get healing system metrics
     */
    public getMetrics(): HealingMetrics {
        return this.healer.getMetrics();
    }

    /**
     * Get healing cache statistics
     */
    public getCacheStats() {
        return this.healer.getCacheStats();
    }

    /**
     * Clear healing cache
     */
    public clearCache(): void {
        this.healer.clearCache();
        this.logger?.('info', 'Tool healing cache cleared');
    }

    /**
     * Get model-specific bug patterns
     */
    public getModelBugPatterns(modelFamily: string): ModelBugPattern[] {
        return this.healer.getModelBugPatterns(modelFamily);
    }

    /**
     * Health check for healing system
     */
    public healthCheck(): {
        status: 'healthy' | 'warning' | 'error';
        issues: string[];
        metrics: HealingMetrics;
        config: Required<HealingConfig>;
    } {
        const metrics = this.getMetrics();
        const issues: string[] = [];
        let status: 'healthy' | 'warning' | 'error' = 'healthy';

        // Check success rate
        const totalAttempts = metrics.successfulHealings + metrics.failedHealings;
        if (totalAttempts > 0) {
            const successRate = metrics.successfulHealings / totalAttempts;
            if (successRate < 0.3) { // Less than 30% success rate
                issues.push(`Low healing success rate: ${(successRate * 100).toFixed(1)}%`);
                status = 'warning';
            }
            if (successRate < 0.1) { // Less than 10% success rate
                status = 'error';
            }
        }

        // Check performance
        if (metrics.averageHealingTime > 10000) { // More than 10 seconds
            issues.push(`Slow healing performance: ${(metrics.averageHealingTime / 1000).toFixed(1)}s average`);
            if (status === 'healthy') {status = 'warning';}
        }

        // Check metacognition usage
        if (this.config.enableMetacognition && metrics.metacognitionUsageRate < 0.5 && totalAttempts > 5) {
            issues.push(`Low metacognition usage: ${(metrics.metacognitionUsageRate * 100).toFixed(1)}%`);
            if (status === 'healthy') {status = 'warning';}
        }

        return {
            status,
            issues,
            metrics,
            config: this.config
        };
    }

    /**
     * Generate comprehensive healing report
     */
    public generateHealingReport(): {
        summary: {
            totalHealings: number;
            successRate: number;
            averageTime: number;
            metacognitionUsage: number;
        };
        modelBreakdown: Record<string, {
            attempts: number;
            successes: number;
            avgTime: number;
            commonPatterns: string[];
        }>;
        topHealingMethods: Array<{
            method: string;
            count: number;
            successRate: number;
        }>;
        performance: {
            cacheHitRate: number;
            averageHealingTime: number;
            totalCacheEntries: number;
        };
    } {
        const metrics = this.getMetrics();
        const cache = this.getCacheStats();
        
        const totalAttempts = metrics.successfulHealings + metrics.failedHealings;
        const successRate = totalAttempts > 0 ? metrics.successfulHealings / totalAttempts : 0;

        // Calculate model breakdown
        const modelBreakdown: Record<string, any> = {};
        for (const [model, data] of Object.entries(metrics.healingsByModel)) {
            modelBreakdown[model] = {
                attempts: data.attempts,
                successes: data.successes,
                avgTime: data.totalTime / Math.max(data.attempts, 1),
                commonPatterns: Object.keys(data.patterns || {}).slice(0, 3)
            };
        }

        // Calculate top healing methods
        const methodStats = Object.entries(metrics.healingMethodStats).map(([method, data]) => ({
            method,
            count: data.uses,
            successRate: data.successes / Math.max(data.uses, 1)
        })).sort((a, b) => b.count - a.count).slice(0, 5);

        return {
            summary: {
                totalHealings: totalAttempts,
                successRate,
                averageTime: metrics.averageHealingTime,
                metacognitionUsage: metrics.metacognitionUsageRate
            },
            modelBreakdown,
            topHealingMethods: methodStats,
            performance: {
                cacheHitRate: cache.hitRate,
                averageHealingTime: metrics.averageHealingTime,
                totalCacheEntries: cache.size
            }
        };
    }

    /**
     * Sanitize parameters for logging (remove sensitive data)
     */
    private sanitizeParametersForLogging(params: ToolParameters): any {
        const sanitized = { ...params };
        
        // Remove or mask sensitive fields
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential'];
        
        for (const field of sensitiveFields) {
            if (field in sanitized) {
                sanitized[field] = '[REDACTED]';
            }
        }
        
        return sanitized;
    }
}

export default HealingIntegration;