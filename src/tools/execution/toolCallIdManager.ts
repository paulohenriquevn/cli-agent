/*---------------------------------------------------------------------------------------------
 * Tool Call ID Management System - Prevents conflicts and ensures uniqueness
 *--------------------------------------------------------------------------------------------*/

import { IToolCall } from './types';
import { DisposableBase } from './pauseController';

/**
 * Informações de contexto para geração de IDs
 */
export interface ToolCallIdContext {
    sessionId?: string;
    roundNumber?: number;
    executionId?: string;
    parentCallId?: string; // For nested calls
    timestamp?: number;
}

/**
 * Estratégias de geração de ID
 */
export enum IdGenerationStrategy {
    Sequential = 'sequential',
    UUID = 'uuid',
    Timestamp = 'timestamp',
    Hierarchical = 'hierarchical' // For nested calls
}

/**
 * Configuração do gerenciador de IDs
 */
export interface ToolCallIdManagerConfig {
    strategy: IdGenerationStrategy;
    prefix?: string;
    separator?: string;
    includeTimestamp?: boolean;
    includeSessionId?: boolean;
    maxHistorySize?: number;
}

/**
 * Registro de tool call com metadados
 */
export interface ToolCallRecord {
    id: string;
    originalId?: string;
    name: string;
    arguments: string;
    context: ToolCallIdContext;
    createdAt: number;
    parentId?: string;
    children: string[];
    status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
}

/**
 * Gerenciador de IDs de tool calls para prevenir conflitos e garantir unicidade
 */
export class ToolCallIdManager extends DisposableBase {
    private readonly config: Required<ToolCallIdManagerConfig>;
    private readonly registry = new Map<string, ToolCallRecord>();
    private readonly originalIdMap = new Map<string, string>();
    private sequentialCounter = 0;
    private readonly sessionId: string;

    constructor(config?: Partial<ToolCallIdManagerConfig>) {
        super();
        
        this.config = {
            strategy: IdGenerationStrategy.Sequential,
            prefix: 'tc',
            separator: '_',
            includeTimestamp: false,
            includeSessionId: false,
            maxHistorySize: 10000,
            ...config
        };
        
        this.sessionId = this.generateSessionId();
    }

    /**
     * Cria ID único para tool call
     */
    createId(
        toolCall: Omit<IToolCall, 'id'>,
        context: ToolCallIdContext = {}
    ): string {
        const enhancedContext: ToolCallIdContext = {
            timestamp: Date.now(),
            sessionId: this.sessionId,
            ...context
        };

        const id = this.generateId(toolCall.name, enhancedContext);
        
        // Registra o tool call
        const record: ToolCallRecord = {
            id,
            originalId: toolCall.originalId,
            name: toolCall.name,
            arguments: toolCall.arguments,
            context: enhancedContext,
            createdAt: enhancedContext.timestamp ?? Date.now(),
            parentId: context.parentCallId,
            children: [],
            status: 'pending'
        };

        this.registry.set(id, record);
        
        // Mapeia ID original para o novo ID
        if (toolCall.originalId) {
            this.originalIdMap.set(toolCall.originalId, id);
        }

        // Adiciona como filho do pai, se existir
        if (context.parentCallId) {
            const parent = this.registry.get(context.parentCallId);
            if (parent) {
                parent.children.push(id);
            }
        }

        // Limita tamanho do histórico
        this.cleanupOldRecords();

        return id;
    }

    /**
     * Converte tool call com ID original para tool call com ID único
     */
    processToolCall(toolCall: IToolCall, context?: ToolCallIdContext): IToolCall {
        const newId = this.createId({
            name: toolCall.name,
            arguments: toolCall.arguments,
            originalId: toolCall.id
        }, context);

        return {
            ...toolCall,
            id: newId,
            originalId: toolCall.id
        };
    }

    /**
     * Processa array de tool calls
     */
    processToolCalls(toolCalls: IToolCall[], context?: ToolCallIdContext): IToolCall[] {
        return toolCalls.map(toolCall => this.processToolCall(toolCall, context));
    }

    /**
     * Atualiza status de um tool call
     */
    updateStatus(id: string, status: ToolCallRecord['status']): void {
        const record = this.registry.get(id);
        if (record) {
            record.status = status;
        }
    }

    /**
     * Cria contexto para call aninhado
     */
    createNestedContext(parentId: string, roundNumber?: number): ToolCallIdContext {
        const parent = this.registry.get(parentId);
        if (!parent) {
            throw new Error(`Parent tool call ${parentId} not found`);
        }

        return {
            parentCallId: parentId,
            sessionId: this.sessionId,
            roundNumber,
            executionId: parent.context.executionId,
            timestamp: Date.now()
        };
    }

