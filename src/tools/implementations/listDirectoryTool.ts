/*---------------------------------------------------------------------------------------------
 * List Directory Tool - List files and directories
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

interface IListDirectoryParams {
    path: string;
    ignore?: string[];
    showHidden?: boolean;
    recursive?: boolean;
    maxDepth?: number;
}

export class ListDirectoryTool extends BaseTool<IListDirectoryParams> {
    readonly name = 'ls';
    readonly description = `List files and directories (like 'ls' command).

Use when: Exploring project structure, finding files, or checking directory contents before operations.

Features: Recursive listing, hidden files control, ignore patterns, file size and type info.

Examples: List "src/" directory, show all files recursively, ignore node_modules, explore project structure.`;

    readonly tags = ['file_operations', 'navigation', 'core'];
    readonly category = 'file_operations';
    readonly complexity: 'core' = 'core';
    readonly inputSchema = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The directory path to list (relative to workspace root or absolute)',
                examples: ['src/', 'src/components', '.', '/home/user/project']
            },
            ignore: {
                type: 'array',
                items: { type: 'string' },
                description: 'Glob patterns to ignore',
                examples: [['node_modules', '*.log', '.git'], ['dist', 'build']]
            },
            showHidden: {
                type: 'boolean',
                description: 'Show hidden files and directories (starting with .)',
                default: false
            },
            recursive: {
                type: 'boolean',
                description: 'List directories recursively',
                default: false
            },
            maxDepth: {
                type: 'number',
                description: 'Maximum depth for recursive listing (default: 3)',
                default: 3,
                minimum: 1,
                maximum: 10
            }
        },
        required: ['path']
    };

    async invoke(
        options: CliToolInvocationOptions<IListDirectoryParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { 
            path: dirPath, 
            ignore = [], 
            showHidden = false, 
            recursive = false, 
            maxDepth = 3 
        } = options.input;

        try {
            return await this.executeListDirectory(dirPath, ignore, showHidden, recursive, maxDepth);
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error listing directory');
        }
    }

    private async executeListDirectory(
        dirPath: string,
        ignore: string[],
        showHidden: boolean,
        recursive: boolean,
        maxDepth: number
    ): Promise<CliToolResult> {
        // Validate workspace
        const workspaceError = this.validateWorkspace();
        if (workspaceError) {
            return this.createErrorResult(workspaceError);
        }

        // Resolve directory path
        const resolvedPath = this.resolveFilePath(dirPath);

        // Check if directory exists
        try {
            const stats = await fs.promises.stat(resolvedPath);
            if (!stats.isDirectory()) {
                return this.createErrorResult(`Path is not a directory: ${dirPath}`);
            }
        } catch {
            return this.createErrorResult(`Directory not found: ${dirPath}`);
        }

        // Get directory listing
        const results = await this.listDirectoryRecursive(
            resolvedPath,
            '',
            ignore,
            showHidden,
            recursive,
            maxDepth,
            0
        );

        // Format output
        const summary = this.formatDirectoryListing(dirPath, results, recursive);

        return this.createSuccessResult({
            path: dirPath,
            totalItems: results.length,
            directories: results.filter(item => item.type === 'directory').length,
            files: results.filter(item => item.type === 'file').length,
            recursive,
            showHidden
        }, summary);
    }

    private async listDirectoryRecursive(
        currentPath: string,
        relativePath: string,
        ignore: string[],
        showHidden: boolean,
        recursive: boolean,
        maxDepth: number,
        currentDepth: number
    ): Promise<Array<{
        name: string;
        type: 'file' | 'directory';
        size: number;
        relativePath: string;
        depth: number;
    }>> {
        const results: Array<{
            name: string;
            type: 'file' | 'directory';
            size: number;
            relativePath: string;
            depth: number;
        }> = [];

        try {
            const entries = await fs.promises.readdir(currentPath);

            for (const entry of entries) {
                // Skip hidden files if not requested
                if (!showHidden && entry.startsWith('.')) {
                    continue;
                }

                // Check ignore patterns
                if (this.shouldIgnore(entry, ignore)) {
                    continue;
                }

                const entryPath = path.join(currentPath, entry);
                const entryRelativePath = relativePath ? path.join(relativePath, entry) : entry;

                try {
                    const stats = await fs.promises.stat(entryPath);
                    
                    const item = {
                        name: entry,
                        type: stats.isDirectory() ? 'directory' as const : 'file' as const,
                        size: stats.size,
                        relativePath: entryRelativePath,
                        depth: currentDepth
                    };

                    results.push(item);

                    // Recursive listing for directories
                    if (recursive && stats.isDirectory() && currentDepth < maxDepth) {
                        const subResults = await this.listDirectoryRecursive(
                            entryPath,
                            entryRelativePath,
                            ignore,
                            showHidden,
                            recursive,
                            maxDepth,
                            currentDepth + 1
                        );
                        results.push(...subResults);
                    }
                } catch {
                    // Skip entries that can't be accessed
                    console.warn(`Warning: Cannot access ${entryPath}`);
                }
            }
        } catch (error) {
            throw new Error(`Cannot read directory ${currentPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return results.sort((a, b) => {
            // Directories first, then files, then alphabetical
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
    }

    private shouldIgnore(name: string, ignorePatterns: string[]): boolean {
        return ignorePatterns.some(pattern => {
            // Simple glob pattern matching
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                return regex.test(name);
            }
            return name === pattern;
        });
    }

    private formatDirectoryListing(
        dirPath: string,
        items: Array<{
            name: string;
            type: 'file' | 'directory';
            size: number;
            relativePath: string;
            depth: number;
        }>,
        recursive: boolean
    ): string {
        const lines = [`📁 Directory listing: ${dirPath}`];
        
        if (items.length === 0) {
            lines.push('(empty directory)');
            return lines.join('\n');
        }

        // Add summary
        const dirs = items.filter(item => item.type === 'directory').length;
        const files = items.filter(item => item.type === 'file').length;
        lines.push(`Total: ${items.length} items (${dirs} directories, ${files} files)`);
        lines.push('');

        // Add items
        for (const item of items) {
            const indent = recursive ? '  '.repeat(item.depth) : '';
            const icon = item.type === 'directory' ? '📁' : '📄';
            const sizeStr = item.type === 'file' ? ` (${this.formatFileSize(item.size)})` : '';
            
            lines.push(`${indent}${icon} ${item.name}${sizeStr}`);
        }

        return lines.join('\n');
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
ToolRegistry.registerTool(ListDirectoryTool);