/*---------------------------------------------------------------------------------------------
 * Memory Types - Types for memory persistence functionality
 *--------------------------------------------------------------------------------------------*/

export interface SaveMemoryParams {
    fact: string;
    category?: string;
    priority?: 'low' | 'medium' | 'high';
    project?: string;
    tags?: string[];
    [key: string]: unknown;
}

export interface SaveMemoryResult {
    success: boolean;
    filePath: string;
    message: string;
    factId: string;
    timestamp: Date;
}

export interface SavedMemoryFact {
    id: string;
    content: string;
    timestamp: Date;
    category?: string;
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
    project?: string;
}

export interface MemoryConfig {
    debugMode: boolean;
    customAgentFileName?: string;
    maxFactLength?: number;
}

export class MemoryError extends Error {
    constructor(
        public code: string,
        message: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'MemoryError';
    }
}