    /**
     * Obtém informações de um tool call
     */
    getRecord(id: string): ToolCallRecord | undefined {
        return this.registry.get(id);
    }

    /**
     * Obtém tool call pelo ID original
     */
    getByOriginalId(originalId: string): ToolCallRecord | undefined {
        const id = this.originalIdMap.get(originalId);
        return id ? this.registry.get(id) : undefined;
    }

    /**
     * Obtém filhos de um tool call
     */
    getChildren(parentId: string): ToolCallRecord[] {
        const parent = this.registry.get(parentId);
        if (!parent) {return [];}

        return parent.children
            .map(childId => this.registry.get(childId))
            .filter((record): record is ToolCallRecord => record !== undefined);
    }

    /**
     * Obtém hierarquia completa de um tool call
     */
    getHierarchy(id: string): {
        record: ToolCallRecord;
        children: ToolCallRecord[];
        descendants: ToolCallRecord[];
    } | undefined {
        const record = this.registry.get(id);
        if (!record) {return undefined;}

        const children = this.getChildren(id);
        const descendants: ToolCallRecord[] = [];

        // Busca recursiva de todos os descendentes
        const collectDescendants = (parentId: string) => {
            const children = this.getChildren(parentId);
            descendants.push(...children);
            children.forEach(child => collectDescendants(child.id));
        };
        
        collectDescendants(id);

        return { record, children, descendants };
    }

    /**
     * Lista todos os tool calls por status
     */
    listByStatus(status: ToolCallRecord['status']): ToolCallRecord[] {
        return Array.from(this.registry.values()).filter(record => record.status === status);
    }

    /**
     * Obtém estatísticas do registry
     */
    getStats(): {
        total: number;
        byStatus: Record<string, number>;
        byName: Record<string, number>;
        nestedCalls: number;
        averageChildrenPerParent: number;
    } {
        const records = Array.from(this.registry.values());
        
        const byStatus: Record<string, number> = {};
        const byName: Record<string, number> = {};
        let nestedCalls = 0;
        let parentsWithChildren = 0;
        let totalChildren = 0;

        for (const record of records) {
            byStatus[record.status] = (byStatus[record.status] || 0) + 1;
            byName[record.name] = (byName[record.name] || 0) + 1;
            
            if (record.parentId) {
                nestedCalls++;
            }
            
            if (record.children.length > 0) {
                parentsWithChildren++;
                totalChildren += record.children.length;
            }
        }

        return {
            total: records.length,
            byStatus,
            byName,
            nestedCalls,
            averageChildrenPerParent: parentsWithChildren > 0 ? totalChildren / parentsWithChildren : 0
        };
    }

    /**
     * Limpa registry mantendo apenas registros recentes
     */
    private cleanupOldRecords(): void {
        if (this.registry.size <= this.config.maxHistorySize) {return;}

        // Ordena por timestamp e remove os mais antigos
        const sortedRecords = Array.from(this.registry.entries())
            .sort(([, a], [, b]) => b.createdAt - a.createdAt);

        // const _toKeep = sortedRecords.slice(0, this.config.maxHistorySize); // Unused variable - cleanup logic can be added here"
        const toRemove = sortedRecords.slice(this.config.maxHistorySize);

        // Remove registros antigos
        for (const [id, record] of toRemove) {
            this.registry.delete(id);
            if (record.originalId) {
                this.originalIdMap.delete(record.originalId);
            }
        }
    }

    /**
     * Gera ID baseado na estratégia configurada
     */
    private generateId(toolName: string, context: ToolCallIdContext): string {
        const parts: string[] = [];

        if (this.config.prefix) {
            parts.push(this.config.prefix);
        }

        switch (this.config.strategy) {
            case IdGenerationStrategy.Sequential:
                parts.push(String(++this.sequentialCounter));
                break;

            case IdGenerationStrategy.UUID:
                parts.push(this.generateUUID());
                break;

            case IdGenerationStrategy.Timestamp:
                parts.push(String(context.timestamp || Date.now()));
                break;

            case IdGenerationStrategy.Hierarchical:
                if (context.parentCallId) {
                    const parent = this.registry.get(context.parentCallId);
                    if (parent) {
                        const depth = this.calculateDepth(context.parentCallId);
                        parts.push(`${depth}.${parent.children.length + 1}`);
                    }
                } else {
                    parts.push(`0.${++this.sequentialCounter}`);
                }
                break;
        }

        if (this.config.includeSessionId && context.sessionId) {
            parts.push(context.sessionId.slice(-8)); // Only last 8 chars
        }

        if (this.config.includeTimestamp && context.timestamp) {
            parts.push(String(context.timestamp));
        }

        parts.push(toolName.toLowerCase());

        if (context.roundNumber) {
            parts.push(`r${context.roundNumber}`);
        }

        return parts.join(this.config.separator);
    }

