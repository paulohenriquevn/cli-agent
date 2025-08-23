/*---------------------------------------------------------------------------------------------
 * Pause Controller - Cancelamento e pausa sofisticados
 *--------------------------------------------------------------------------------------------*/

import { 
    CliCancellationToken,
    DeferredPromise, 
    Event, 
    Disposable,
    CancellationError
} from './types';

/**
 * Implementação de DeferredPromise
 */
export class DeferredPromiseImpl<T> implements DeferredPromise<T> {
    private _resolve!: (value: T | PromiseLike<T>) => void;
    private _reject!: (reason: any) => void;
    private _isSettled = false;
    
    public readonly p: Promise<T>;

    constructor() {
        this.p = new Promise<T>((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        this.p.then(
            () => { this._isSettled = true; },
            () => { this._isSettled = true; }
        );
    }

    get isSettled(): boolean {
        return this._isSettled;
    }

    complete(value?: T): void {
        if (!this._isSettled) {
            this._resolve(value as T);
        }
    }

    error(error: Error): void {
        if (!this._isSettled) {
            this._reject(error);
        }
    }
}

/**
 * Implementação de Event Emitter simples
 */
export class EventEmitter<T> implements Event<T> {
    private listeners: Array<(e: T) => void> = [];

    constructor() {
        return this.addListener.bind(this);
    }

    private addListener(listener: (e: T) => void): { dispose(): void } {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const index = this.listeners.indexOf(listener);
                if (index >= 0) {
                    this.listeners.splice(index, 1);
                }
            }
        };
    }

    fire(event: T): void {
        // Criar cópia para evitar problemas se listeners modificarem array
        const currentListeners = [...this.listeners];
        for (const listener of currentListeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in event listener:', error);
            }
        }
    }

    dispose(): void {
        this.listeners.length = 0;
    }
}

/**
 * Classe base para recursos descartáveis
 */
export class DisposableBase implements Disposable {
    private _disposables: Disposable[] = [];
    private _isDisposed = false;

    protected _register<T extends Disposable>(disposable: T): T {
        if (this._isDisposed) {
            disposable.dispose();
        } else {
            this._disposables.push(disposable);
        }
        return disposable;
    }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            for (const disposable of this._disposables) {
                try {
                    disposable.dispose();
                } catch (error) {
                    console.error('Error disposing resource:', error);
                }
            }
            this._disposables.length = 0;
        }
    }

    get isDisposed(): boolean {
        return this._isDisposed;
    }
}

/**
 * PauseController - Controlador sofisticado de pausa e cancelamento
 * 
 * Permite pausar/despausar operações de forma granular e implementa
 * cancelamento gracioso com cleanup automático de recursos.
 */
export class PauseController extends DisposableBase implements CliCancellationToken {
    private _isCancelled = false;
    private _pausePromise = new DeferredPromiseImpl<void>();
    private readonly _onCancellationRequestedEmitter = new EventEmitter<void>();
    private readonly _onDidChangePauseEmitter = new EventEmitter<boolean>();
    
    public readonly onCancellationRequested = this._onCancellationRequestedEmitter;
    public readonly onDidChangePause = this._onDidChangePauseEmitter;

    constructor(
        onDidChangePause?: Event<boolean>, 
        parentToken?: CliCancellationToken
    ) {
        super();

        // 🎛️ Reage a mudanças de estado de pausa externos
        if (onDidChangePause) {
            this._register(onDidChangePause(isPaused => {
                this.setPaused(isPaused);
            }));
        }

        // 🔗 Propaga cancelamento do token pai
        if (parentToken) {
            this._register(parentToken.onCancellationRequested(() => {
                this.cancel();
            }));
        }

        // Completa o promise inicial (não pausado por padrão)
        this._pausePromise.complete();
    }

    /**
     * Indica se a operação foi cancelada
     */
    get isCancellationRequested(): boolean {
        return this._isCancelled;
    }

    /**
     * Indica se a operação está pausada
     */
    get isPaused(): boolean {
        return !this._pausePromise.isSettled;
    }

    /**
     * Cancela a operação
     */
    cancel(): void {
        if (!this._isCancelled && !this.isDisposed) {
            this._isCancelled = true;
            this._onCancellationRequestedEmitter.fire();
            
            // Se estava pausado, resolve o promise para permitir cleanup
            if (this.isPaused) {
                this._pausePromise.error(new CancellationError());
            }
        }
    }

    /**
     * Registra callback para cancelamento
     */
    onCancellationRequested(callback: () => void): void {
        if (this._isCancelled) {
            // Se já cancelado, executa callback imediatamente
            setImmediate(callback);
        } else {
            this._register(this._onCancellationRequestedEmitter(callback));
        }
    }

    /**
     * Define estado de pausa
     */
    private setPaused(isPaused: boolean): void {
        if (this.isDisposed || this._isCancelled) {
            return;
        }

        const wasChanged = (isPaused !== this.isPaused);

        if (isPaused && this._pausePromise.isSettled) {
            // Pausar: cria nova promise não resolvida
            this._pausePromise = new DeferredPromiseImpl<void>();
        } else if (!isPaused && !this._pausePromise.isSettled) {
            // Despausar: resolve promise existente
            this._pausePromise.complete();
        }

        if (wasChanged) {
            this._onDidChangePauseEmitter.fire(isPaused);
        }
    }

    /**
     * Pausa a operação
     */
    pause(): void {
        this.setPaused(true);
    }

    /**
     * Despausa a operação
     */
    unpause(): void {
        this.setPaused(false);
    }

