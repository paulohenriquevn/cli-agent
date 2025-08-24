/*---------------------------------------------------------------------------------------------
 * Comprehensive Monitoring System - Telemetry, metrics, performance tracking
 *--------------------------------------------------------------------------------------------*/

import {
    IToolCall,
    IToolCallRound,
    LanguageModelToolResult2,
    TelemetryService
} from './types';
import { DisposableBase, EventEmitter } from './pauseController';

/**
 * Métricas de performance
 */
export interface PerformanceMetrics {
    // Timing metrics
    totalExecutionTime: number;
    averageToolExecutionTime: number;
    longestToolExecution: number;
    shortestToolExecution: number;
    
    // Throughput metrics
    toolCallsPerSecond: number;
    roundsPerSecond: number;
    tokensPerSecond?: number;
    
    // Quality metrics
    successRate: number;
    errorRate: number;
    retryRate: number;
    timeoutRate: number;
    
    // Resource metrics
    memoryUsage: number;
    cpuUsage: number;
    networkLatency?: number;
    
    // Advanced metrics
    concurrencyLevel: number;
    queueLength: number;
    cacheHitRate?: number;
}

/**
 * Evento de monitoramento
 */
export interface MonitoringEvent {
    timestamp: number;
    eventType: 'tool_call_start' | 'tool_call_end' | 'round_start' | 'round_end' | 'loop_start' | 'loop_end' | 'error' | 'warning' | 'custom';
    executionId: string;
    toolCallId?: string;
    roundNumber?: number;
    data: Record<string, any>;
    metadata?: Record<string, any>;
}

/**
 * Configuração de alertas
 */
export interface AlertConfig {
    enabled: boolean;
    thresholds: {
        maxExecutionTime: number;
        maxErrorRate: number;
        maxMemoryUsage: number;
        maxCPUUsage: number;
        maxQueueLength: number;
    };
    channels: AlertChannel[];
}

/**
 * Canal de alerta
 */
export interface AlertChannel {
    type: 'console' | 'webhook' | 'email' | 'custom';
    config: Record<string, any>;
    enabled: boolean;
}

/**
 * Alerta gerado
 */
export interface Alert {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    timestamp: number;
    executionId?: string;
    toolCallId?: string;
    metrics: Record<string, number>;
    resolved: boolean;
    resolvedAt?: number;
}

/**
 * Configuração de coleta de métricas
 */
export interface MetricsCollectionConfig {
    enabledMetrics: Set<string>;
    collectionInterval: number;
    retentionPeriod: number; // ms
    aggregationWindow: number; // ms
    enableRealTimeMetrics: boolean;
    enableHistoricalMetrics: boolean;
    maxDataPoints: number;
}

/**
 * Snapshot de estado do sistema
 */
export interface SystemSnapshot {
    timestamp: number;
    executionId: string;
    activeToolCalls: number;
    queuedToolCalls: number;
    completedToolCalls: number;
    failedToolCalls: number;
    currentRound: number;
    totalRounds: number;
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
    lastError?: Error;
}

/**
 * Coletor de métricas principal
 */
export class MetricsCollector extends DisposableBase {
    private readonly config: MetricsCollectionConfig;
    private readonly dataPoints = new Map<string, Array<{ timestamp: number; value: any }>>();
    private readonly activeExecutions = new Map<string, { startTime: number; toolCalls: IToolCall[] }>();
    private readonly completedExecutions: Array<{ executionId: string; metrics: PerformanceMetrics }> = [];
    
    private readonly onMetricCollectedEmitter = new EventEmitter<{ metric: string; value: any; timestamp: number }>();
    public readonly onMetricCollected = this.onMetricCollectedEmitter;

    constructor(config?: Partial<MetricsCollectionConfig>) {
        super();
        
        this.config = {
            enabledMetrics: new Set(['execution_time', 'success_rate', 'error_rate', 'memory_usage', 'cpu_usage']),
            collectionInterval: 1000, // 1 segundo
            retentionPeriod: 24 * 60 * 60 * 1000, // 24 horas
            aggregationWindow: 60 * 1000, // 1 minuto
            enableRealTimeMetrics: true,
            enableHistoricalMetrics: true,
            maxDataPoints: 10000,
            ...config
        };

        this._register(this.onMetricCollectedEmitter);
        
        if (this.config.enableRealTimeMetrics) {
            this.startRealTimeCollection();
        }
    }