    /**
     * Calcula profundidade na hierarquia
     */
    private calculateDepth(id: string): number {
        let depth = 0;
        let current = this.registry.get(id);
        
        while (current?.parentId) {
            depth++;
            current = this.registry.get(current.parentId);
        }
        
        return depth;
    }

    /**
     * Gera UUID simples
     */
    private generateUUID(): string {
        return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Gera ID de sessão único
     */
    private generateSessionId(): string {
        return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    }

    /**
     * Limpa todo o registry
     */
    clear(): void {
        this.registry.clear();
        this.originalIdMap.clear();
        this.sequentialCounter = 0;
    }

    dispose(): void {
        this.clear();
        super.dispose();
    }
}

/**
 * Factory para diferentes configurações de gerenciadores
 */
export class ToolCallIdManagerFactory {
    /**
     * Cria gerenciador com IDs sequenciais simples
     */
    static createSequential(prefix = 'tc'): ToolCallIdManager {
        return new ToolCallIdManager({
            strategy: IdGenerationStrategy.Sequential,
            prefix
        });
    }

    /**
     * Cria gerenciador com UUIDs
     */
    static createUUID(prefix = 'tc'): ToolCallIdManager {
        return new ToolCallIdManager({
            strategy: IdGenerationStrategy.UUID,
            prefix,
            includeTimestamp: false
        });
    }

    /**
     * Cria gerenciador hierárquico para nested calls
     */
    static createHierarchical(prefix = 'tc'): ToolCallIdManager {
        return new ToolCallIdManager({
            strategy: IdGenerationStrategy.Hierarchical,
            prefix,
            includeSessionId: true
        });
    }

    /**
     * Cria gerenciador com timestamp para debugging
     */
    static createWithTimestamp(prefix = 'tc'): ToolCallIdManager {
        return new ToolCallIdManager({
            strategy: IdGenerationStrategy.Timestamp,
            prefix,
            includeTimestamp: true,
            includeSessionId: true
        });
    }

    /**
     * Cria gerenciador configurado para produção
     */
    static createForProduction(): ToolCallIdManager {
        return new ToolCallIdManager({
            strategy: IdGenerationStrategy.UUID,
            prefix: 'tc',
            includeSessionId: false,
            includeTimestamp: false,
            maxHistorySize: 5000
        });
    }
}

/**
 * Utilitários para trabalhar com tool call IDs
 */
export class ToolCallIdUtils {
    /**
     * Extrai informações de um ID gerado
     */
    static parseId(id: string, separator = '_'): {
        prefix?: string;
        counter?: number;
        uuid?: string;
        timestamp?: number;
        sessionId?: string;
        toolName?: string;
        roundNumber?: number;
    } {
        const parts = id.split(separator);
        const result: Record<string, string | number | boolean | undefined> = {};

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // Detecta diferentes componentes
            if (i === 0 && isNaN(Number(part))) {
                result.prefix = part;
            } else if (/^\d+$/.test(part)) {
                if (part.length > 10) {
                    result.timestamp = Number(part);
                } else {
                    result.counter = Number(part);
                }
            } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part)) {
                result.uuid = part;
            } else if (/^s[0-9a-z]+$/.test(part)) {
                result.sessionId = part;
            } else if (/^r\d+$/.test(part)) {
                result.roundNumber = Number(part.slice(1));
            } else {
                result.toolName = part;
            }
        }

        return result;
    }

    /**
     * Valida formato de ID
     */
    static validateId(id: string, expectedPrefix?: string): boolean {
        if (!id || typeof id !== 'string') {return false;}
        
        const parsed = this.parseId(id);
        
        if (expectedPrefix && parsed.prefix !== expectedPrefix) {
            return false;
        }
        
        return true;
    }

    /**
     * Compara dois IDs
     */
    static compareIds(id1: string, id2: string): number {
        const parsed1 = this.parseId(id1);
        const parsed2 = this.parseId(id2);
        
        // Compara por timestamp se disponível
        if (parsed1.timestamp && parsed2.timestamp) {
            return parsed1.timestamp - parsed2.timestamp;
        }
        
        // Compara por counter se disponível
        if (parsed1.counter !== undefined && parsed2.counter !== undefined) {
            return parsed1.counter - parsed2.counter;
        }
        
        // Comparação lexicográfica como fallback
        return id1.localeCompare(id2);
    }
}