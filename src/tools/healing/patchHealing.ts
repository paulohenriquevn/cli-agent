/*---------------------------------------------------------------------------------------------
 * Patch Apply Tool Healing - Heals patches that fail to apply cleanly
 *--------------------------------------------------------------------------------------------*/

import {
    HealedError,
    HealingEndpoint,
    HealingResult,
    TelemetryService,
    CHAT_MODEL,
    ChatFetchResponseType
} from './healingTypes';

import {
    healPatch,
    extractPatchFromResponse
} from './healingUtils';

/**
 * Representa um commit/patch que será aplicado
 */
export interface Commit {
    patch: string;
    message?: string;
    files: string[];
    additions: number;
    deletions: number;
}

/**
 * Informações de documento para aplicação de patch
 */
export interface DocText {
    uri: string;
    content: string;
    language?: string;
    version?: number;
}

/**
 * Resultado de build de commit
 */
interface CommitBuildResult {
    commit: Commit;
    healed?: string;
}

/**
 * Tool para aplicar patches com healing automático
 */
export class ApplyPatchTool {
    constructor(
        private readonly healEndpointProvider: () => Promise<HealingEndpoint>,
        private readonly telemetryService: TelemetryService
    ) {}

    /**
     * Aplica patch com healing se necessário
     */
    async applyPatch(
        patch: string,
        docText: DocText,
        explanation: string = '',
        token?: any
    ): Promise<{ commit: Commit; wasHealed: boolean; healedPatch?: string }> {
        const startTime = Date.now();
        const telemetryData: Record<string, any> = {
            model: CHAT_MODEL.GPT4OMINI,
            healed: 0,
            success: 0,
            file: this.sanitizeFilePath(docText.uri),
            executionTime: 0
        };

        try {
            // 🎯 Primeira tentativa normal
            const result = await this.buildCommitWithHealing(patch, docText, explanation, token);
            
            telemetryData.success = 1;
            telemetryData.healed = result.healed ? 1 : 0;
            telemetryData.executionTime = Date.now() - startTime;
            
            this.sendTelemetry('applyPatchTool', telemetryData);

            return {
                commit: result.commit,
                wasHealed: !!result.healed,
                healedPatch: result.healed
            };

        } catch (error) {
            telemetryData.success = 0;
            telemetryData.executionTime = Date.now() - startTime;
            telemetryData.error = error instanceof Error ? error.message : String(error);
            
            this.sendTelemetry('applyPatchTool', telemetryData);
            throw error;
        }
    }

    /**
     * Constrói commit com healing automático
     */
    private async buildCommitWithHealing(
        patch: string,
        docText: DocText,
        explanation: string,
        token?: any
    ): Promise<CommitBuildResult> {
        try {
            // 🎯 Primeira tentativa normal
            const commit = await this.buildCommit(patch, docText);
            return { commit };
            
        } catch (error) {
            // 🩹 HEALING para patches
            let healedPatch: string | undefined;
            
            try {
                healedPatch = await this.healCommit(patch, docText, explanation, token);

                if (!healedPatch) {
                    throw error; // Healing falhou, retorna erro original
                }

                const commit = await this.buildCommit(healedPatch, docText);
                return { commit, healed: healedPatch };
                
            } catch (healedError) {
                // 📊 Wrapper error com dados de healing
                if (healedPatch) {
                    throw new HealedError(error, healedError, healedPatch);
                }
                throw error; // Retorna erro original se healing falhou
            }
        }
    }

    /**
     * Cura commit usando LLM
     */
    private async healCommit(
        patch: string,
        docText: DocText,
        explanation: string,
        token?: any
    ): Promise<string | undefined> {
        try {
            const healEndpoint = await this.healEndpointProvider();
            
            const contextualExplanation = this.buildHealingContext(patch, docText, explanation);
            const healedPatch = await healPatch(healEndpoint, patch, contextualExplanation, token);
            
            if (healedPatch && healedPatch.trim() && healedPatch !== patch) {
                return healedPatch;
            }
            
            return undefined; // Healing não produziu resultado útil
            
        } catch (error) {
            console.warn('Patch healing failed:', error);
            return undefined;
        }
    }