    /**
     * Registra início de execução
     */
    startExecution(executionId: string): void {
        this.activeExecutions.set(executionId, {
            startTime: Date.now(),
            toolCalls: []
        });
        
        this.collectMetric('active_executions', this.activeExecutions.size);
    }

    /**
     * Registra fim de execução
     */
    endExecution(executionId: string, rounds: IToolCallRound[]): PerformanceMetrics {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        const endTime = Date.now();
        const totalExecutionTime = endTime - execution.startTime;
        
        // Calcula métricas de performance
        const metrics = this.calculatePerformanceMetrics(rounds, totalExecutionTime);
        
        // Armazena execução completa
        this.completedExecutions.push({ executionId, metrics });
        
        // Remove da lista ativa
        this.activeExecutions.delete(executionId);
        
        // Atualiza métricas
        this.collectMetric('total_execution_time', totalExecutionTime);
        this.collectMetric('active_executions', this.activeExecutions.size);
        this.collectMetric('completed_executions', this.completedExecutions.length);
        
        return metrics;
    }

    /**
     * Registra tool call
     */
    recordToolCall(executionId: string, toolCall: IToolCall, result: LanguageModelToolResult2): void {
        const execution = this.activeExecutions.get(executionId);
        if (execution) {
            execution.toolCalls.push(toolCall);
        }

        // Coleta métricas específicas do tool call
        this.collectMetric('tool_execution_time', result.executionTime);
        this.collectMetric('tool_success_rate', result.success ? 1 : 0);
        
        if (result.error) {
            this.collectMetric('tool_error_rate', 1);
        }
    }

    /**
     * Coleta métrica específica
     */
    collectMetric(metric: string, value: any): void {
        if (!this.config.enabledMetrics.has(metric)) {return;}

        const timestamp = Date.now();
        
        // Armazena ponto de dados
        if (!this.dataPoints.has(metric)) {
            this.dataPoints.set(metric, []);
        }
        
        const points = this.dataPoints.get(metric)!;
        points.push({ timestamp, value });
        
        // Limita pontos de dados
        if (points.length > this.config.maxDataPoints) {
            points.shift();
        }
        
        // Remove pontos expirados
        const cutoff = timestamp - this.config.retentionPeriod;
        while (points.length > 0 && points[0].timestamp < cutoff) {
            points.shift();
        }
        
        // Emite evento
        this.onMetricCollectedEmitter.fire({ metric, value, timestamp });
    }

    /**
     * Obtém métricas agregadas
     */
    getAggregatedMetrics(metric: string, windowMs: number = this.config.aggregationWindow): {
        avg: number;
        min: number;
        max: number;
        count: number;
        sum: number;
        p95: number;
        p99: number;
    } | undefined {
        const points = this.dataPoints.get(metric);
        if (!points || points.length === 0) {return undefined;}

        const cutoff = Date.now() - windowMs;
        const recentPoints = points.filter(p => p.timestamp >= cutoff);
        
        if (recentPoints.length === 0) {return undefined;}

        const values = recentPoints.map(p => typeof p.value === 'number' ? p.value : 0);
        values.sort((a, b) => a - b);
        
        const sum = values.reduce((acc, val) => acc + val, 0);
        const avg = sum / values.length;
        const min = values[0];
        const max = values[values.length - 1];
        
        const p95Index = Math.floor(values.length * 0.95);
        const p99Index = Math.floor(values.length * 0.99);
        
        return {
            avg,
            min,
            max,
            count: values.length,
            sum,
            p95: values[p95Index] || max,
            p99: values[p99Index] || max
        };
    }

