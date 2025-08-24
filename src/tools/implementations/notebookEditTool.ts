/*---------------------------------------------------------------------------------------------
 * Notebook Edit Tool - Edit Jupyter notebook cells
 * Replicates Claude Code's NotebookEdit tool functionality
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import {
    CliCancellationToken,
    CliToolResult,
    CliToolInvocationOptions
} from '../types/cliTypes';

interface INotebookEditParams {
    notebook_path: string;
    new_source: string;
    cell_id?: string;
    cell_type?: 'code' | 'markdown';
    edit_mode?: 'replace' | 'insert' | 'delete';
    [key: string]: unknown;
}

export class NotebookEditTool extends BaseTool<INotebookEditParams> {
    readonly name = 'notebook_edit';
    readonly description = '[PRIMARY ACTION] - Edits Jupyter notebook cells with support for replacing, inserting, and deleting cells while preserving notebook structure\\n\\n[WHEN TO USE] - Use when modifying existing notebooks, updating experimental code, adding new analysis cells, or cleaning up notebook content. Essential for programmatically maintaining data science workflows and notebook-based documentation.\\n\\n[HOW IT WORKS] - Supports three edit modes: replace (modify existing cell), insert (add new cell), delete (remove cell). Automatically handles cell IDs, execution counts, and output clearing. Preserves notebook metadata and structure.';
    readonly tags = ['notebook-operations', 'core', 'jupyter'];
    readonly category = 'notebook-operations';
    readonly complexity = 'core';
    readonly inputSchema = {
        type: 'object',
        properties: {
            notebook_path: {
                type: 'string',
                description: 'The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)'
            },
            new_source: {
                type: 'string',
                description: 'The new source for the cell'
            },
            cell_id: {
                type: 'string',
                description: 'The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after this cell, or at the beginning if not specified.'
            },
            cell_type: {
                type: 'string',
                enum: ['code', 'markdown'],
                description: 'The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required.'
            },
            edit_mode: {
                type: 'string',
                enum: ['replace', 'insert', 'delete'],
                description: 'The type of edit to make (replace, insert, delete). Defaults to replace.',
                default: 'replace'
            }
        },
        required: ['notebook_path', 'new_source']
    };

    async invoke(
        options: CliToolInvocationOptions<INotebookEditParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const params = options.input;

        try {
            // Validate parameters
            if (!params.notebook_path || typeof params.notebook_path !== 'string') {
                return this.createErrorResult('notebook_path is required and must be a string');
            }

            if (!params.new_source) {
                return this.createErrorResult('new_source is required');
            }

            // Ensure absolute path
            if (!path.isAbsolute(params.notebook_path)) {
                return this.createErrorResult('notebook_path must be absolute, not relative');
            }

            // Check file extension
            if (!params.notebook_path.endsWith('.ipynb')) {
                return this.createErrorResult('File must be a Jupyter notebook (.ipynb)');
            }

            const editMode = params.edit_mode || 'replace';

            // Validate edit mode specific requirements
            if (editMode === 'insert' && !params.cell_type) {
                return this.createErrorResult('cell_type is required when edit_mode=insert');
            }

            // Read and modify notebook
            const result = await this.editNotebook(params);

            const response = this.formatEditResponse(params.notebook_path, result);
            return this.createSuccessResult(null, response);

        } catch (error: any) {
            return this.createErrorResult(`Failed to edit notebook: ${error.message}`);
        }
    }

    private async editNotebook(params: INotebookEditParams): Promise<any> {
        // Read notebook
        const content = await fs.readFile(params.notebook_path, 'utf8');
        const notebook = JSON.parse(content);

        if (!notebook.cells || !Array.isArray(notebook.cells)) {
            throw new Error('Invalid notebook format: missing or invalid cells array');
        }

        const editMode = params.edit_mode || 'replace';
        let targetCellIndex = -1;
        let operation = '';

        // Find target cell if cell_id provided
        if (params.cell_id) {
            targetCellIndex = notebook.cells.findIndex((cell: any) => cell.id === params.cell_id);
            if (targetCellIndex === -1 && editMode !== 'insert') {
                throw new Error(`Cell with ID '${params.cell_id}' not found`);
            }
        }

        switch (editMode) {
            case 'replace': {
                if (targetCellIndex === -1) {
                    throw new Error('cell_id is required for replace mode');
                }

                // Keep existing cell type if not specified
                const cellType = params.cell_type || notebook.cells[targetCellIndex].cell_type;

                notebook.cells[targetCellIndex] = {
                    ...notebook.cells[targetCellIndex],
                    cell_type: cellType,
                    source: this.formatSource(params.new_source)
                };

                // Clear outputs for code cells
                if (cellType === 'code') {
                    notebook.cells[targetCellIndex].outputs = [];
                    notebook.cells[targetCellIndex].execution_count = null;
                }

                operation = `Replaced cell ${targetCellIndex + 1}`;
                break;
            }

            case 'insert': {
                const newCell: any = {
                    id: this.generateCellId(),
                    cell_type: params.cell_type,
                    source: this.formatSource(params.new_source),
                    metadata: {}
                };

                if (params.cell_type === 'code') {
                    newCell.execution_count = null;
                    newCell.outputs = [];
                }

                const insertIndex = targetCellIndex >= 0 ? targetCellIndex + 1 : 0;
                notebook.cells.splice(insertIndex, 0, newCell);

                operation = `Inserted new ${params.cell_type} cell at position ${insertIndex + 1}`;
                break;
            }

            case 'delete': {
                if (targetCellIndex === -1) {
                    throw new Error('cell_id is required for delete mode');
                }

                notebook.cells.splice(targetCellIndex, 1);
                operation = `Deleted cell ${targetCellIndex + 1}`;
                break;
            }
        }

        // Write notebook back
        await fs.writeFile(params.notebook_path, JSON.stringify(notebook, null, 2), 'utf8');

        // Write notebook file
        // (VSCode workspace notification removed)

        return {
            operation,
            totalCells: notebook.cells.length,
            targetCell: targetCellIndex >= 0 ? targetCellIndex + 1 : null
        };
    }

    private formatSource(source: string): string[] {
        // Convert string to array format used by Jupyter
        const lines = source.split('\n');
        return lines.map((line, index) => {
            // Add newline character except for the last line
            return index === lines.length - 1 ? line : line + '\n';
        });
    }

    private generateCellId(): string {
        // Generate a unique cell ID (simplified version)
        return Math.random().toString(36).substring(2, 15);
    }

    private formatEditResponse(notebookPath: string, result: any): string {
        const lines = [
            `**📓 Notebook Edit Complete**`,
            `**File:** \`${path.basename(notebookPath)}\``,
            `**Operation:** ${result.operation}`,
            `**Total Cells:** ${result.totalCells}`,
            ''
        ];

        if (result.targetCell) {
            lines.push(`**Modified Cell:** ${result.targetCell}`);
            lines.push('');
        }

        lines.push('**✅ Changes saved successfully**');
        lines.push('');
        lines.push('**Note:** The notebook has been updated on disk. If the notebook is open in VS Code, you may need to reload it to see the changes.');

        return lines.join('\n');
    }
}

// Register the tool
ToolRegistry.registerTool(NotebookEditTool);