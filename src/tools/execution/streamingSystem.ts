/*---------------------------------------------------------------------------------------------
 * Streaming System - Sistema de streaming em tempo real com pause/unpause
 *--------------------------------------------------------------------------------------------*/

import { 
    ChatResponseStream, 
    ChatResponseDelta, 
    FetchStreamSource,
    IToolCall,
    ThinkingDataItem
} from './types';
import { PauseController, DisposableBase, EventEmitter } from './pauseController';

/**
 * Implementação de ThinkingDataItem
 */
export class ThinkingDataItemImpl implements ThinkingDataItem {
    content: string;
    isEncrypted: boolean;
    timestamp: number;

    constructor(content = '', isEncrypted = false) {
        this.content = content;
        this.isEncrypted = isEncrypted;
        this.timestamp = Date.now();
    }

    static createOrUpdate(existing: ThinkingDataItem | undefined, delta: Partial<ThinkingDataItem>): ThinkingDataItem {
        if (!existing) {
            return new ThinkingDataItemImpl(delta.content || '', delta.isEncrypted || false);
        }

        // Update existing
        if (delta.content !== undefined) {
            existing.content += delta.content;
        }
        if (delta.isEncrypted !== undefined) {
            existing.isEncrypted = delta.isEncrypted;
        }

        return existing;
    }

    updateWithFetchResult(result: any): void {
        // Implementation for updating with fetch result
        this.timestamp = Date.now();
    }
}

/**
 * Buffer circular para streaming eficiente
 */
class StreamBuffer {
    private buffer: ChatResponseDelta[] = [];
    private maxSize: number;
    private head = 0;
    private tail = 0;
    private size = 0;

    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.buffer = new Array(maxSize);
    }

    push(delta: ChatResponseDelta): void {
        this.buffer[this.tail] = delta;
        this.tail = (this.tail + 1) % this.maxSize;
        
        if (this.size < this.maxSize) {
            this.size++;
        } else {
            // Buffer cheio, move head
            this.head = (this.head + 1) % this.maxSize;
        }
    }

    pop(): ChatResponseDelta | undefined {
        if (this.size === 0) {return undefined;}
        
        const item = this.buffer[this.head];
        this.head = (this.head + 1) % this.maxSize;
        this.size--;
        
        return item;
    }

    peek(): ChatResponseDelta | undefined {
        return this.size > 0 ? this.buffer[this.head] : undefined;
    }

    clear(): void {
        this.head = 0;
        this.tail = 0;
        this.size = 0;
    }

    get length(): number {
        return this.size;
    }
}

/**
 * Stream Source implementação com buffer e controle de fluxo
 */
export class FetchStreamSourceImpl extends DisposableBase implements FetchStreamSource {
    private buffer = new StreamBuffer();
    private isPaused = false;
    private isCompleted = false;
    private error: Error | null = null;
    
    private readonly onUpdateEmitter = new EventEmitter<{ text: string; delta: ChatResponseDelta }>();
    private readonly onCompleteEmitter = new EventEmitter<void>();
    private readonly onErrorEmitter = new EventEmitter<Error>();

    public readonly onUpdate = this.onUpdateEmitter;
    public readonly onComplete = this.onCompleteEmitter;
    public readonly onError = this.onErrorEmitter;

    constructor() {
        super();
        this._register(this.onUpdateEmitter);
        this._register(this.onCompleteEmitter);
        this._register(this.onErrorEmitter);
    }

    update(text: string, delta: ChatResponseDelta): void {
        if (this.isDisposed || this.isCompleted || this.error) {
            return;
        }

        // Adiciona ao buffer
        this.buffer.push(delta);

        // Se não pausado, emite imediatamente
        if (!this.isPaused) {
            this.onUpdateEmitter.fire({ text, delta });
        }
    }

    pause(): void {
        this.isPaused = true;
    }