    /**
     * Constrói contexto detalhado para healing
     */
    private buildHealingContext(patch: string, docText: DocText, explanation: string): string {
        const contextParts = [explanation];
        
        // Adiciona informações do arquivo
        if (docText.language) {
            contextParts.push(`File type: ${docText.language}`);
        }
        
        // Adiciona preview do conteúdo do arquivo (truncado)
        const contentPreview = this.createContentPreview(docText.content);
        if (contentPreview) {
            contextParts.push(`File content preview:\n\`\`\`\n${contentPreview}\n\`\`\``);
        }
        
        // Analisa tipo de erro comum em patches
        const patchAnalysis = this.analyzePatchIssues(patch);
        if (patchAnalysis.length > 0) {
            contextParts.push(`Potential issues: ${patchAnalysis.join(', ')}`);
        }
        
        return contextParts.join('\n\n');
    }

    /**
     * Cria preview do conteúdo limitado para contexto
     */
    private createContentPreview(content: string, maxLines = 50): string {
        const lines = content.split('\n');
        
        if (lines.length <= maxLines) {
            return content;
        }
        
        const halfLines = Math.floor(maxLines / 2);
        const preview = [
            ...lines.slice(0, halfLines),
            `... [${lines.length - maxLines} lines omitted] ...`,
            ...lines.slice(-halfLines)
        ];
        
        return preview.join('\n');
    }

    /**
     * Analisa problemas comuns em patches
     */
    private analyzePatchIssues(patch: string): string[] {
        const issues: string[] = [];
        
        // Verifica formato do patch
        if (!patch.includes('@@') && !patch.includes('---') && !patch.includes('+++')) {
            issues.push('patch may not be in proper unified diff format');
        }
        
        // Verifica line endings inconsistentes
        if (patch.includes('\r\n') && patch.includes('\n') && !patch.includes('\r\n')) {
            issues.push('mixed line endings detected');
        }
        
        // Verifica contexto insuficiente
        const contextLines = (patch.match(/^ /gm) || []).length;
        const changeLines = (patch.match(/^[+-]/gm) || []).length;
        
        if (changeLines > 0 && contextLines < 3) {
            issues.push('insufficient context lines for reliable patch application');
        }
        
        // Verifica whitespace issues
        if (patch.includes('\t') && patch.includes('    ')) {
            issues.push('mixed tabs and spaces detected');
        }
        
        return issues;
    }

    /**
     * Constrói commit a partir do patch
     */
    private async buildCommit(patch: string, docText: DocText): Promise<Commit> {
        // Simula aplicação do patch - implementação real dependeria do sistema de versionamento
        const patchLines = patch.split('\n');
        const fileChanges = this.parsePatchForFileChanges(patch);
        
        if (fileChanges.length === 0) {
            throw new Error('Patch does not contain valid file changes');
        }
        
        // Simula aplicação no conteúdo do arquivo
        const patchedContent = await this.simulatePatchApplication(patch, docText.content);
        
        return {
            patch,
            message: `Apply patch to ${docText.uri}`,
            files: fileChanges.map(f => f.filename),
            additions: fileChanges.reduce((sum, f) => sum + f.additions, 0),
            deletions: fileChanges.reduce((sum, f) => sum + f.deletions, 0)
        };
    }

