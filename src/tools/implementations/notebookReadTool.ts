/*---------------------------------------------------------------------------------------------
 * Notebook Read Tool - Read Jupyter notebook files and return cells with outputs
 * Replicates Claude Code's NotebookRead tool functionality
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';

interface INotebookReadParams {
    notebook_path: string;
    cell_id?: string;
}

interface INotebookCell {
    id: string;
    cell_type: 'code' | 'markdown' | 'raw';
    source: string[];
    outputs?: any[];
    execution_count?: number;
    metadata?: any;
}

export class NotebookReadTool extends BaseTool<INotebookReadParams> {
    readonly name = 'notebook_read';
    readonly description = '[PRIMARY ACTION] - Reads Jupyter notebook files and displays all cells with their source code, outputs, and execution metadata\\n\\n[WHEN TO USE] - Use when you need to examine existing Jupyter notebooks, analyze data science workflows, review experimental code, or understand the state of notebook execution. Essential for debugging notebook issues or extracting code from research notebooks.\\n\\n[HOW IT WORKS] - Parses .ipynb JSON format to extract cell contents, execution counts, outputs, and metadata. Supports filtering by specific cell ID and handles all cell types (code, markdown, raw). Formats output with syntax highlighting and execution results.';
    readonly tags = ['notebook-operations', 'core', 'jupyter'];
    readonly category = 'notebook-operations';
    readonly complexity = 'core';
    readonly inputSchema = {
        type: 'object',
        properties: {
            notebook_path: {
                type: 'string',
                description: 'The absolute path to the Jupyter notebook file to read (must be absolute, not relative)'
            },
            cell_id: {
                type: 'string',
                description: 'The ID of a specific cell to read. If not provided, all cells will be read.'
            }
        },
        required: ['notebook_path']
    };

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<INotebookReadParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const params = options.input;

        try {
            // Validate parameters
            if (!params.notebook_path || typeof params.notebook_path !== 'string') {
                return this.createErrorResult('notebook_path is required and must be a string');
            }

            // Ensure absolute path
            if (!path.isAbsolute(params.notebook_path)) {
                return this.createErrorResult('notebook_path must be absolute, not relative');
            }

            // Check file extension
            if (!params.notebook_path.endsWith('.ipynb')) {
                return this.createErrorResult('File must be a Jupyter notebook (.ipynb)');
            }

            // Read and parse notebook
            const notebook = await this.readNotebook(params.notebook_path);

            // Filter cells if specific cell_id requested
            let cells = notebook.cells;
            if (params.cell_id) {
                const specificCell = cells.find((cell: any) => cell.id === params.cell_id);
                if (!specificCell) {
                    return this.createErrorResult(`Cell with ID '${params.cell_id}' not found`);
                }
                cells = [specificCell];
            }

            // Format response
            const response = this.formatNotebookResponse(params.notebook_path, notebook, cells);
            return this.createSuccessResult(null, response);

        } catch (error: any) {
            return this.createErrorResult(`Failed to read notebook: ${error.message}`);
        }
    }

    private async readNotebook(notebookPath: string): Promise<any> {
        try {
            const content = await fs.readFile(notebookPath, 'utf8');
            const notebook = JSON.parse(content);

            // Validate notebook structure
            if (!notebook.cells || !Array.isArray(notebook.cells)) {
                throw new Error('Invalid notebook format: missing or invalid cells array');
            }

            return notebook;

        } catch (error: any) {
            if (error.code === 'ENOENT') {
                throw new Error(`Notebook file not found: ${notebookPath}`);
            } else if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON in notebook file: ${error.message}`);
            } else {
                throw error;
            }
        }
    }

    private formatNotebookResponse(notebookPath: string, notebook: any, cells: INotebookCell[]): string {
        const lines = [
            `**📓 Jupyter Notebook: \`${path.basename(notebookPath)}\`**`,
            `**Path:** \`${notebookPath}\``,
            `**Kernel:** ${notebook.metadata?.kernelspec?.display_name || 'Unknown'}`,
            `**Language:** ${notebook.metadata?.language_info?.name || 'Unknown'}`,
            `**Total Cells:** ${notebook.cells.length}`,
            `**Showing:** ${cells.length} cell(s)`,
            ''
        ];

        cells.forEach((cell, index) => {
            lines.push(`## Cell ${index + 1} (${cell.cell_type})`);
            lines.push(`**ID:** \`${cell.id}\``);

            if (cell.execution_count !== null && cell.execution_count !== undefined) {
                lines.push(`**Execution Count:** ${cell.execution_count}`);
            }

            lines.push('');
            lines.push('**Source:**');
            lines.push('```' + (cell.cell_type === 'code' ? this.getLanguage(notebook) : 'markdown'));
            lines.push(Array.isArray(cell.source) ? cell.source.join('') : cell.source);
            lines.push('```');

            // Show outputs for code cells
            if (cell.cell_type === 'code' && cell.outputs && cell.outputs.length > 0) {
                lines.push('');
                lines.push('**Outputs:**');

                cell.outputs.forEach((output, outputIndex) => {
                    lines.push(`**Output ${outputIndex + 1}:**`);

                    if (output.output_type === 'stream') {
                        lines.push('```');
                        lines.push(Array.isArray(output.text) ? output.text.join('') : output.text);
                        lines.push('```');
                    } else if (output.output_type === 'display_data' || output.output_type === 'execute_result') {
                        if (output.data) {
                            if (output.data['text/plain']) {
                                lines.push('```');
                                lines.push(Array.isArray(output.data['text/plain']) ?
                                    output.data['text/plain'].join('') : output.data['text/plain']);
                                lines.push('```');
                            }
                            if (output.data['text/html']) {
                                lines.push('**HTML Output:** (truncated)');
                            }
                            if (output.data['image/png'] || output.data['image/jpeg']) {
                                lines.push('**Image Output:** (base64 data available)');
                            }
                        }
                    } else if (output.output_type === 'error') {
                        lines.push('**Error:**');
                        lines.push('```');
                        lines.push(`${output.ename}: ${output.evalue}`);
                        if (output.traceback) {
                            lines.push(output.traceback.join('\n'));
                        }
                        lines.push('```');
                    }
                });
            }

            lines.push('');
            lines.push('---');
            lines.push('');
        });

        return lines.join('\n');
    }

    private getLanguage(notebook: any): string {
        const language = notebook.metadata?.language_info?.name;
        if (language) {
            return language === 'python' ? 'python' : language;
        }
        return 'python'; // Default for most notebooks
    }
}

// Register the tool
ToolRegistry.registerTool(NotebookReadTool);