    /**
     * Aguarda até ser despausado
     * 
     * @returns Promise que resolve quando não estiver mais pausado
     * @throws CancellationError se cancelado enquanto pausado
     */
    async waitForUnpause(): Promise<void> {
        if (this._isCancelled) {
            throw new CancellationError();
        }

        if (!this.isPaused) {
            return; // Já não está pausado
        }

        return this._pausePromise.p;
    }

    /**
     * Verifica cancelamento e pausa de forma assíncrona
     * 
     * @returns true se deve parar (cancelado), false caso contrário
     */
    async checkAsync(): Promise<boolean> {
        if (this._isCancelled) {
            return true;
        }

        if (this.isPaused) {
            try {
                await this.waitForUnpause();
                // Verifica novamente após despausar
                return this._isCancelled;
            } catch (error) {
                if (isCancellationError(error)) {
                    return true;
                }
                throw error;
            }
        }

        return false;
    }

    /**
     * Lança erro se cancelado
     */
    throwIfCancelled(): void {
        if (this._isCancelled) {
            throw new CancellationError();
        }
    }

    /**
     * Lança erro se cancelado (versão assíncrona)
     */
    async throwIfCancelledAsync(): Promise<void> {
        if (await this.checkAsync()) {
            throw new CancellationError();
        }
    }

    /**
     * Executa operação com suporte a pausa/cancelamento
     */
    async executeWithPauseSupport<T>(
        operation: () => Promise<T>,
        onPause?: () => void,
        onUnpause?: () => void
    ): Promise<T> {
        
        // Setup de listeners para pausa
        const pauseDisposable = onPause || onUnpause ? 
            this._register(this.onDidChangePause((isPaused) => {
                if (isPaused && onPause) {
                    onPause();
                } else if (!isPaused && onUnpause) {
                    onUnpause();
                }
            })) : null;

        try {
            // Verifica estado inicial
            await this.throwIfCancelledAsync();

            // Executa operação
            return await operation();

        } finally {
            pauseDisposable?.dispose();
        }
    }

    /**
     * Cria um timeout que respeita cancelamento e pausa
     */
    createTimeout(ms: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let timeoutId: NodeJS.Timeout | null = null;
            let startTime = Date.now();
            let remainingTime = ms;

            const startTimeout = () => {
                timeoutId = setTimeout(() => {
                    resolve();
                }, remainingTime);
            };

            const pauseTimeout = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                    // Atualiza tempo restante
                    remainingTime = Math.max(0, remainingTime - (Date.now() - startTime));
                }
            };

            const resumeTimeout = () => {
                if (remainingTime > 0) {
                    startTime = Date.now();
                    startTimeout();
                }
            };

            // Registra listeners
            const cancellationDisposable = this.onCancellationRequested(() => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                reject(new CancellationError());
            });

            const pauseDisposable = this.onDidChangePause((isPaused) => {
                if (isPaused) {
                    pauseTimeout();
                } else {
                    resumeTimeout();
                }
            });

            // Inicia timeout se não estiver pausado
            if (!this.isPaused && !this._isCancelled) {
                startTimeout();
            } else if (this._isCancelled) {
                reject(new CancellationError());
                return;
            }

            // Cleanup quando promise resolver/rejeitar
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                cancellationDisposable.dispose();
                pauseDisposable.dispose();
            };

            resolve = ((originalResolve) => (...args) => {
                cleanup();
                return originalResolve(...args);
            })(resolve);

            reject = ((originalReject) => (...args) => {
                cleanup();
                return originalReject(...args);
            })(reject);
        });
    }

    /**
     * Combina múltiplos tokens em um só
     */
    static combine(...tokens: (CliCancellationToken | PauseController)[]): PauseController {
        const combined = new PauseController();
        
        for (const token of tokens) {
            if (token.isCancellationRequested) {
                combined.cancel();
                break;
            }
            
            combined._register(token.onCancellationRequested(() => {
                combined.cancel();
            }));

            if (token instanceof PauseController) {
                combined._register(token.onDidChangePause((isPaused) => {
                    combined.setPaused(isPaused);
                }));
            }
        }
        
        return combined;
    }
}

/**
 * Utilitários para verificação de cancelamento
 */
export class CancellationUtils {
    /**
     * Aguarda até que uma condição seja atendida ou operação seja cancelada
     */
    static async waitUntil(
        condition: () => boolean | Promise<boolean>,
        token: CliCancellationToken | PauseController,
        checkInterval = 100
    ): Promise<void> {
        while (true) {
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }

            const result = await condition();
            if (result) {
                return;
            }

            if (token instanceof PauseController) {
                await token.createTimeout(checkInterval);
            } else {
                await new Promise(resolve => {
                    const timer = setTimeout(resolve, checkInterval);
                    token.onCancellationRequested(() => {
                        clearTimeout(timer);
                    });
                });
            }
        }
    }

    /**
     * Executa operação com timeout respeitando cancelamento
     */
    static async withTimeout<T>(
        operation: () => Promise<T>,
        timeoutMs: number,
        token: CliCancellationToken | PauseController
    ): Promise<T> {
        const timeoutPromise = token instanceof PauseController 
            ? token.createTimeout(timeoutMs)
            : new Promise<never>((_, reject) => {
                const timer = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
                token.onCancellationRequested(() => clearTimeout(timer));
            });

        return Promise.race([
            operation(),
            timeoutPromise.then(() => {
                throw new Error(`Operation timed out after ${timeoutMs}ms`);
            })
        ]);
    }
}

function isCancellationError(error: any): boolean {
    return error instanceof CancellationError || error?.name === 'CancellationError';
}