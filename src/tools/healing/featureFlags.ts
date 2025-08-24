/*---------------------------------------------------------------------------------------------
 * Feature Flags and Experimentation Service for Tool Healing
 *--------------------------------------------------------------------------------------------*/

import { ExperimentationService } from './healingTypes';

/**
 * Feature flags relacionadas ao healing
 */
export interface HealingFeatureFlags {
    // String Replace Healing
    codeEditingWithLLMStringReplaceHealing: boolean;
    stringReplaceHealingMaxAttempts: number;
    stringReplaceHealingTimeout: number;
    
    // Patch Healing
    patchApplyHealing: boolean;
    patchHealingMaxAttempts: number;
    patchHealingTimeout: number;
    
    // Model-specific fixes
    geminiUnescapeFix: boolean;
    claudeFormattingFix: boolean;
    gptContextFix: boolean;
    
    // Performance and limits
    healingConcurrentLimit: number;
    healingMemoryLimit: number;
    healingContextTruncation: boolean;
    
    // Telemetry and monitoring
    healingDetailedTelemetry: boolean;
    healingPerformanceMetrics: boolean;
    healingErrorReporting: boolean;
}

/**
 * Configuração padrão das feature flags
 */
const DEFAULT_HEALING_FLAGS: HealingFeatureFlags = {
    // String Replace Healing
    codeEditingWithLLMStringReplaceHealing: true,
    stringReplaceHealingMaxAttempts: 3,
    stringReplaceHealingTimeout: 10000,
    
    // Patch Healing  
    patchApplyHealing: true,
    patchHealingMaxAttempts: 2,
    patchHealingTimeout: 15000,
    
    // Model-specific fixes
    geminiUnescapeFix: true,
    claudeFormattingFix: true,
    gptContextFix: true,
    
    // Performance and limits
    healingConcurrentLimit: 3,
    healingMemoryLimit: 50 * 1024 * 1024, // 50MB
    healingContextTruncation: true,
    
    // Telemetry and monitoring
    healingDetailedTelemetry: true,
    healingPerformanceMetrics: true,
    healingErrorReporting: true
};

/**
 * Implementação de ExperimentationService com feature flags
 */
export class HealingExperimentationService implements ExperimentationService {
    private readonly flags: Map<string, any> = new Map();
    private readonly overrides: Map<string, any> = new Map();

    constructor(
        initialFlags?: Partial<HealingFeatureFlags>,
        private readonly remoteConfigProvider?: () => Promise<Record<string, any>>
    ) {
        // Carrega flags padrão
        this.loadDefaultFlags();
        
        // Aplica flags iniciais se fornecidas
        if (initialFlags) {
            this.setFlags(initialFlags);
        }
        
        // Inicia sincronização periódica se provider remoto disponível
        if (this.remoteConfigProvider) {
            this.startPeriodicSync();
        }
    }

    /**
     * Obtém valor de feature flag com fallback
     */
    getTreatmentVariable<T>(key: string, defaultValue: T): T {
        // Prioridade: override > flag local > default
        if (this.overrides.has(key)) {
            return this.overrides.get(key);
        }
        
        if (this.flags.has(key)) {
            return this.flags.get(key);
        }
        
        return defaultValue;
    }

    /**
     * Define flag específica
     */
    setFlag<K extends keyof HealingFeatureFlags>(key: K, value: HealingFeatureFlags[K]): void {
        this.flags.set(key, value);
    }

    /**
     * Define múltiplas flags
     */
    setFlags(flags: Partial<HealingFeatureFlags>): void {
        for (const [key, value] of Object.entries(flags)) {
            this.flags.set(key, value);
        }
    }

    /**
     * Override temporário de flag (para testes)
     */
    setOverride<K extends keyof HealingFeatureFlags>(key: K, value: HealingFeatureFlags[K]): void {
        this.overrides.set(key, value);
    }

    /**
     * Remove override
     */
    clearOverride<K extends keyof HealingFeatureFlags>(key: K): void {
        this.overrides.delete(key);
    }

    /**
     * Remove todos os overrides
     */
    clearAllOverrides(): void {
        this.overrides.clear();
    }

    /**
     * Verifica se healing está habilitado para string replace
     */
    isStringReplaceHealingEnabled(): boolean {
        return this.getTreatmentVariable('codeEditingWithLLMStringReplaceHealing', true);
    }

