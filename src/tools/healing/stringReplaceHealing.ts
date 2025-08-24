/*---------------------------------------------------------------------------------------------
 * String Replace Tool Healing - 4-Phase healing algorithm for string replacement
 *--------------------------------------------------------------------------------------------*/

import {
    NoMatchError,
    HealingResult,
    HealingTelemetry,
    StringHealingParams,
    StringHealingResult,
    HealingEndpoint,
    ExperimentationService,
    TelemetryService,
    CHAT_MODEL
} from './healingTypes';

import {
    correctOldStringMismatch,
    correctNewString,
    _unescapeStringForGeminiBug,
    count,
    matchAndCount,
    trimPairIfPossible,
    detectLineEnding,
    createHealingContext,
    createUnescapeFunction
} from './healingUtils';

/**
 * Abstract base class para tools que fazem string replacement com healing
 */
export abstract class AbstractReplaceStringTool {
    protected constructor(
        protected readonly healEndpointProvider: () => Promise<HealingEndpoint>,
        protected readonly experimentationService: ExperimentationService,
        protected readonly telemetryService: TelemetryService
    ) {}

    /**
     * Aplica edição com healing automático se necessário
     */
    protected async applyEditWithHealing(
        uri: string,
        oldString: string,
        newString: string,
        fileContent: string,
        model?: { family: string; name: string },
        token?: any
    ): Promise<string> {
        const startTime = Date.now();
        const telemetry: Partial<HealingTelemetry> = {
            model: model?.name || 'unknown',
            outcome: 'normalExecution',
            executionTime: 0,
            healingAttempts: 0
        };

        try {
            // 🎯 Primeira tentativa normal
            const result = await this.applyEdit(uri, oldString, newString, fileContent);
            
            telemetry.executionTime = Date.now() - startTime;
            this.sendTelemetry('replaceStringToolInvoked', telemetry);
            
            return result;
            
        } catch (error) {
            if (!(error instanceof NoMatchError)) {
                // ❌ Outros erros passam direto
                telemetry.applicationError = error instanceof Error ? error.message : String(error);
                telemetry.outcome = 'healingFailed';
                telemetry.executionTime = Date.now() - startTime;
                this.sendTelemetry('replaceStringToolInvoked', telemetry);
                throw error;
            }

            // ✅ APENAS NoMatchError aciona healing
            if (!this.experimentationService.getTreatmentVariable<boolean>(
                'codeEditingWithLLMStringReplaceHealing', 
                true
            )) {
                // 🛑 Feature flag desabilitada
                telemetry.healError = 'healing_disabled_by_feature_flag';
                telemetry.outcome = 'healingFailed';
                telemetry.executionTime = Date.now() - startTime;
                this.sendTelemetry('replaceStringToolInvoked', telemetry);
                throw error;
            }

            // 🩹 HEALING ACIONADO AQUI
            try {
                telemetry.healingAttempts = 1;
                const healingResult = await this.performStringHealing(
                    oldString,
                    newString,
                    fileContent,
                    model,
                    token
                );

                if (healingResult.healingApplied) {
                    // Tenta aplicar com parâmetros curados
                    const healedResult = await this.applyEdit(
                        uri,
                        healingResult.params.oldString,
                        healingResult.params.newString,
                        fileContent
                    );
                    
                    telemetry.outcome = 'healingSucceeded';
                    telemetry.executionTime = Date.now() - startTime;
                    this.sendTelemetry('replaceStringToolInvoked', telemetry);
                    
                    return healedResult;
                }

                // Healing não conseguiu resolver
                throw error;

            } catch (healingError) {
                telemetry.healError = healingError instanceof Error ? healingError.message : String(healingError);
                telemetry.outcome = 'healingFailed';
                telemetry.executionTime = Date.now() - startTime;
                this.sendTelemetry('replaceStringToolInvoked', telemetry);
                throw error; // Retorna erro original
            }
        }
    }