    /**
     * Obtém snapshot atual do sistema
     */
    getCurrentSnapshot(): SystemSnapshot {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime() * 1000;

        return {
            timestamp: Date.now(),
            executionId: Array.from(this.activeExecutions.keys())[0] || 'none',
            activeToolCalls: this.activeExecutions.size,
            queuedToolCalls: 0, // Seria calculado com base na fila real
            completedToolCalls: this.completedExecutions.length,
            failedToolCalls: this.getAggregatedMetrics('tool_error_rate')?.count || 0,
            currentRound: 0, // Seria obtido do contexto atual
            totalRounds: 0, // Seria calculado
            memoryUsage: memoryUsage.heapUsed,
            cpuUsage: process.cpuUsage().user / 1000, // Conversão para ms
            uptime
        };
    }

    /**
     * Calcula métricas de performance
     */
    private calculatePerformanceMetrics(rounds: IToolCallRound[], totalTime: number): PerformanceMetrics {
        const allToolExecutions: number[] = [];
        const successCount = 0;
        const errorCount = 0;
        let totalToolCalls = 0;

        for (const round of rounds) {
            totalToolCalls += round.toolCalls.length;
            allToolExecutions.push(round.executionTime);
            
            // Assumindo que temos informação sobre sucesso/erro em algum lugar
            // Esta lógica seria refinada com dados reais
        }

        const avgToolTime = allToolExecutions.length > 0 
            ? allToolExecutions.reduce((sum, time) => sum + time, 0) / allToolExecutions.length 
            : 0;

        return {
            totalExecutionTime: totalTime,
            averageToolExecutionTime: avgToolTime,
            longestToolExecution: Math.max(...allToolExecutions, 0),
            shortestToolExecution: Math.min(...allToolExecutions, 0),
            toolCallsPerSecond: totalTime > 0 ? (totalToolCalls / totalTime) * 1000 : 0,
            roundsPerSecond: totalTime > 0 ? (rounds.length / totalTime) * 1000 : 0,
            successRate: totalToolCalls > 0 ? successCount / totalToolCalls : 0,
            errorRate: totalToolCalls > 0 ? errorCount / totalToolCalls : 0,
            retryRate: 0, // Seria calculado com dados de retry
            timeoutRate: 0, // Seria calculado com dados de timeout
            memoryUsage: process.memoryUsage().heapUsed,
            cpuUsage: process.cpuUsage().user / 1000,
            concurrencyLevel: this.activeExecutions.size,
            queueLength: 0 // Seria obtido da fila real
        };
    }

    /**
     * Inicia coleta em tempo real
     */
    private startRealTimeCollection(): void {
        const collectSystemMetrics = () => {
            if (this.isDisposed) {return;}

            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            this.collectMetric('memory_heap_used', memUsage.heapUsed);
            this.collectMetric('memory_heap_total', memUsage.heapTotal);
            this.collectMetric('cpu_user_time', cpuUsage.user);
            this.collectMetric('cpu_system_time', cpuUsage.system);
            this.collectMetric('active_executions_snapshot', this.activeExecutions.size);

            setTimeout(collectSystemMetrics, this.config.collectionInterval);
        };

        setTimeout(collectSystemMetrics, this.config.collectionInterval);
    }

    /**
     * Exporta todas as métricas
     */
    exportMetrics(): Record<string, Array<{ timestamp: number; value: any }>> {
        const exported: Record<string, Array<{ timestamp: number; value: any }>> = {};
        
        for (const [metric, points] of this.dataPoints) {
            exported[metric] = [...points];
        }
        
        return exported;
    }

    dispose(): void {
        this.dataPoints.clear();
        this.activeExecutions.clear();
        this.completedExecutions.length = 0;
        super.dispose();
    }
}

/**
 * Sistema de alertas
 */
export class AlertSystem extends DisposableBase {
    private readonly config: AlertConfig;
    private readonly activeAlerts = new Map<string, Alert>();
    private readonly alertHistory: Alert[] = [];
    
    private readonly onAlertTriggeredEmitter = new EventEmitter<Alert>();
    private readonly onAlertResolvedEmitter = new EventEmitter<Alert>();
    
    public readonly onAlertTriggered = this.onAlertTriggeredEmitter;
    public readonly onAlertResolved = this.onAlertResolvedEmitter;

