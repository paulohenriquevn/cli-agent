/*---------------------------------------------------------------------------------------------
 * Memory Tool - Save facts to agent.md for persistent context
 * REFACTORED: Adapted to CLI Agent SDK patterns
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult
} from '../types/cliTypes';
import {
    SaveMemoryParams,
    SaveMemoryResult,
    SavedMemoryFact,
    MemoryError
} from '../types/memoryTypes';

export class MemoryTool extends BaseTool<SaveMemoryParams> {
    readonly name = 'save_memory';
    readonly description = `Save important information to persistent memory (agent.md file).

Use when: User mentions preferences, important facts, project details, or information that should be remembered across conversations.

Features: Automatic file creation, categorization, priority levels, tagging system, project association.

Examples: Save user preferences, remember coding patterns, store project requirements, keep important decisions.`;

    // Tag system implementation
    readonly tags = ['memory', 'persistence', 'core', 'context'];
    readonly category = 'memory-management';
    readonly complexity: 'core' = 'core';
    readonly inputSchema = {
        type: 'object',
        properties: {
            fact: {
                type: 'string',
                description: 'The information to save to memory',
                minLength: 1,
                examples: ['User prefers React over Vue', 'Project uses TypeScript strict mode', 'Database is PostgreSQL']
            },
            category: {
                type: 'string',
                description: 'Category to organize the memory (optional)',
                examples: ['preferences', 'project-info', 'decisions', 'patterns']
            },
            priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Priority level of this memory (default: medium)',
                default: 'medium'
            },
            project: {
                type: 'string',
                description: 'Project name to associate this memory with (optional)',
                examples: ['my-web-app', 'cli-tool', 'data-pipeline']
            },
            tags: {
                type: 'array',
                items: {
                    type: 'string'
                },
                description: 'Tags to help categorize and search memories (optional)',
                examples: [['react', 'frontend'], ['database', 'postgres'], ['user-preference']]
            }
        },
        required: ['fact']
    };

    private static readonly AGENT_MD_FILENAMES = [
        'agent.md',
        '.agent.md',
        'context.md',
        '.context.md',
        'README.agent.md'
    ];

    async invoke(
        options: CliToolInvocationOptions<SaveMemoryParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { fact, category, priority = 'medium', project, tags = [] } = options.input;

        try {
            return await this.executeMemorySave(fact, category, priority, project, tags);
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error saving memory');
        }
    }

    private async executeMemorySave(
        fact: string,
        category?: string,
        priority: 'low' | 'medium' | 'high' = 'medium',
        project?: string,
        tags: string[] = []
    ): Promise<CliToolResult> {
        try {
            // Validar entrada
            if (!fact || fact.trim() === '') {
                return this.createErrorResult('Fact cannot be empty');
            }

            // Encontrar ou criar arquivo agent.md
            const contextFilePath = await this.findOrCreateContextFile();

            // Gerar ID único para o fato
            const factId = this.generateFactId(fact);

            // Criar objeto do fato
            const memoryFact: SavedMemoryFact = {
                id: factId,
                content: fact.trim(),
                timestamp: new Date(),
                category,
                priority,
                tags,
                project
            };

            // Adicionar à seção de memórias
            await this.appendToMemorySection(contextFilePath, memoryFact);

            // Preparar resultado
            const saveResult: SaveMemoryResult = {
                success: true,
                filePath: contextFilePath,
                message: `Memory saved: "${fact}"`,
                factId,
                timestamp: memoryFact.timestamp
            };

            const successMessage = this.formatSuccessMessage(saveResult);
            return this.createSuccessResult(saveResult, successMessage);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return this.createErrorResult(`Failed to save memory: ${errorMessage}`);
        }
    }

    private generateFactId(fact: string): string {
        const hash = crypto.createHash('md5').update(fact + Date.now()).digest('hex');
        return `fact_${hash.substring(0, 8)}`;
    }

    private generateDefaultAgentContent(): string {
        const timestamp = new Date().toISOString().split('T')[0];
        
        return `# Agent Context

## Project Description
This is a project context file for the AI agent. Add your project-specific information, guidelines, and preferences here.

## Instructions
- Add any coding standards or preferences
- Include architectural decisions
- Document any specific patterns to follow

## Agent Added Memories
<!-- Facts saved by the agent will appear below this line -->

---
*File created by AI Agent on ${timestamp}*
`;
    }

    private async findOrCreateContextFile(): Promise<string> {
        const workspaceRoot = this.getWorkspaceRoot();
        
        // Tentar encontrar arquivo existente
        for (const filename of MemoryTool.AGENT_MD_FILENAMES) {
            const contextPath = path.join(workspaceRoot, filename);
            try {
                await fs.promises.access(contextPath, fs.constants.F_OK);
                return contextPath;
            } catch {
                // Continue tentando próximo nome
            }
        }
        
        // Não encontrou, criar novo arquivo
        const newFilePath = path.join(workspaceRoot, 'agent.md');
        const defaultContent = this.generateDefaultAgentContent();
        await fs.promises.writeFile(newFilePath, defaultContent, 'utf8');
        
        return newFilePath;
    }

    private formatMemoryFact(memoryFact: SavedMemoryFact): string {
        const timestamp = memoryFact.timestamp.toISOString().split('T')[0];
        const tags = memoryFact.tags && memoryFact.tags.length > 0 
            ? ` [${memoryFact.tags.join(', ')}]` 
            : '';
        
        const category = memoryFact.category ? ` (${memoryFact.category})` : '';
        const priority = memoryFact.priority === 'high' 
            ? ` **HIGH**` 
            : '';
        
        const project = memoryFact.project ? ` - Project: ${memoryFact.project}` : '';
        
        return `### ${timestamp} - ${memoryFact.id}${category}${priority}${tags}${project}

${memoryFact.content}

---
`;
    }

    private async appendToMemorySection(filePath: string, memoryFact: SavedMemoryFact): Promise<void> {
        try {
            // Ler conteúdo atual
            let content = await fs.promises.readFile(filePath, 'utf8');
            
            // Verificar se seção de memórias existe
            const memoriesSection = '## Agent Added Memories';
            const memoriesSectionIndex = content.indexOf(memoriesSection);
            
            if (memoriesSectionIndex === -1) {
                // Seção não existe, adicionar no final
                content += `\n\n${memoriesSection}\n\n${this.formatMemoryFact(memoryFact)}`;
            } else {
                // Seção existe, adicionar após a linha do cabeçalho
                const sectionHeaderEnd = content.indexOf('\n', memoriesSectionIndex) + 1;
                const beforeInsertion = content.substring(0, sectionHeaderEnd);
                const afterInsertion = content.substring(sectionHeaderEnd);
                
                content = beforeInsertion + '\n' + this.formatMemoryFact(memoryFact) + afterInsertion;
            }
            
            // Escrever conteúdo atualizado
            await fs.promises.writeFile(filePath, content, 'utf8');
            
        } catch (error) {
            throw new MemoryError('PROCESSING_ERROR', 
                `Failed to update agent.md file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                { filePath, factId: memoryFact.id }
            );
        }
    }

    private formatSuccessMessage(result: SaveMemoryResult): string {
        const fileName = path.basename(result.filePath);
        return `✅ Memory saved successfully!

**Fact ID:** ${result.factId}
**File:** ${fileName}
**Content:** "${result.message}"

This information has been saved to your local agent.md file and will be remembered in future conversations.`;
    }
}

// Auto-register the tool
ToolRegistry.registerTool(MemoryTool);