    /**
     * Executa o algoritmo de healing de 4 fases
     */
    private async performStringHealing(
        originalOldString: string,
        originalNewString: string,
        currentContent: string,
        model?: { family: string; name: string },
        token?: any
    ): Promise<StringHealingResult> {
        const expectedReplacements = 1; // Assumindo 1 replacement esperado
        const eol = detectLineEnding(currentContent);
        const unescapeFunction = createUnescapeFunction(model);
        
        let finalOldString = originalOldString;
        let finalNewString = originalNewString;
        let strategy: StringHealingResult['strategy'] = 'none';
        let healingApplied = false;

        // 📊 FASE 1: Tentativa de Unescape
        let occurrences = count(currentContent, finalOldString);
        
        if (occurrences === expectedReplacements) {
            // ✅ Já funciona, só precisa ajustar newString se necessário
            return {
                params: { oldString: finalOldString, newString: finalNewString },
                occurrences,
                healingApplied: false,
                strategy: 'none'
            };
        }

        // 🔧 Tenta unescape automático (especialmente para Gemini)
        const unescapedOldString = unescapeFunction(originalOldString);
        if (unescapedOldString !== originalOldString) {
            occurrences = matchAndCount(currentContent, unescapedOldString, eol);
            
            if (occurrences === expectedReplacements) {
                finalOldString = unescapedOldString;
                strategy = 'unescape';
                healingApplied = true;
                
                // Aplica unescape no newString também
                finalNewString = unescapeFunction(originalNewString);
            }
        }

        // 🧠 FASE 2: Correção de oldString com LLM
        if (occurrences === 0) {
            try {
                const healEndpoint = await this.healEndpointProvider();
                const contextualContent = createHealingContext(currentContent, unescapedOldString);
                
                const llmCorrectedOldString = await correctOldStringMismatch(
                    healEndpoint,
                    contextualContent,
                    unescapedOldString,
                    token
                );

                const llmOldOccurrences = matchAndCount(currentContent, llmCorrectedOldString, eol);

                if (llmOldOccurrences === expectedReplacements) {
                    finalOldString = llmCorrectedOldString;
                    occurrences = llmOldOccurrences;
                    strategy = 'llm_correction';
                    healingApplied = true;
                }
            } catch (llmError) {
                console.warn('LLM healing failed for oldString:', llmError);
                // Continua com healing mesmo se LLM falhar
            }
        }

        // 🔄 FASE 3: Correção de newString
        const newStringPotentiallyEscaped = originalNewString !== unescapeFunction(originalNewString);
        
        if (newStringPotentiallyEscaped && healingApplied) {
            try {
                const healEndpoint = await this.healEndpointProvider();
                
                finalNewString = await correctNewString(
                    healEndpoint,
                    originalOldString,    // Original old
                    finalOldString,      // Corrected old  
                    originalNewString,   // Original new (potentially escaped)
                    token
                );
                
                if (finalNewString !== originalNewString) {
                    strategy = 'newstring_correction';
                }
            } catch (newStringError) {
                console.warn('NewString correction failed:', newStringError);
                // Usa newString original se correção falhar
            }
        }

        // ✂️ FASE 4: Trim Optimization
        if (occurrences === expectedReplacements && finalOldString.length > 1) {
            const trimResult = trimPairIfPossible(
                finalOldString,
                finalNewString,
                currentContent,
                expectedReplacements
            );
            
            if (trimResult.targetString !== finalOldString) {
                finalOldString = trimResult.targetString;
                finalNewString = trimResult.pair;
                strategy = 'trim_optimization';
                healingApplied = true;
            }
        }

        return {
            params: {
                oldString: finalOldString,
                newString: finalNewString,
                expectedReplacements,
                model
            },
            occurrences,
            healingApplied,
            strategy
        };
    }

    /**
     * Método abstrato que subclasses devem implementar para aplicar a edição
     */
    protected abstract applyEdit(
        uri: string,
        oldString: string,
        newString: string,
        fileContent: string
    ): Promise<string>;

    /**
     * Envia telemetria
     */
    private sendTelemetry(eventName: string, telemetry: Partial<HealingTelemetry>): void {
        try {
            this.telemetryService.sendMSFTTelemetryEvent(eventName, telemetry as Record<string, any>);
        } catch (error) {
            console.warn('Failed to send healing telemetry:', error);
        }
    }
}

/**
 * Implementação concreta exemplo de EditStringTool
 */
export class EditStringTool extends AbstractReplaceStringTool {
    constructor(
        healEndpointProvider: () => Promise<HealingEndpoint>,
        experimentationService: ExperimentationService,
        telemetryService: TelemetryService
    ) {
        super(healEndpointProvider, experimentationService, telemetryService);
    }

    /**
     * Implementação da edição de string
     */
    protected async applyEdit(
        uri: string,
        oldString: string,
        newString: string,
        fileContent: string
    ): Promise<string> {
        const occurrences = count(fileContent, oldString);
        
        if (occurrences === 0) {
            throw new NoMatchError(
                `String "${oldString}" not found in file ${uri}`,
                oldString,
                fileContent
            );
        }
        
        if (occurrences > 1) {
            throw new Error(`String "${oldString}" found ${occurrences} times in file ${uri}. Expected exactly 1 occurrence.`);
        }
        
        // Aplica a substituição
        const result = fileContent.replace(oldString, newString);
        return result;
    }

    /**
     * Método público para executar edição com healing
     */
    async execute(
        uri: string,
        oldString: string,
        newString: string,
        fileContent: string,
        model?: { family: string; name: string },
        token?: any
    ): Promise<string> {
        return this.applyEditWithHealing(uri, oldString, newString, fileContent, model, token);
    }
}

/**
 * Factory para criar tools de string replacement com healing
 */
export class StringReplaceToolFactory {
    /**
     * Cria EditStringTool com healing habilitado
     */
    static createEditStringTool(
        healEndpointProvider: () => Promise<HealingEndpoint>,
        experimentationService: ExperimentationService,
        telemetryService: TelemetryService
    ): EditStringTool {
        return new EditStringTool(healEndpointProvider, experimentationService, telemetryService);
    }

    /**
     * Cria mock de healing endpoint para testes
     */
    static createMockHealEndpoint(): HealingEndpoint {
        return {
            async makeChatRequest(requestName: string, messages: any[]): Promise<any> {
                // Mock implementation para testes
                return {
                    type: 'success',
                    value: {
                        content: [{ text: '{"corrected_target_snippet": "mock corrected string"}' }]
                    }
                };
            }
        };
    }

    /**
     * Cria mock de experimentation service
     */
    static createMockExperimentationService(healingEnabled = true): ExperimentationService {
        return {
            getTreatmentVariable<T>(key: string, defaultValue: T): T {
                if (key === 'codeEditingWithLLMStringReplaceHealing') {
                    return healingEnabled as any;
                }
                return defaultValue;
            }
        };
    }

    /**
     * Cria mock de telemetry service
     */
    static createMockTelemetryService(): TelemetryService {
        return {
            sendMSFTTelemetryEvent(eventName: string, properties: Record<string, any>): void {
                console.log(`Telemetry: ${eventName}`, properties);
            }
        };
    }
}