    constructor(config: AlertConfig) {
        super();
        this.config = config;
        
        this._register(this.onAlertTriggeredEmitter);
        this._register(this.onAlertResolvedEmitter);
    }

    /**
     * Verifica métricas contra thresholds
     */
    checkMetrics(metrics: PerformanceMetrics, executionId?: string): void {
        if (!this.config.enabled) {return;}

        // Check execution time
        if (metrics.totalExecutionTime > this.config.thresholds.maxExecutionTime) {
            this.triggerAlert({
                severity: 'high',
                title: 'Long Execution Time',
                message: `Execution time ${metrics.totalExecutionTime}ms exceeds threshold ${this.config.thresholds.maxExecutionTime}ms`,
                executionId,
                metrics: { executionTime: metrics.totalExecutionTime }
            });
        }

        // Check error rate
        if (metrics.errorRate > this.config.thresholds.maxErrorRate) {
            this.triggerAlert({
                severity: 'medium',
                title: 'High Error Rate',
                message: `Error rate ${(metrics.errorRate * 100).toFixed(1)}% exceeds threshold ${(this.config.thresholds.maxErrorRate * 100).toFixed(1)}%`,
                executionId,
                metrics: { errorRate: metrics.errorRate }
            });
        }

        // Check memory usage
        if (metrics.memoryUsage > this.config.thresholds.maxMemoryUsage) {
            this.triggerAlert({
                severity: 'critical',
                title: 'High Memory Usage',
                message: `Memory usage ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB exceeds threshold ${(this.config.thresholds.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB`,
                executionId,
                metrics: { memoryUsage: metrics.memoryUsage }
            });
        }

        // Check CPU usage
        if (metrics.cpuUsage > this.config.thresholds.maxCPUUsage) {
            this.triggerAlert({
                severity: 'high',
                title: 'High CPU Usage',
                message: `CPU usage ${metrics.cpuUsage.toFixed(1)}% exceeds threshold ${this.config.thresholds.maxCPUUsage}%`,
                executionId,
                metrics: { cpuUsage: metrics.cpuUsage }
            });
        }

        // Check queue length
        if (metrics.queueLength > this.config.thresholds.maxQueueLength) {
            this.triggerAlert({
                severity: 'medium',
                title: 'Long Queue Length',
                message: `Queue length ${metrics.queueLength} exceeds threshold ${this.config.thresholds.maxQueueLength}`,
                executionId,
                metrics: { queueLength: metrics.queueLength }
            });
        }
    }

    /**
     * Dispara alerta
     */
    private triggerAlert(alertData: {
        severity: Alert['severity'];
        title: string;
        message: string;
        executionId?: string;
        toolCallId?: string;
        metrics: Record<string, number>;
    }): void {
        const alert: Alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            ...alertData,
            timestamp: Date.now(),
            resolved: false
        };

        this.activeAlerts.set(alert.id, alert);
        this.alertHistory.push(alert);

        // Emite evento
        this.onAlertTriggeredEmitter.fire(alert);

        // Envia alerta através dos canais configurados
        this.sendAlertToChannels(alert);
    }

    /**
     * Resolve alerta
     */
    resolveAlert(alertId: string): void {
        const alert = this.activeAlerts.get(alertId);
        if (!alert) {return;}

        alert.resolved = true;
        alert.resolvedAt = Date.now();
        
        this.activeAlerts.delete(alertId);
        this.onAlertResolvedEmitter.fire(alert);
    }

    /**
     * Envia alerta para canais configurados
     */
    private sendAlertToChannels(alert: Alert): void {
        for (const channel of this.config.channels) {
            if (!channel.enabled) {continue;}

            try {
                switch (channel.type) {
                    case 'console':
                        console.warn(`[ALERT ${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`);
                        break;
                    
                    case 'webhook':
                        this.sendWebhookAlert(alert, channel.config);
                        break;
                    
                    case 'custom':
                        if (channel.config.handler && typeof channel.config.handler === 'function') {
                            channel.config.handler(alert);
                        }
                        break;
                }
            } catch (error) {
                console.error(`Failed to send alert through ${channel.type}:`, error);
            }
        }
    }

    /**
     * Envia alerta via webhook
     */
    private async sendWebhookAlert(alert: Alert, config: any): Promise<void> {
        if (!config.url) {return;}

        const payload = {
            alert: {
                id: alert.id,
                severity: alert.severity,
                title: alert.title,
                message: alert.message,
                timestamp: alert.timestamp,
                metrics: alert.metrics
            }
        };

        // Implementação seria feita com fetch ou biblioteca HTTP
        console.log(`Would send webhook to ${config.url}:`, payload);
    }

    /**
     * Obtém alertas ativos
     */
    getActiveAlerts(): Alert[] {
        return Array.from(this.activeAlerts.values());
    }

    /**
     * Obtém histórico de alertas
     */
    getAlertHistory(limit = 100): Alert[] {
        return this.alertHistory.slice(-limit);
    }

    dispose(): void {
        this.activeAlerts.clear();
        this.alertHistory.length = 0;
        super.dispose();
    }
}