    /**
     * Verifica se healing está habilitado para patches
     */
    isPatchHealingEnabled(): boolean {
        return this.getTreatmentVariable('patchApplyHealing', true);
    }

    /**
     * Verifica se fix do Gemini está habilitado
     */
    isGeminiUnescapeFixEnabled(): boolean {
        return this.getTreatmentVariable('geminiUnescapeFix', true);
    }

    /**
     * Obtém limite de tentativas para string replace
     */
    getStringReplaceMaxAttempts(): number {
        return this.getTreatmentVariable('stringReplaceHealingMaxAttempts', 3);
    }

    /**
     * Obtém timeout para healing de string replace
     */
    getStringReplaceTimeout(): number {
        return this.getTreatmentVariable('stringReplaceHealingTimeout', 10000);
    }

    /**
     * Obtém limite de tentativas para patch healing
     */
    getPatchHealingMaxAttempts(): number {
        return this.getTreatmentVariable('patchHealingMaxAttempts', 2);
    }

    /**
     * Obtém timeout para patch healing
     */
    getPatchHealingTimeout(): number {
        return this.getTreatmentVariable('patchHealingTimeout', 15000);
    }

    /**
     * Obtém limite de healing concorrente
     */
    getHealingConcurrentLimit(): number {
        return this.getTreatmentVariable('healingConcurrentLimit', 3);
    }

    /**
     * Verifica se telemetria detalhada está habilitada
     */
    isDetailedTelemetryEnabled(): boolean {
        return this.getTreatmentVariable('healingDetailedTelemetry', true);
    }

    /**
     * Verifica se métricas de performance estão habilitadas
     */
    isPerformanceMetricsEnabled(): boolean {
        return this.getTreatmentVariable('healingPerformanceMetrics', true);
    }

    /**
     * Verifica se context truncation está habilitada
     */
    isContextTruncationEnabled(): boolean {
        return this.getTreatmentVariable('healingContextTruncation', true);
    }

    /**
     * Obtém todas as flags atuais
     */
    getAllFlags(): Record<string, any> {
        const result: Record<string, any> = {};
        
        for (const [key, value] of this.flags) {
            result[key] = value;
        }
        
        // Aplica overrides
        for (const [key, value] of this.overrides) {
            result[key] = value;
        }
        
        return result;
    }

    /**
     * Carrega flags padrão
     */
    private loadDefaultFlags(): void {
        for (const [key, value] of Object.entries(DEFAULT_HEALING_FLAGS)) {
            this.flags.set(key, value);
        }
    }

    /**
     * Inicia sincronização periódica com configuração remota
     */
    private startPeriodicSync(): void {
        const syncInterval = 5 * 60 * 1000; // 5 minutos
        
        const sync = async () => {
            try {
                if (this.remoteConfigProvider) {
                    const remoteFlags = await this.remoteConfigProvider();
                    this.mergeRemoteFlags(remoteFlags);
                }
            } catch (error) {
                console.warn('Failed to sync remote feature flags:', error);
            }
            
            setTimeout(sync, syncInterval);
        };
        
        // Primeira sincronização após 30 segundos
        setTimeout(sync, 30000);
    }

    /**
     * Merge flags remotas com as locais
     */
    private mergeRemoteFlags(remoteFlags: Record<string, any>): void {
        for (const [key, value] of Object.entries(remoteFlags)) {
            if (key in DEFAULT_HEALING_FLAGS) {
                this.flags.set(key, value);
            }
        }
    }
}

/**
 * Feature Flag Manager para healing
 */
export class HealingFeatureFlagManager {
    private static instance: HealingExperimentationService;

    /**
     * Obtém instância singleton
     */
    static getInstance(): HealingExperimentationService {
        if (!this.instance) {
            this.instance = new HealingExperimentationService();
        }
        return this.instance;
    }

    /**
     * Inicializa com configuração customizada
     */
    static initialize(
        flags?: Partial<HealingFeatureFlags>,
        remoteProvider?: () => Promise<Record<string, any>>
    ): HealingExperimentationService {
        this.instance = new HealingExperimentationService(flags, remoteProvider);
        return this.instance;
    }

    /**
     * Reset da instância (para testes)
     */
    static reset(): void {
        this.instance = new HealingExperimentationService();
    }

