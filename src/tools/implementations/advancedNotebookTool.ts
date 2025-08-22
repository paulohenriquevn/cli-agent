/*---------------------------------------------------------------------------------------------
 * Advanced Notebook Tool - Enhanced Jupyter notebook operations with stable IDs
 * Based on VSCode Copilot's notebook tools with significant improvements
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';

interface IAdvancedNotebookParams {
    action: 'analyze' | 'edit_cell' | 'insert_cell' | 'delete_cell' | 'move_cell' | 'get_outline' | 'find_errors' | 'optimize';
    notebook_path: string;
    cell_id?: string;
    cell_index?: number;
    new_source?: string;
    cell_type?: 'code' | 'markdown';
    target_index?: number;
    target_position?: 'before' | 'after';
    search_pattern?: string;
}

interface INotebookEditResult {
    success: boolean;
    notebook_path: string;
    action: string;
    cells_modified: number;
    new_cell_id?: string;
    errors: string[];
    warnings: string[];
}

export class AdvancedNotebookTool extends BaseTool<IAdvancedNotebookParams> {
    readonly name = 'advanced_notebook';
    readonly tags = ['notebook-operations', 'advanced', 'jupyter', 'data-science'];
    readonly category = 'notebook-operations';
    readonly complexity = 'advanced';
    readonly description = 'Perform advanced operations on Jupyter notebooks with stable cell identification and comprehensive analysis.\n\nUse this when working with Jupyter notebooks (.ipynb files) and need to modify cells, analyze structure, find errors, or get detailed insights. Perfect for data science workflows, educational content creation, or maintaining notebook documentation. Essential when you need reliable cell targeting that won\'t break when notebook structure changes.\n\nUses stable cell IDs instead of fragile index numbers, ensuring operations remain valid even after cells are added/removed. Provides comprehensive notebook analysis including imports, functions, variables, and execution errors. Supports all notebook modification operations with automatic VS Code synchronization.\n\nExamples: Analyzing "data_analysis.ipynb" to understand structure and find errors, editing cell "cell_abc123" to fix Python code, inserting new markdown cell after cell 5, moving cells around while preserving references, or getting notebook outline with all section headers.';

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['analyze', 'edit_cell', 'insert_cell', 'delete_cell', 'move_cell', 'get_outline', 'find_errors', 'optimize'],
                description: 'The notebook operation to perform'
            },
            notebook_path: {
                type: 'string',
                description: 'Path to the Jupyter notebook file (.ipynb)'
            },
            cell_id: {
                type: 'string',
                description: 'Stable cell ID for targeting specific cells (preferred over index)'
            },
            cell_index: {
                type: 'number',
                description: 'Cell index (0-based) - use only if cell_id not available'
            },
            new_source: {
                type: 'string',
                description: 'New source code/content for the cell'
            },
            cell_type: {
                type: 'string',
                enum: ['code', 'markdown'],
                description: 'Type of cell to create (for insert_cell action)'
            },
            target_index: {
                type: 'number',
                description: 'Target position for move operations'
            },
            target_position: {
                type: 'string',
                enum: ['before', 'after'],
                description: 'Position relative to target for insertions'
            },
            search_pattern: {
                type: 'string',
                description: 'Pattern to search for in cells'
            }
        },
        required: ['action', 'notebook_path']
    };

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IAdvancedNotebookParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const params = options.input;

        try {
            // Validate notebook path
            const notebookPath = path.isAbsolute(params.notebook_path) ?
                params.notebook_path :
                path.resolve(this.getWorkspaceRoot(), params.notebook_path);

            switch (params.action) {
                case 'analyze':
                    return await this.handleAnalyze(notebookPath);
                case 'edit_cell':
                    return await this.handleEditCell(notebookPath, params);
                case 'insert_cell':
                    return await this.handleInsertCell(notebookPath, params);
                case 'delete_cell':
                    return await this.handleDeleteCell(notebookPath, params);
                case 'move_cell':
                    return await this.handleMoveCell(notebookPath, params);
                case 'get_outline':
                    return await this.handleGetOutline(notebookPath);
                case 'find_errors':
                    return await this.handleFindErrors(notebookPath);
                case 'optimize':
                    return await this.handleOptimize(notebookPath);
                default:
                    return this.createErrorResult(`Unknown action: ${params.action}`);
            }
        } catch (_error: any) {
            return this.createErrorResult(`Advanced notebook operation failed: ${_error.message}`);
        }
    }

    private async handleAnalyze(notebookPath: string): Promise<vscode.LanguageModelToolResult> {
        const notebook = await this.loadNotebook(notebookPath);
        const analysis = await this.analyzeNotebook(notebook);

        const response = this.formatAnalysisResponse(analysis, notebookPath);
        return this.createSuccessResult(null, response);
    }

    private async handleEditCell(notebookPath: string, params: IAdvancedNotebookParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.new_source) {
            return this.createErrorResult('new_source is required for edit_cell action');
        }

        const notebook = await this.loadNotebook(notebookPath);
        const cellIndex = await this.findCellIndex(notebook, params);

        if (cellIndex === -1) {
            return this.createErrorResult(`Cell not found: ${params.cell_id || params.cell_index}`);
        }

        // Edit the cell
        notebook.cells[cellIndex].source = this.normalizeSource(params.new_source);

        // Save notebook
        await this.saveNotebook(notebookPath, notebook);

        // Notify VS Code if notebook is open
        await this.notifyVSCode(notebookPath, notebook);

        const result: INotebookEditResult = {
            success: true,
            notebook_path: path.relative(this.getWorkspaceRoot(), notebookPath),
            action: 'edit_cell',
            cells_modified: 1,
            errors: [],
            warnings: []
        };

        const response = this.formatEditResponse(result);
        return this.createSuccessResult(null, response);
    }

    private async handleInsertCell(notebookPath: string, params: IAdvancedNotebookParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.new_source || !params.cell_type) {
            return this.createErrorResult('new_source and cell_type are required for insert_cell action');
        }

        const notebook = await this.loadNotebook(notebookPath);

        // Determine insertion index
        let insertIndex = notebook.cells.length; // Default to end

        if (params.cell_index !== undefined) {
            insertIndex = params.target_position === 'before' ? params.cell_index : params.cell_index + 1;
        } else if (params.cell_id) {
            const existingIndex = await this.findCellIndex(notebook, params);
            if (existingIndex !== -1) {
                insertIndex = params.target_position === 'before' ? existingIndex : existingIndex + 1;
            }
        }

        // Create new cell with stable ID
        const newCellId = this.generateCellId();
        const newCell = {
            cell_type: params.cell_type,
            id: newCellId,
            metadata: { id: newCellId },
            source: this.normalizeSource(params.new_source),
            outputs: params.cell_type === 'code' ? [] : undefined,
            execution_count: params.cell_type === 'code' ? null : undefined
        };

        // Insert the cell
        notebook.cells.splice(insertIndex, 0, newCell);

        // Save notebook
        await this.saveNotebook(notebookPath, notebook);
        await this.notifyVSCode(notebookPath, notebook);

        const result: INotebookEditResult = {
            success: true,
            notebook_path: path.relative(this.getWorkspaceRoot(), notebookPath),
            action: 'insert_cell',
            cells_modified: 1,
            new_cell_id: newCellId,
            errors: [],
            warnings: []
        };

        const response = this.formatEditResponse(result);
        return this.createSuccessResult(null, response);
    }

    private async handleDeleteCell(notebookPath: string, params: IAdvancedNotebookParams): Promise<vscode.LanguageModelToolResult> {
        const notebook = await this.loadNotebook(notebookPath);
        const cellIndex = await this.findCellIndex(notebook, params);

        if (cellIndex === -1) {
            return this.createErrorResult(`Cell not found: ${params.cell_id || params.cell_index}`);
        }

        // Remove the cell
        notebook.cells.splice(cellIndex, 1);

        // Save notebook
        await this.saveNotebook(notebookPath, notebook);
        await this.notifyVSCode(notebookPath, notebook);

        const result: INotebookEditResult = {
            success: true,
            notebook_path: path.relative(this.getWorkspaceRoot(), notebookPath),
            action: 'delete_cell',
            cells_modified: 1,
            errors: [],
            warnings: []
        };

        const response = this.formatEditResponse(result);
        return this.createSuccessResult(null, response);
    }

    private async handleMoveCell(notebookPath: string, params: IAdvancedNotebookParams): Promise<vscode.LanguageModelToolResult> {
        if (params.target_index === undefined) {
            return this.createErrorResult('target_index is required for move_cell action');
        }

        const notebook = await this.loadNotebook(notebookPath);
        const sourceIndex = await this.findCellIndex(notebook, params);

        if (sourceIndex === -1) {
            return this.createErrorResult(`Cell not found: ${params.cell_id || params.cell_index}`);
        }

        const targetIndex = Math.max(0, Math.min(notebook.cells.length - 1, params.target_index));

        // Move the cell
        const [movedCell] = notebook.cells.splice(sourceIndex, 1);
        notebook.cells.splice(targetIndex, 0, movedCell);

        // Save notebook
        await this.saveNotebook(notebookPath, notebook);
        await this.notifyVSCode(notebookPath, notebook);

        const result: INotebookEditResult = {
            success: true,
            notebook_path: path.relative(this.getWorkspaceRoot(), notebookPath),
            action: 'move_cell',
            cells_modified: 1,
            errors: [],
            warnings: []
        };

        const response = this.formatEditResponse(result);
        return this.createSuccessResult(null, response);
    }

    private async handleGetOutline(notebookPath: string): Promise<vscode.LanguageModelToolResult> {
        const notebook = await this.loadNotebook(notebookPath);
        const outline = this.createNotebookOutline(notebook);

        const response = this.formatOutlineResponse(outline, notebookPath);
        return this.createSuccessResult(null, response);
    }

    private async handleFindErrors(notebookPath: string): Promise<vscode.LanguageModelToolResult> {
        const notebook = await this.loadNotebook(notebookPath);
        const errors = this.findNotebookErrors(notebook);

        const response = this.formatErrorsResponse(errors, notebookPath);
        return this.createSuccessResult(null, response);
    }

    private async handleOptimize(notebookPath: string): Promise<vscode.LanguageModelToolResult> {
        const notebook = await this.loadNotebook(notebookPath);
        const optimizations = await this.optimizeNotebook(notebook);

        if (optimizations.changes > 0) {
            await this.saveNotebook(notebookPath, notebook);
            await this.notifyVSCode(notebookPath, notebook);
        }

        const response = this.formatOptimizationResponse(optimizations, notebookPath);
        return this.createSuccessResult(null, response);
    }

    // Helper methods

    private async loadNotebook(notebookPath: string): Promise<any> {
        try {
            const content = await fs.readFile(notebookPath, 'utf8');
            const notebook = JSON.parse(content);

            // Ensure cells have stable IDs
            notebook.cells.forEach((cell: any, _index: number) => {
                if (!cell.id && !cell.metadata?.id) {
                    cell.id = this.generateCellId();
                    cell.metadata = cell.metadata || {};
                    cell.metadata.id = cell.id;
                }
            });

            return notebook;
        } catch (_error: any) {
            throw new Error(`Failed to load notebook: ${_error.message}`);
        }
    }

    private async saveNotebook(notebookPath: string, notebook: any): Promise<void> {
        try {
            const content = JSON.stringify(notebook, null, 2);
            await fs.writeFile(notebookPath, content, 'utf8');
        } catch (_error: any) {
            throw new Error(`Failed to save notebook: ${_error.message}`);
        }
    }

    private async notifyVSCode(notebookPath: string, notebook: any): Promise<void> {
        try {
            // Notify VS Code that the file has changed
            const uri = vscode.Uri.file(notebookPath);
            const content = JSON.stringify(notebook, null, 2);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
        } catch {
            // Ignore VS Code notification errors
        }
    }

    private async findCellIndex(notebook: any, params: IAdvancedNotebookParams): Promise<number> {
        if (params.cell_id) {
            return notebook.cells.findIndex((cell: any) =>
                cell.id === params.cell_id || cell.metadata?.id === params.cell_id
            );
        } else if (params.cell_index !== undefined) {
            return params.cell_index >= 0 && params.cell_index < notebook.cells.length ?
                params.cell_index : -1;
        }
        return -1;
    }

    private generateCellId(): string {
        return `cell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private normalizeSource(source: string): string[] {
        // Ensure source is an array of lines (notebook format)
        return source.split('\n');
    }

    private async analyzeNotebook(notebook: any): Promise<any> {
        const cells = notebook.cells || [];
        const analysis = {
            totalCells: cells.length,
            codeCells: cells.filter((c: any) => c.cell_type === 'code').length,
            markdownCells: cells.filter((c: any) => c.cell_type === 'markdown').length,
            emptyCells: cells.filter((c: any) => !c.source || c.source.length === 0).length,
            cellsWithOutput: cells.filter((c: any) => c.outputs && c.outputs.length > 0).length,
            imports: this.extractImports(cells),
            functions: this.extractFunctions(cells),
            variables: this.extractVariables(cells),
            errors: this.findNotebookErrors(notebook),
            sections: this.createNotebookOutline(notebook).sections
        };

        return analysis;
    }

    private extractImports(cells: any[]): string[] {
        const imports: string[] = [];
        cells.forEach(cell => {
            if (cell.cell_type === 'code' && cell.source) {
                const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
                const importMatches = source.match(/^(import\s+\w+|from\s+\w+\s+import)/gm);
                if (importMatches) {
                    imports.push(...importMatches);
                }
            }
        });
        return [...new Set(imports)];
    }

    private extractFunctions(cells: any[]): string[] {
        const functions: string[] = [];
        cells.forEach(cell => {
            if (cell.cell_type === 'code' && cell.source) {
                const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
                const funcMatches = source.match(/def\s+(\w+)\s*\(/g);
                if (funcMatches) {
                    functions.push(...funcMatches.map((m: string) => m.match(/def\s+(\w+)/)?.[1] || ''));
                }
            }
        });
        return [...new Set(functions)].filter(f => f);
    }

    private extractVariables(cells: any[]): string[] {
        const variables: string[] = [];
        cells.forEach(cell => {
            if (cell.cell_type === 'code' && cell.source) {
                const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
                const varMatches = source.match(/^(\w+)\s*=/gm);
                if (varMatches) {
                    variables.push(...varMatches.map((m: string) => m.split('=')[0].trim()));
                }
            }
        });
        return [...new Set(variables)];
    }

    private createNotebookOutline(notebook: any): any {
        const sections: any[] = [];
        const cells = notebook.cells || [];

        cells.forEach((cell: any, index: number) => {
            if (cell.cell_type === 'markdown' && cell.source) {
                const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
                const headerMatch = source.match(/^(#{1,6})\s+(.+)/m);

                if (headerMatch) {
                    sections.push({
                        level: headerMatch[1].length,
                        title: headerMatch[2].trim(),
                        cellIndex: index,
                        cellId: cell.id || cell.metadata?.id
                    });
                }
            }
        });

        return {
            totalCells: cells.length,
            codeCells: cells.filter((c: any) => c.cell_type === 'code').length,
            markdownCells: cells.filter((c: any) => c.cell_type === 'markdown').length,
            sections
        };
    }

    private findNotebookErrors(notebook: any): any[] {
        const errors: any[] = [];
        const cells = notebook.cells || [];

        cells.forEach((cell: any, index: number) => {
            if (cell.cell_type === 'code' && cell.outputs) {
                cell.outputs.forEach((output: any) => {
                    if (output.output_type === 'error') {
                        errors.push({
                            cellIndex: index,
                            cellId: cell.id || cell.metadata?.id,
                            errorType: output.ename || 'Unknown',
                            errorMessage: output.evalue || 'No message',
                            traceback: output.traceback || []
                        });
                    }
                });
            }
        });

        return errors;
    }

    private async optimizeNotebook(notebook: any): Promise<any> {
        let changes = 0;
        const optimizations: string[] = [];
        const cells = notebook.cells || [];

        // Remove empty cells
        const emptyCells = cells.filter((c: any, _i: number) => {
            const isEmpty = !c.source || (Array.isArray(c.source) ? c.source.join('').trim() === '' : c.source.trim() === '');
            return isEmpty;
        });

        if (emptyCells.length > 0) {
            notebook.cells = cells.filter((c: any) => {
                const isEmpty = !c.source || (Array.isArray(c.source) ? c.source.join('').trim() === '' : c.source.trim() === '');
                return !isEmpty;
            });
            changes += emptyCells.length;
            optimizations.push(`Removed ${emptyCells.length} empty cells`);
        }

        // Clear outputs if requested
        const cellsWithOutput = notebook.cells.filter((c: any) => c.cell_type === 'code' && c.outputs && c.outputs.length > 0);
        if (cellsWithOutput.length > 0) {
            cellsWithOutput.forEach((cell: any) => {
                cell.outputs = [];
                cell.execution_count = null;
            });
            optimizations.push(`Cleared outputs from ${cellsWithOutput.length} cells`);
        }

        return {
            changes,
            optimizations,
            cellsRemoved: emptyCells.length,
            outputsCleared: cellsWithOutput.length
        };
    }

    // Response formatting methods

    private formatAnalysisResponse(analysis: any, notebookPath: string): string {
        const lines = [
            `**📊 Advanced Notebook Analysis**`,
            `**File:** \`${path.relative(this.getWorkspaceRoot(), notebookPath)}\``,
            '',
            `**📈 Statistics:**`,
            `- Total Cells: ${analysis.totalCells}`,
            `- Code Cells: ${analysis.codeCells}`,
            `- Markdown Cells: ${analysis.markdownCells}`,
            `- Empty Cells: ${analysis.emptyCells}`,
            `- Cells with Output: ${analysis.cellsWithOutput}`,
            ''
        ];

        if (analysis.imports.length > 0) {
            lines.push(`**📥 Imports (${analysis.imports.length}):**`);
            analysis.imports.slice(0, 10).forEach((imp: string) => {
                lines.push(`- \`${imp}\``);
            });
            if (analysis.imports.length > 10) {
                lines.push(`- ... and ${analysis.imports.length - 10} more`);
            }
            lines.push('');
        }

        if (analysis.functions.length > 0) {
            lines.push(`**⚙️ Functions (${analysis.functions.length}):**`);
            analysis.functions.slice(0, 10).forEach((func: string) => {
                lines.push(`- \`${func}()\``);
            });
            if (analysis.functions.length > 10) {
                lines.push(`- ... and ${analysis.functions.length - 10} more`);
            }
            lines.push('');
        }

        if (analysis.errors.length > 0) {
            lines.push(`**❌ Errors Found (${analysis.errors.length}):**`);
            analysis.errors.forEach((error: any) => {
                lines.push(`- Cell ${error.cellIndex}: ${error.errorType}: ${error.errorMessage}`);
            });
            lines.push('');
        }

        if (analysis.sections.length > 0) {
            lines.push(`**📋 Sections (${analysis.sections.length}):**`);
            analysis.sections.forEach((section: any) => {
                const indent = '  '.repeat(section.level - 1);
                lines.push(`${indent}- ${section.title} (Cell ${section.cellIndex})`);
            });
        }

        return lines.join('\n');
    }

    private formatEditResponse(result: INotebookEditResult): string {
        const lines = [
            `**📝 Notebook Edit Complete**`,
            `**File:** \`${result.notebook_path}\``,
            `**Action:** ${result.action}`,
            `**Cells Modified:** ${result.cells_modified}`,
            `**Success:** ${result.success ? 'Yes' : 'No'}`,
            ''
        ];

        if (result.new_cell_id) {
            lines.push(`**New Cell ID:** \`${result.new_cell_id}\``);
            lines.push('');
        }

        if (result.errors.length > 0) {
            lines.push('**Errors:**');
            result.errors.forEach(error => lines.push(`- ${error}`));
            lines.push('');
        }

        if (result.warnings.length > 0) {
            lines.push('**Warnings:**');
            result.warnings.forEach(warning => lines.push(`- ${warning}`));
            lines.push('');
        }

        lines.push('✅ Notebook updated successfully');
        return lines.join('\n');
    }

    private formatOutlineResponse(outline: any, notebookPath: string): string {
        const lines = [
            `**📋 Notebook Outline**`,
            `**File:** \`${path.relative(this.getWorkspaceRoot(), notebookPath)}\``,
            `**Total Cells:** ${outline.totalCells}`,
            `**Code:** ${outline.codeCells} | **Markdown:** ${outline.markdownCells}`,
            ''
        ];

        if (outline.sections.length === 0) {
            lines.push('No section headers found in notebook.');
        } else {
            lines.push(`**Sections (${outline.sections.length}):**`);
            outline.sections.forEach((section: any) => {
                const indent = '  '.repeat(section.level - 1);
                lines.push(`${indent}- ${section.title} (Cell ${section.cellIndex})`);
            });
        }

        return lines.join('\n');
    }

    private formatErrorsResponse(errors: any[], notebookPath: string): string {
        const lines = [
            `**❌ Notebook Errors**`,
            `**File:** \`${path.relative(this.getWorkspaceRoot(), notebookPath)}\``,
            `**Errors Found:** ${errors.length}`,
            ''
        ];

        if (errors.length === 0) {
            lines.push('✅ No execution errors found!');
        } else {
            errors.forEach((error, index) => {
                lines.push(`**${index + 1}. Cell ${error.cellIndex}** (\`${error.cellId}\`)`);
                lines.push(`   **Type:** ${error.errorType}`);
                lines.push(`   **Message:** ${error.errorMessage}`);
                if (error.traceback && error.traceback.length > 0) {
                    lines.push(`   **Traceback:** ${error.traceback[0]}`);
                }
                lines.push('');
            });
        }

        return lines.join('\n');
    }

    private formatOptimizationResponse(optimizations: any, notebookPath: string): string {
        const lines = [
            `**🔧 Notebook Optimization**`,
            `**File:** \`${path.relative(this.getWorkspaceRoot(), notebookPath)}\``,
            `**Changes Made:** ${optimizations.changes}`,
            ''
        ];

        if (optimizations.changes === 0) {
            lines.push('✅ Notebook is already optimized!');
        } else {
            lines.push('**Optimizations Applied:**');
            optimizations.optimizations.forEach((opt: string) => {
                lines.push(`- ${opt}`);
            });
            lines.push('');
            lines.push('✅ Notebook optimized successfully');
        }

        return lines.join('\n');
    }
}

// Register the tool
ToolRegistry.getInstance().registerTool(AdvancedNotebookTool);