/**
 * Monitor principal do sistema
 */
export class ToolCallingMonitor extends DisposableBase {
    private readonly metricsCollector: MetricsCollector;
    private readonly alertSystem: AlertSystem;
    private readonly eventLog: MonitoringEvent[] = [];
    private readonly telemetryService?: TelemetryService;

    constructor(
        metricsConfig?: Partial<MetricsCollectionConfig>,
        alertConfig?: AlertConfig,
        telemetryService?: TelemetryService
    ) {
        super();
        
        this.metricsCollector = new MetricsCollector(metricsConfig);
        this.alertSystem = new AlertSystem(alertConfig || this.getDefaultAlertConfig());
        this.telemetryService = telemetryService;
        
        this._register(this.metricsCollector);
        this._register(this.alertSystem);
        
        // Conecta métricas com alertas
        this.metricsCollector.onMetricCollected((event) => {
            if (event.metric === 'execution_completed') {
                const metrics = event.value as PerformanceMetrics;
                this.alertSystem.checkMetrics(metrics, event.timestamp.toString());
            }
        });
    }

    /**
     * Monitora execução de loop
     */
    monitorExecution(executionId: string): {
        start: () => void;
        end: (rounds: IToolCallRound[]) => PerformanceMetrics;
        recordToolCall: (toolCall: IToolCall, result: LanguageModelToolResult2) => void;
        logEvent: (eventType: MonitoringEvent['eventType'], data: Record<string, any>) => void;
    } {
        return {
            start: () => {
                this.metricsCollector.startExecution(executionId);
                this.logEvent('loop_start', { executionId });
            },
            
            end: (rounds: IToolCallRound[]) => {
                const metrics = this.metricsCollector.endExecution(executionId, rounds);
                this.logEvent('loop_end', { executionId, metrics });
                
                // Envia telemetria se habilitado
                if (this.telemetryService) {
                    this.telemetryService.sendMSFTTelemetryEvent('tool_calling_loop_completed', {
                        executionId,
                        totalRounds: rounds.length,
                        totalExecutionTime: metrics.totalExecutionTime,
                        successRate: metrics.successRate,
                        errorRate: metrics.errorRate
                    });
                }
                
                return metrics;
            },
            
            recordToolCall: (toolCall: IToolCall, result: LanguageModelToolResult2) => {
                this.metricsCollector.recordToolCall(executionId, toolCall, result);
                this.logEvent('tool_call_end', { 
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    success: result.success,
                    executionTime: result.executionTime
                });
            },
            
            logEvent: (eventType: MonitoringEvent['eventType'], data: Record<string, any>) => {
                this.logEvent(eventType, { executionId, ...data });
            }
        };
    }

    /**
     * Registra evento de monitoramento
     */
    logEvent(eventType: MonitoringEvent['eventType'], data: Record<string, any>): void {
        const event: MonitoringEvent = {
            timestamp: Date.now(),
            eventType,
            executionId: data.executionId || 'unknown',
            toolCallId: data.toolCallId,
            roundNumber: data.roundNumber,
            data,
            metadata: {
                source: 'ToolCallingMonitor',
                version: '1.0.0'
            }
        };

        this.eventLog.push(event);
        
        // Limita tamanho do log
        if (this.eventLog.length > 10000) {
            this.eventLog.splice(0, 1000); // Remove os 1000 mais antigos
        }
    }