    /**
     * Configuração para desenvolvimento
     */
    static createDevelopmentConfig(): HealingExperimentationService {
        return new HealingExperimentationService({
            codeEditingWithLLMStringReplaceHealing: true,
            patchApplyHealing: true,
            healingDetailedTelemetry: true,
            healingPerformanceMetrics: true,
            stringReplaceHealingTimeout: 30000, // Timeout maior para dev
            patchHealingTimeout: 30000
        });
    }

    /**
     * Configuração para produção
     */
    static createProductionConfig(): HealingExperimentationService {
        return new HealingExperimentationService({
            codeEditingWithLLMStringReplaceHealing: true,
            patchApplyHealing: true,
            healingDetailedTelemetry: false, // Menos telemetria em prod
            healingPerformanceMetrics: true,
            healingConcurrentLimit: 2, // Menor limite em prod
            healingContextTruncation: true // Truncation habilitada
        });
    }

    /**
     * Configuração para testes
     */
    static createTestConfig(): HealingExperimentationService {
        return new HealingExperimentationService({
            codeEditingWithLLMStringReplaceHealing: true,
            patchApplyHealing: true,
            healingDetailedTelemetry: false,
            healingPerformanceMetrics: false,
            stringReplaceHealingTimeout: 5000, // Timeout curto para testes
            patchHealingTimeout: 5000,
            healingConcurrentLimit: 1 // Sem concorrência em testes
        });
    }

    /**
     * Configuração com healing desabilitado
     */
    static createDisabledConfig(): HealingExperimentationService {
        return new HealingExperimentationService({
            codeEditingWithLLMStringReplaceHealing: false,
            patchApplyHealing: false,
            geminiUnescapeFix: false,
            claudeFormattingFix: false,
            gptContextFix: false,
            healingDetailedTelemetry: false,
            healingPerformanceMetrics: false
        });
    }
}

/**
 * Decorator para métodos que dependem de feature flags
 */
export function requiresHealingFlag(flagName: keyof HealingFeatureFlags, defaultValue: boolean = false) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const experimentationService = HealingFeatureFlagManager.getInstance();
            const isEnabled = experimentationService.getTreatmentVariable(flagName, defaultValue);

            if (!isEnabled) {
                throw new Error(`Feature ${flagName} is disabled`);
            }

            return method.apply(this, args);
        };
    };
}

/**
 * Utilitários para feature flags
 */
export class FeatureFlagUtils {
    /**
     * Verifica se healing está habilitado para um tipo específico
     */
    static isHealingEnabled(type: 'string' | 'patch'): boolean {
        const flags = HealingFeatureFlagManager.getInstance();
        
        switch (type) {
            case 'string':
                return flags.isStringReplaceHealingEnabled();
            case 'patch':
                return flags.isPatchHealingEnabled();
            default:
                return false;
        }
    }

    /**
     * Obtém configuração de timeout para tipo de healing
     */
    static getHealingTimeout(type: 'string' | 'patch'): number {
        const flags = HealingFeatureFlagManager.getInstance();
        
        switch (type) {
            case 'string':
                return flags.getStringReplaceTimeout();
            case 'patch':
                return flags.getPatchHealingTimeout();
            default:
                return 10000;
        }
    }

    /**
     * Verifica se modelo específico tem fixes habilitados
     */
    static isModelFixEnabled(modelFamily: string): boolean {
        const flags = HealingFeatureFlagManager.getInstance();
        const family = modelFamily.toLowerCase();
        
        if (family.includes('gemini')) {
            return flags.isGeminiUnescapeFixEnabled();
        }
        
        if (family.includes('claude')) {
            return flags.getTreatmentVariable('claudeFormattingFix', true);
        }
        
        if (family.includes('gpt')) {
            return flags.getTreatmentVariable('gptContextFix', true);
        }
        
        return true; // Default habilitado para modelos desconhecidos
    }

    /**
     * Cria summary das flags ativas
     */
    static createFlagsSummary(): Record<string, boolean> {
        const flags = HealingFeatureFlagManager.getInstance();
        
        return {
            stringReplaceHealing: flags.isStringReplaceHealingEnabled(),
            patchHealing: flags.isPatchHealingEnabled(),
            geminiUnescape: flags.isGeminiUnescapeFixEnabled(),
            detailedTelemetry: flags.isDetailedTelemetryEnabled(),
            performanceMetrics: flags.isPerformanceMetricsEnabled(),
            contextTruncation: flags.isContextTruncationEnabled()
        };
    }
}