    unpause(): void {
        if (!this.isPaused) {return;}
        
        this.isPaused = false;

        // Processa buffer acumulado
        this.flushBuffer();
    }

    complete(): void {
        if (this.isCompleted || this.isDisposed) {return;}

        this.isCompleted = true;
        
        // Flush qualquer conteúdo restante no buffer
        if (!this.isPaused) {
            this.flushBuffer();
        }
        
        this.onCompleteEmitter.fire();
    }

    error(error: Error): void {
        if (this.error || this.isDisposed) {return;}

        this.error = error;
        this.onErrorEmitter.fire(error);
    }

    private flushBuffer(): void {
        while (this.buffer.length > 0) {
            const delta = this.buffer.pop()!;
            // Reconstrói text a partir do delta para compatibilidade
            const text = delta.content || '';
            this.onUpdateEmitter.fire({ text, delta });
        }
    }

    get bufferSize(): number {
        return this.buffer.length;
    }
}

/**
 * Stream responsivo com suporte a pausa/unpause
 */
export class ResponsiveChatResponseStream extends DisposableBase implements ChatResponseStream {
    private dataCallbacks: Array<(delta: ChatResponseDelta) => void> = [];
    private endCallbacks: Array<() => void> = [];
    private errorCallbacks: Array<(error: Error) => void> = [];
    
    private isPaused = false;
    private isEnded = false;
    private error: Error | null = null;
    private buffer = new StreamBuffer();
    
    private pauseController?: PauseController;

    constructor(pauseController?: PauseController) {
        super();
        
        this.pauseController = pauseController;
        
        // Reage a mudanças de pausa do controller
        if (pauseController) {
            this._register(pauseController.onDidChangePause((isPaused) => {
                if (isPaused) {
                    this.pause();
                } else {
                    this.unpause();
                }
            }));

            this._register(pauseController.onCancellationRequested(() => {
                this.destroy();
            }));
        }
    }

    onData(callback: (delta: ChatResponseDelta) => void): void {
        this.dataCallbacks.push(callback);
    }

    onEnd(callback: () => void): void {
        if (this.isEnded) {
            setImmediate(callback);
        } else {
            this.endCallbacks.push(callback);
        }
    }

    onError(callback: (error: Error) => void): void {
        if (this.error) {
            setImmediate(() => callback(this.error!));
        } else {
            this.errorCallbacks.push(callback);
        }
    }

    pause(): void {
        this.isPaused = true;
    }

    unpause(): void {
        if (!this.isPaused) {return;}
        
        this.isPaused = false;
        
        // Flush buffer acumulado
        this.flushBuffer();
    }

    destroy(): void {
        if (this.isDisposed) {return;}

        this.dataCallbacks.length = 0;
        this.endCallbacks.length = 0;
        this.errorCallbacks.length = 0;
        this.buffer.clear();
        
        super.dispose();
    }

    /**
     * Método interno para receber dados do stream
     */
    _pushData(delta: ChatResponseDelta): void {
        if (this.isDisposed || this.isEnded || this.error) {
            return;
        }

        if (this.isPaused) {
            // Adiciona ao buffer se pausado
            this.buffer.push(delta);
        } else {
            // Emite imediatamente se não pausado
            this.emitData(delta);
        }
    }

    /**
     * Método interno para sinalizar fim do stream
     */
    _end(): void {
        if (this.isDisposed || this.isEnded) {return;}

        this.isEnded = true;
        
        // Flush buffer antes de finalizar
        if (!this.isPaused) {
            this.flushBuffer();
        }
        
        for (const callback of this.endCallbacks) {
            try {
                callback();
            } catch (error) {
                console.error('Error in end callback:', error);
            }
        }
    }

    /**
     * Método interno para sinalizar erro
     */
    _error(error: Error): void {
        if (this.isDisposed || this.error) {return;}

        this.error = error;
        
        for (const callback of this.errorCallbacks) {
            try {
                callback(error);
            } catch (callbackError) {
                console.error('Error in error callback:', callbackError);
            }
        }
    }