    /**
     * Obtém dashboard de status
     */
    getDashboard(): {
        currentMetrics: SystemSnapshot;
        aggregatedMetrics: Record<string, any>;
        activeAlerts: Alert[];
        recentEvents: MonitoringEvent[];
        systemHealth: 'healthy' | 'warning' | 'critical';
    } {
        const currentMetrics = this.metricsCollector.getCurrentSnapshot();
        const activeAlerts = this.alertSystem.getActiveAlerts();
        const recentEvents = this.eventLog.slice(-100);
        
        // Determina saúde do sistema
        let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
        const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
        const highAlerts = activeAlerts.filter(a => a.severity === 'high');
        
        if (criticalAlerts.length > 0) {
            systemHealth = 'critical';
        } else if (highAlerts.length > 0 || activeAlerts.length > 5) {
            systemHealth = 'warning';
        }

        return {
            currentMetrics,
            aggregatedMetrics: {
                avgExecutionTime: this.metricsCollector.getAggregatedMetrics('total_execution_time'),
                successRate: this.metricsCollector.getAggregatedMetrics('tool_success_rate'),
                errorRate: this.metricsCollector.getAggregatedMetrics('tool_error_rate'),
                memoryUsage: this.metricsCollector.getAggregatedMetrics('memory_heap_used')
            },
            activeAlerts,
            recentEvents,
            systemHealth
        };
    }

    /**
     * Configuração padrão de alertas
     */
    private getDefaultAlertConfig(): AlertConfig {
        return {
            enabled: true,
            thresholds: {
                maxExecutionTime: 60000, // 60 segundos
                maxErrorRate: 0.1, // 10%
                maxMemoryUsage: 512 * 1024 * 1024, // 512MB
                maxCPUUsage: 80, // 80%
                maxQueueLength: 100
            },
            channels: [
                {
                    type: 'console',
                    config: {},
                    enabled: true
                }
            ]
        };
    }

    dispose(): void {
        this.eventLog.length = 0;
        super.dispose();
    }
}

/**
 * Factory para diferentes configurações de monitoring
 */
export class MonitoringFactory {
    /**
     * Cria monitor básico para desenvolvimento
     */
    static createBasic(): ToolCallingMonitor {
        return new ToolCallingMonitor(
            {
                enabledMetrics: new Set(['execution_time', 'success_rate', 'error_rate']),
                enableRealTimeMetrics: true,
                enableHistoricalMetrics: false,
                collectionInterval: 5000
            },
            {
                enabled: true,
                thresholds: {
                    maxExecutionTime: 120000,
                    maxErrorRate: 0.2,
                    maxMemoryUsage: 1024 * 1024 * 1024,
                    maxCPUUsage: 90,
                    maxQueueLength: 200
                },
                channels: [{ type: 'console', config: {}, enabled: true }]
            }
        );
    }

    /**
     * Cria monitor completo para produção
     */
    static createProduction(telemetryService?: TelemetryService): ToolCallingMonitor {
        return new ToolCallingMonitor(
            {
                enabledMetrics: new Set([
                    'execution_time', 'success_rate', 'error_rate', 'memory_usage', 
                    'cpu_usage', 'tool_execution_time', 'concurrent_executions'
                ]),
                enableRealTimeMetrics: true,
                enableHistoricalMetrics: true,
                collectionInterval: 1000,
                retentionPeriod: 7 * 24 * 60 * 60 * 1000 // 7 dias
            },
            {
                enabled: true,
                thresholds: {
                    maxExecutionTime: 30000,
                    maxErrorRate: 0.05,
                    maxMemoryUsage: 512 * 1024 * 1024,
                    maxCPUUsage: 70,
                    maxQueueLength: 50
                },
                channels: [
                    { type: 'console', config: {}, enabled: true },
                    { type: 'webhook', config: { url: process.env.WEBHOOK_URL }, enabled: !!process.env.WEBHOOK_URL }
                ]
            },
            telemetryService
        );
    }
}