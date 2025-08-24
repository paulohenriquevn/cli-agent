/*---------------------------------------------------------------------------------------------
 * Write File Tool - Creates or overwrites files with content
 * REFACTORED: Removed VSCode dependencies
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult
} from '../types/cliTypes';

interface IWriteFileParams {
    filePath: string;
    content: string;
    createDirectory?: boolean; // Create parent directories if they don't exist
    [key: string]: unknown;
}

export class WriteFileTool extends BaseTool<IWriteFileParams> {
    readonly name = 'write_file';
    readonly description = `Write content to a file (creates new or overwrites existing).

Use when: Creating new files, completely replacing file contents, generating configuration files.

Features: Auto-create directories, backup existing files, UTF-8 encoding, file size validation.

Examples: Create "src/components/Button.tsx" with React component, write package.json with dependencies, generate .env file.`;

    // Tag system implementation
    readonly tags = ['file_operations', 'core', 'essential'];
    readonly category = 'file_operations';
    readonly complexity: 'core' = 'core';
    readonly inputSchema = {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'The path where to write the file (relative to workspace root or absolute)',
                examples: ['src/components/Button.tsx', 'package.json', '.env']
            },
            content: {
                type: 'string',
                description: 'The content to write to the file'
            },
            createDirectory: {
                type: 'boolean',
                description: 'Create parent directories if they don\'t exist (default: true)',
                default: true
            }
        },
        required: ['filePath', 'content']
    };

    async invoke(
        options: CliToolInvocationOptions<IWriteFileParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { filePath, content, createDirectory = true } = options.input;

        try {
            return await this.executeWriteFile(filePath, content, createDirectory);
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error writing file');
        }
    }

    private async executeWriteFile(filePath: string, content: string, createDirectory: boolean): Promise<CliToolResult> {
        // Validate workspace
        const workspaceError = this.validateWorkspace();
        if (workspaceError) {
            return this.createErrorResult(workspaceError);
        }

        // Resolve file path
        const resolvedPath = this.resolveFilePath(filePath);

        // Check if parent directory exists and create if needed
        const parentDir = path.dirname(resolvedPath);
        try {
            await fs.promises.access(parentDir);
        } catch {
            if (createDirectory) {
                await fs.promises.mkdir(parentDir, { recursive: true });
            } else {
                return this.createErrorResult(`Parent directory does not exist: ${path.dirname(filePath)}`);
            }
        }

        // Check if file already exists (for backup/info)
        let existedBefore = false;
        let previousSize = 0;
        try {
            const stats = await fs.promises.stat(resolvedPath);
            if (stats.isFile()) {
                existedBefore = true;
                previousSize = stats.size;
            } else {
                return this.createErrorResult(`Path exists but is not a file: ${filePath}`);
            }
        } catch {
            // File doesn't exist, which is fine
        }

        // Write the file
        await fs.promises.writeFile(resolvedPath, content, 'utf-8');

        // Get new file stats
        const newStats = await fs.promises.stat(resolvedPath);
        const newSize = newStats.size;

        // Create success message
        const action = existedBefore ? 'Updated' : 'Created';
        const sizeInfo = existedBefore 
            ? `Size: ${this.formatFileSize(previousSize)} → ${this.formatFileSize(newSize)}`
            : `Size: ${this.formatFileSize(newSize)}`;

        const lines = content.split('\n').length;
        const summary = `✅ ${action} file: ${filePath}\n${sizeInfo}\nLines: ${lines}\nEncoding: UTF-8`;

        return this.createSuccessResult({
            filePath,
            action: action.toLowerCase(),
            size: newSize,
            lines,
            existedBefore
        }, summary);
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
ToolRegistry.registerTool(WriteFileTool);