    private emitData(delta: ChatResponseDelta): void {
        for (const callback of this.dataCallbacks) {
            try {
                callback(delta);
            } catch (error) {
                console.error('Error in data callback:', error);
            }
        }
    }

    private flushBuffer(): void {
        while (this.buffer.length > 0) {
            const delta = this.buffer.pop()!;
            this.emitData(delta);
        }
    }
}

/**
 * Stream Processor - Processa stream e extrai tool calls em tempo real
 */
export class StreamProcessor extends DisposableBase {
    private toolCalls: IToolCall[] = [];
    private thinking: ThinkingDataItem | undefined;
    private accumulatedText = '';
    private stopEarly = false;
    
    private readonly onToolCallDetectedEmitter = new EventEmitter<IToolCall[]>();
    private readonly onThinkingUpdateEmitter = new EventEmitter<ThinkingDataItem>();
    private readonly onTextUpdateEmitter = new EventEmitter<string>();

    public readonly onToolCallDetected = this.onToolCallDetectedEmitter;
    public readonly onThinkingUpdate = this.onThinkingUpdateEmitter;
    public readonly onTextUpdate = this.onTextUpdateEmitter;

    constructor(private fetchStreamSource?: FetchStreamSourceImpl) {
        super();
        this._register(this.onToolCallDetectedEmitter);
        this._register(this.onThinkingUpdateEmitter);
        this._register(this.onTextUpdateEmitter);
    }

    /**
     * Processa delta do stream
     */
    processStreamDelta(delta: ChatResponseDelta): { shouldStop: boolean; accumulatedText: string } {
        // Atualiza texto acumulado
        if (delta.content) {
            this.accumulatedText += delta.content;
            this.onTextUpdateEmitter.fire(this.accumulatedText);
        }

        // 🛠️ Detecta tool calls no stream
        if (delta.toolCalls) {
            const newToolCalls = delta.toolCalls.map((call): IToolCall => ({
                id: this.createInternalToolCallId(call.id),
                name: call.function.name,
                arguments: call.function.arguments === '' ? '{}' : call.function.arguments,
                originalId: call.id
            }));
            
            this.toolCalls.push(...newToolCalls);
            this.onToolCallDetectedEmitter.fire([...this.toolCalls]);
        }

        // 🧠 Captura dados de "thinking" do modelo
        if (delta.thinking) {
            this.thinking = ThinkingDataItemImpl.createOrUpdate(this.thinking, delta.thinking);
            this.onThinkingUpdateEmitter.fire(this.thinking);
        }

        // Atualiza fetch stream source se disponível
        if (this.fetchStreamSource) {
            this.fetchStreamSource.update(this.accumulatedText, delta);
        }

        // ⏹️ Permite parada antecipada baseada em condições específicas
        if (this.shouldStopEarly(delta)) {
            this.stopEarly = true;
        }

        return { 
            shouldStop: this.stopEarly, 
            accumulatedText: this.accumulatedText 
        };
    }

    /**
     * Finaliza processamento
     */
    finishProcessing(): {
        toolCalls: IToolCall[];
        thinking: ThinkingDataItem | undefined;
        accumulatedText: string;
    } {
        if (this.fetchStreamSource) {
            this.fetchStreamSource.complete();
        }

        return {
            toolCalls: [...this.toolCalls],
            thinking: this.thinking,
            accumulatedText: this.accumulatedText
        };
    }

    /**
     * Reporta erro
     */
    reportError(error: Error): void {
        if (this.fetchStreamSource) {
            this.fetchStreamSource.error(error);
        }
    }

    private createInternalToolCallId(toolCallId: string): string {
        // Adiciona sufixo único para evitar colisões (como mencionado na análise)
        return toolCallId + `__vscode-${StreamProcessor.NextToolCallId++}`;
    }

