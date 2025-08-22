/*---------------------------------------------------------------------------------------------
 * Glob Tool - Fast file pattern matching tool
 * REFACTORED: Removed VSCode dependencies
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult,
    CliTextPart,
    CliExecutionContext
} from '../types/cliTypes';

interface IGlobParams {
    pattern: string;
    path?: string;
    maxResults?: number;
    includeHidden?: boolean;
}

export class GlobTool extends BaseTool<IGlobParams> {
    readonly name = 'glob';
    readonly description = `Find files by name patterns using fast glob matching.

Use when: Locating files by patterns, finding specific file types, or exploring project structure.

Features: Wildcards, directory traversal, extension matching, sorted by modification time.

Examples: Find "**/*.test.js" for tests, "src/**/*.tsx" for React components, "**/package.json" across projects, "*.config.*" files.`;

    readonly tags = ['search', 'core', 'file-search'];
    readonly category = 'search';
    readonly complexity: 'core' = 'core';
    readonly inputSchema = {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Glob pattern to match files against',
                examples: ['**/*.js', 'src/**/*.tsx', '**/package.json', '*.config.*']
            },
            path: {
                type: 'string',
                description: 'Directory to search in (defaults to workspace root)',
                examples: ['src/', 'tests/', '.']
            },
            maxResults: {
                type: 'number',
                description: 'Maximum number of results to return (default: 100)',
                default: 100,
                minimum: 1,
                maximum: 1000
            },
            includeHidden: {
                type: 'boolean',
                description: 'Include hidden files and directories (default: false)',
                default: false
            }
        },
        required: ['pattern']
    };

    async invoke(
        options: CliToolInvocationOptions<IGlobParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { pattern, path: searchPath, maxResults = 100, includeHidden = false } = options.input;

        try {
            return await this.executeGlob(pattern, searchPath, maxResults, includeHidden);
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error during glob search');
        }
    }

    private async executeGlob(
        pattern: string,
        searchPath: string | undefined,
        maxResults: number,
        includeHidden: boolean
    ): Promise<CliToolResult> {
        // Validate workspace
        const workspaceError = this.validateWorkspace();
        if (workspaceError) {
            return this.createErrorResult(workspaceError);
        }

        // Determine search path
        const targetPath = searchPath ? this.resolveFilePath(searchPath) : this.getWorkspaceRoot();

        // Check if search path exists
        try {
            const stats = await fs.promises.stat(targetPath);
            if (!stats.isDirectory()) {
                return this.createErrorResult(`Search path is not a directory: ${searchPath || '.'}`);
            }
        } catch (error) {
            return this.createErrorResult(`Search path not found: ${searchPath || '.'}`);
        }

        // Execute glob search
        const matches = await this.globSearch(targetPath, pattern, maxResults, includeHidden);

        if (matches.length === 0) {
            return this.createSuccessResult(
                { pattern, searchPath: targetPath, matchCount: 0 },
                `No files found matching pattern: "${pattern}"`
            );
        }

        // Sort by modification time (newest first)
        matches.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

        // Format output
        const summary = this.formatGlobResults(pattern, targetPath, matches);

        return this.createSuccessResult({
            pattern,
            searchPath: targetPath,
            matchCount: matches.length,
            files: matches.map(m => m.path)
        }, summary);
    }

    private async globSearch(
        basePath: string,
        pattern: string,
        maxResults: number,
        includeHidden: boolean
    ): Promise<Array<{ path: string; mtime: Date; size: number; isDirectory: boolean }>> {
        const results: Array<{ path: string; mtime: Date; size: number; isDirectory: boolean }> = [];
        const regex = this.globToRegex(pattern);
        
        await this.searchRecursive(basePath, '', regex, results, maxResults, includeHidden);
        
        return results;
    }

    private async searchRecursive(
        currentPath: string,
        relativePath: string,
        regex: RegExp,
        results: Array<{ path: string; mtime: Date; size: number; isDirectory: boolean }>,
        maxResults: number,
        includeHidden: boolean
    ): Promise<void> {
        if (results.length >= maxResults) {
            return;
        }

        try {
            const entries = await fs.promises.readdir(currentPath);

            for (const entry of entries) {
                if (results.length >= maxResults) {
                    break;
                }

                // Skip hidden files/directories if not requested
                if (!includeHidden && entry.startsWith('.')) {
                    continue;
                }

                const entryPath = path.join(currentPath, entry);
                const entryRelativePath = relativePath ? path.join(relativePath, entry) : entry;

                try {
                    const stats = await fs.promises.stat(entryPath);
                    
                    // Check if current path matches pattern
                    if (regex.test(entryRelativePath)) {
                        results.push({
                            path: entryRelativePath,
                            mtime: stats.mtime,
                            size: stats.size,
                            isDirectory: stats.isDirectory()
                        });
                    }

                    // Recurse into directories
                    if (stats.isDirectory()) {
                        await this.searchRecursive(
                            entryPath,
                            entryRelativePath,
                            regex,
                            results,
                            maxResults,
                            includeHidden
                        );
                    }
                } catch (error) {
                    // Skip entries that can't be accessed
                    console.warn(`Warning: Cannot access ${entryPath}`);
                }
            }
        } catch (error) {
            // Skip directories that can't be read
            console.warn(`Warning: Cannot read directory ${currentPath}`);
        }
    }

    private globToRegex(pattern: string): RegExp {
        // Convert glob pattern to regex
        // ** matches any number of directories
        // * matches any characters except /
        // ? matches any single character except /
        
        let regexStr = pattern
            .replace(/\./g, '\\.')  // Escape dots
            .replace(/\*\*/g, '§DOUBLE_STAR§')  // Temporarily replace **
            .replace(/\*/g, '[^/]*')  // * matches anything except /
            .replace(/§DOUBLE_STAR§/g, '.*')  // ** matches anything including /
            .replace(/\?/g, '[^/]');  // ? matches single char except /

        return new RegExp(`^${regexStr}$`);
    }

    private formatGlobResults(
        pattern: string,
        searchPath: string,
        matches: Array<{ path: string; mtime: Date; size: number; isDirectory: boolean }>
    ): string {
        const lines = [`🔍 Found ${matches.length} file${matches.length !== 1 ? 's' : ''} matching "${pattern}"`];
        lines.push(`Search path: ${searchPath}`);
        lines.push(`Sorted by: modification time (newest first)`);
        lines.push('');

        // Group by directory for better readability
        const grouped = new Map<string, Array<{ path: string; mtime: Date; size: number; isDirectory: boolean }>>();
        
        for (const match of matches) {
            const dir = path.dirname(match.path);
            if (!grouped.has(dir)) {
                grouped.set(dir, []);
            }
            grouped.get(dir)!.push(match);
        }

        // Display results
        for (const [dir, files] of grouped) {
            if (dir !== '.') {
                lines.push(`📁 ${dir}/`);
            }
            
            for (const file of files) {
                const fileName = path.basename(file.path);
                const icon = file.isDirectory ? '📁' : '📄';
                const sizeStr = file.isDirectory ? '' : ` (${this.formatFileSize(file.size)})`;
                const timeStr = file.mtime.toISOString().slice(0, 16).replace('T', ' ');
                
                lines.push(`  ${icon} ${fileName}${sizeStr} - ${timeStr}`);
            }
            
            if (dir !== '.' && Array.from(grouped.keys()).indexOf(dir) < Array.from(grouped.keys()).length - 1) {
                lines.push('');
            }
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
ToolRegistry.getInstance().registerTool(GlobTool);