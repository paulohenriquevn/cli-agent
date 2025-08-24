/*---------------------------------------------------------------------------------------------
 * Read File Tool - Reads content from files
 * REFACTORED: Removed VSCode dependencies
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult
} from '../types/cliTypes';

interface IReadFileParams {
    filePath: string;
    offset?: number;  // Line to start reading from (1-indexed)
    limit?: number;   // Maximum number of lines to read
}

export class ReadFileTool extends BaseTool<IReadFileParams> {
    readonly name = 'read_file';
    readonly description = `Read file contents with optional line range.

Use when: Examining existing code, configuration files, or any text-based files before making changes.

Features: Line range support, large file handling, syntax highlighting in output.

Examples: Read "src/main.js" entirely, read lines 10-30 from large file, inspect package.json structure.`;

    // Tag system implementation
    readonly tags = ['file_operations', 'core', 'essential'];
    readonly category = 'file_operations';
    readonly complexity: 'essential' = 'essential';
    readonly inputSchema = {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'The path to the file to read (relative to workspace root or absolute)',
                examples: ['src/main.ts', 'package.json', 'README.md']
            },
            offset: {
                type: 'number',
                description: 'The line number to start reading from (1-indexed, optional)',
                minimum: 1
            },
            limit: {
                type: 'number',
                description: 'The maximum number of lines to read (optional)',
                minimum: 1
            }
        },
        required: ['filePath']
    };

    async invoke(
        options: CliToolInvocationOptions<IReadFileParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { filePath, offset, limit } = options.input;

        try {
            return await this.executeReadFile(filePath, offset, limit);
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error reading file');
        }
    }

    private async executeReadFile(filePath: string, offset?: number, limit?: number): Promise<CliToolResult> {
        // Validate workspace
        const workspaceError = this.validateWorkspace();
        if (workspaceError) {
            return this.createErrorResult(workspaceError);
        }

        // Resolve file path
        const resolvedPath = this.resolveFilePath(filePath);

        // Check if file exists
        if (!await this.fileExists(filePath)) {
            return this.createErrorResult(`File not found: ${filePath}`);
        }

        // Check if it's a file (not directory)
        const stats = await fs.promises.stat(resolvedPath);
        if (!stats.isFile()) {
            return this.createErrorResult(`Path is not a file: ${filePath}`);
        }

        // Read file content
        const content = await fs.promises.readFile(resolvedPath, 'utf-8');
        const lines = content.split('\n');

        let resultLines: string[];
        let lineInfo = '';

        if (offset || limit) {
            const startLine = (offset || 1) - 1; // Convert to 0-indexed
            const endLine = limit ? startLine + limit : lines.length;
            
            resultLines = lines.slice(startLine, endLine);
            lineInfo = ` (lines ${offset || 1}-${Math.min((offset || 1) + (limit || lines.length) - 1, lines.length)})`;
        } else {
            resultLines = lines;
        }

        // Format output with line numbers
        const numberedLines = resultLines.map((line, index) => {
            const lineNum = (offset || 1) + index;
            return `${lineNum.toString().padStart(4, ' ')}→${line}`;
        }).join('\n');

        const summary = `File: ${filePath}${lineInfo}\nTotal lines: ${lines.length}\nFile size: ${this.formatFileSize(stats.size)}\n\n${numberedLines}`;

        return this.createSuccessResult(null, summary);
    }

    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
}

// Auto-register the tool
ToolRegistry.registerTool(ReadFileTool);