    /**
     * Parse patch para extrair informações de mudanças de arquivo
     */
    private parsePatchForFileChanges(patch: string): Array<{
        filename: string;
        additions: number;
        deletions: number;
    }> {
        const changes: Array<{ filename: string; additions: number; deletions: number }> = [];
        const lines = patch.split('\n');
        
        let currentFile: string | null = null;
        let additions = 0;
        let deletions = 0;
        
        for (const line of lines) {
            // Detecta novo arquivo
            const fileMatch = line.match(/^\+\+\+ (.+)/) || line.match(/^--- (.+)/);
            if (fileMatch) {
                // Salva arquivo anterior se existir
                if (currentFile) {
                    changes.push({ filename: currentFile, additions, deletions });
                }
                
                currentFile = fileMatch[1].replace(/^[ab]\//, ''); // Remove prefixos a/ b/
                additions = 0;
                deletions = 0;
                continue;
            }
            
            // Conta adições e remoções
            if (line.startsWith('+') && !line.startsWith('+++')) {
                additions++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
            }
        }
        
        // Adiciona último arquivo
        if (currentFile) {
            changes.push({ filename: currentFile, additions, deletions });
        }
        
        return changes;
    }

    /**
     * Simula aplicação do patch no conteúdo
     */
    private async simulatePatchApplication(patch: string, content: string): Promise<string> {
        // Implementação simplificada - versão real usaria bibliotecas de patch como 'diff' ou 'patch-package'
        const lines = content.split('\n');
        const patchLines = patch.split('\n');
        
        // Esta é uma simulação básica - implementação real seria mais robusta
        let result = content;
        
        // Processa hunks do patch
        let i = 0;
        while (i < patchLines.length) {
            const line = patchLines[i];
            
            // Encontra início do hunk
            const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
            if (hunkMatch) {
                const startLine = parseInt(hunkMatch[1]) - 1; // Convert to 0-based
                const context = this.extractHunkContext(patchLines, i + 1);
                
                // Tenta aplicar o hunk
                result = this.applyHunk(result, startLine, context);
            }
            
            i++;
        }
        
        return result;
    }

    /**
     * Extrai contexto do hunk para aplicação
     */
    private extractHunkContext(patchLines: string[], startIndex: number): Array<{
        type: 'context' | 'addition' | 'deletion';
        content: string;
    }> {
        const context: Array<{ type: 'context' | 'addition' | 'deletion'; content: string }> = [];
        
        for (let i = startIndex; i < patchLines.length; i++) {
            const line = patchLines[i];
            
            if (line.startsWith('@@')) {break;} // Next hunk
            
            if (line.startsWith(' ')) {
                context.push({ type: 'context', content: line.slice(1) });
            } else if (line.startsWith('+')) {
                context.push({ type: 'addition', content: line.slice(1) });
            } else if (line.startsWith('-')) {
                context.push({ type: 'deletion', content: line.slice(1) });
            }
        }
        
        return context;
    }

    /**
     * Aplica hunk individual no conteúdo
     */
    private applyHunk(
        content: string,
        startLine: number,
        context: Array<{ type: 'context' | 'addition' | 'deletion'; content: string }>
    ): string {
        const lines = content.split('\n');
        const result: string[] = [];
        
        // Adiciona linhas antes do hunk
        result.push(...lines.slice(0, startLine));
        
        // Processa o hunk
        let lineIndex = startLine;
        for (const item of context) {
            switch (item.type) {
                case 'context':
                    // Verifica se a linha de contexto bate
                    if (lineIndex < lines.length && lines[lineIndex] === item.content) {
                        result.push(item.content);
                        lineIndex++;
                    } else {
                        throw new Error(`Context mismatch at line ${lineIndex + 1}`);
                    }
                    break;
                    
                case 'deletion':
                    // Verifica se a linha a ser removida bate
                    if (lineIndex < lines.length && lines[lineIndex] === item.content) {
                        lineIndex++; // Pula a linha (remove)
                    } else {
                        throw new Error(`Deletion mismatch at line ${lineIndex + 1}`);
                    }
                    break;
                    
                case 'addition':
                    // Adiciona nova linha
                    result.push(item.content);
                    break;
            }
        }
        
        // Adiciona linhas restantes
        result.push(...lines.slice(lineIndex));
        
        return result.join('\n');
    }

    /**
     * Sanitiza caminho do arquivo para telemetria
     */
    private sanitizeFilePath(uri: string): string {
        // Remove informações sensíveis do caminho
        return uri.replace(/^.*[\\\/]/, '').substring(0, 50); // Só o nome do arquivo, max 50 chars
    }

    /**
     * Envia telemetria
     */
    private sendTelemetry(eventName: string, data: Record<string, any>): void {
        try {
            this.telemetryService.sendMSFTTelemetryEvent(eventName, data);
        } catch (error) {
            console.warn('Failed to send patch healing telemetry:', error);
        }
    }
}

/**
 * Factory para criar ApplyPatchTool
 */
export class PatchToolFactory {
    /**
     * Cria ApplyPatchTool com healing habilitado
     */
    static createApplyPatchTool(
        healEndpointProvider: () => Promise<HealingEndpoint>,
        telemetryService: TelemetryService
    ): ApplyPatchTool {
        return new ApplyPatchTool(healEndpointProvider, telemetryService);
    }

    /**
     * Cria mock de healing endpoint para patches
     */
    static createMockHealEndpoint(): HealingEndpoint {
        return {
            async makeChatRequest(requestName: string, messages: any[]): Promise<any> {
                // Mock que retorna um patch "curado"
                const originalPatch = messages[0]?.content?.[0]?.text || '';
                const mockPatch = originalPatch.replace(/\-old_line/g, '-corrected_line');
                
                return {
                    type: ChatFetchResponseType.Success,
                    value: {
                        content: [{ text: `\`\`\`diff\n${mockPatch}\n\`\`\`` }]
                    }
                };
            }
        };
    }

    /**
     * Cria mock de telemetry service para patches
     */
    static createMockTelemetryService(): TelemetryService {
        return {
            sendMSFTTelemetryEvent(eventName: string, properties: Record<string, any>): void {
                console.log(`Patch Telemetry: ${eventName}`, properties);
            }
        };
    }
}