    private shouldStopEarly(delta: ChatResponseDelta): boolean {
        // Implementa lógica para parada antecipada
        // Por exemplo, pode parar se detectar padrões específicos
        return delta.finishReason === 'stop' || delta.finishReason === 'tool_calls';
    }

    // ID counter para tool calls únicos
    private static NextToolCallId = 1;
}

/**
 * Stream Factory - Cria streams configurados para diferentes cenários
 */
export class StreamFactory {
    /**
     * Cria stream para execução de tool calling loop
     */
    static createToolCallingStream(pauseController?: PauseController): {
        stream: ResponsiveChatResponseStream;
        processor: StreamProcessor;
        source: FetchStreamSourceImpl;
    } {
        const source = new FetchStreamSourceImpl();
        const stream = new ResponsiveChatResponseStream(pauseController);
        const processor = new StreamProcessor(source);

        // Conecta stream com processor
        stream.onData((delta) => {
            processor.processStreamDelta(delta);
        });

        stream.onEnd(() => {
            processor.finishProcessing();
        });

        stream.onError((error) => {
            processor.reportError(error);
        });

        // Conecta source com stream através do pause controller
        if (pauseController) {
            source.onUpdate(({ text, delta }) => {
                stream._pushData(delta);
            });

            source.onComplete(() => {
                stream._end();
            });

            source.onError((error) => {
                stream._error(error);
            });

            // Conecta pause/unpause
            pauseController.onDidChangePause((isPaused) => {
                if (isPaused) {
                    source.pause();
                } else {
                    source.unpause();
                }
            });
        }

        return { stream, processor, source };
    }

    /**
     * Cria stream simples para casos básicos
     */
    static createSimpleStream(): ResponsiveChatResponseStream {
        return new ResponsiveChatResponseStream();
    }

    /**
     * Cria stream com buffer personalizado
     */
    static createBufferedStream(
        bufferSize: number,
        pauseController?: PauseController
    ): ResponsiveChatResponseStream {
        // Pode customizar tamanho do buffer aqui
        return new ResponsiveChatResponseStream(pauseController);
    }
}

/**
 * Stream Utils - Utilitários para trabalhar com streams
 */
export class StreamUtils {
    /**
     * Converte stream em array de deltas
     */
    static async streamToArray(stream: ChatResponseStream): Promise<ChatResponseDelta[]> {
        const deltas: ChatResponseDelta[] = [];
        
        return new Promise((resolve, reject) => {
            stream.onData((delta) => {
                deltas.push(delta);
            });

            stream.onEnd(() => {
                resolve(deltas);
            });

            stream.onError((error) => {
                reject(error);
            });
        });
    }

    /**
     * Mescla múltiplos streams em um
     */
    static mergeStreams(...streams: ChatResponseStream[]): ResponsiveChatResponseStream {
        const mergedStream = new ResponsiveChatResponseStream();
        let completedCount = 0;
        let hasError = false;

        for (const stream of streams) {
            stream.onData((delta) => {
                if (!hasError) {
                    mergedStream._pushData(delta);
                }
            });

            stream.onEnd(() => {
                completedCount++;
                if (completedCount === streams.length) {
                    mergedStream._end();
                }
            });

            stream.onError((error) => {
                if (!hasError) {
                    hasError = true;
                    mergedStream._error(error);
                }
            });
        }

        return mergedStream;
    }

    /**
     * Aplica transformação aos dados do stream
     */
    static transformStream(
        source: ChatResponseStream,
        transformer: (delta: ChatResponseDelta) => ChatResponseDelta | null
    ): ResponsiveChatResponseStream {
        const transformed = new ResponsiveChatResponseStream();

        source.onData((delta) => {
            const transformedDelta = transformer(delta);
            if (transformedDelta) {
                transformed._pushData(transformedDelta);
            }
        });

        source.onEnd(() => {
            transformed._end();
        });

        source.onError((error) => {
            transformed._error(error);
        });

        return transformed;
    }
}

export { StreamBuffer };