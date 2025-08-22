/*---------------------------------------------------------------------------------------------
 * Grep Tool - Search for text patterns in files using ripgrep
 * REFACTORED: Removed VSCode dependencies
 *--------------------------------------------------------------------------------------------*/

import { exec } from 'child_process';
import { promisify } from 'util';
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

const execAsync = promisify(exec);

interface IGrepParams {
    pattern: string;
    path?: string;
    caseSensitive?: boolean;
    outputMode?: 'content' | 'files_with_matches' | 'count';
    contextLines?: number;
    filePattern?: string;
    maxResults?: number;
}

export class GrepTool extends BaseTool<IGrepParams> {
    readonly name = 'grep';
    readonly description = `Search for text patterns in files using ripgrep.

Use when: Finding code patterns, searching for functions, locating specific text across multiple files.

Features: Regex patterns, file type filtering, context lines, case sensitivity control.

Examples: Find "function main", search "TODO" comments, locate imports, find error messages.`;

    readonly tags = ['search', 'core', 'text-processing'];
    readonly category = 'search';
    readonly complexity: 'core' = 'core';
    readonly inputSchema = {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'The text pattern or regex to search for',
                examples: ['function main', 'TODO:', 'import.*from', 'error']
            },
            path: {
                type: 'string',
                description: 'Directory or file to search in (defaults to workspace root)',
                examples: ['src/', 'src/components', 'package.json']
            },
            caseSensitive: {
                type: 'boolean',
                description: 'Whether search should be case sensitive (default: false)',
                default: false
            },
            outputMode: {
                type: 'string',
                enum: ['content', 'files_with_matches', 'count'],
                description: 'Output format: content (show matches), files_with_matches (file paths), count (match counts)',
                default: 'content'
            },
            contextLines: {
                type: 'number',
                description: 'Number of context lines to show around matches',
                minimum: 0,
                maximum: 10
            },
            filePattern: {
                type: 'string',
                description: 'File pattern to filter (e.g., "*.js", "*.{ts,tsx}")',
                examples: ['*.js', '*.{ts,tsx}', '*.json']
            },
            maxResults: {
                type: 'number',
                description: 'Maximum number of results to return (default: 100)',
                default: 100,
                minimum: 1,
                maximum: 1000
            }
        },
        required: ['pattern']
    };

    async invoke(
        options: CliToolInvocationOptions<IGrepParams>,
        token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { 
            pattern, 
            path: searchPath, 
            caseSensitive = false,
            outputMode = 'content',
            contextLines,
            filePattern,
            maxResults = 100
        } = options.input;

        try {
            return await this.executeGrep(
                pattern, 
                searchPath, 
                caseSensitive, 
                outputMode, 
                contextLines, 
                filePattern, 
                maxResults,
                token
            );
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error during search');
        }
    }

    private async executeGrep(
        pattern: string,
        searchPath: string | undefined,
        caseSensitive: boolean,
        outputMode: string,
        contextLines: number | undefined,
        filePattern: string | undefined,
        maxResults: number,
        token: CliCancellationToken
    ): Promise<CliToolResult> {
        // Validate workspace
        const workspaceError = this.validateWorkspace();
        if (workspaceError) {
            return this.createErrorResult(workspaceError);
        }

        // Determine search path
        const targetPath = searchPath ? this.resolveFilePath(searchPath) : this.getWorkspaceRoot();

        // Build ripgrep command
        const rgArgs: string[] = [];

        // Case sensitivity
        if (!caseSensitive) {
            rgArgs.push('-i');
        }

        // Output mode
        switch (outputMode) {
            case 'files_with_matches':
                rgArgs.push('-l');
                break;
            case 'count':
                rgArgs.push('-c');
                break;
            case 'content':
            default:
                rgArgs.push('-n'); // Show line numbers
                if (contextLines !== undefined && contextLines > 0) {
                    rgArgs.push(`-C ${contextLines}`);
                }
                break;
        }

        // File pattern filtering
        if (filePattern) {
            rgArgs.push(`--glob "${filePattern}"`);
        }

        // Limit results
        rgArgs.push(`--max-count ${maxResults}`);

        // Add color for better readability
        rgArgs.push('--color never');

        // Escape pattern for shell
        const escapedPattern = pattern.replace(/"/g, '\\"');
        
        const command = `rg ${rgArgs.join(' ')} "${escapedPattern}" "${targetPath}"`;

        console.log(`🔍 Searching with: ${command}`);

        try {
            // Handle cancellation
            if (token.isCancellationRequested) {
                return this.createErrorResult('Search was cancelled');
            }

            const controller = new AbortController();
            token.onCancellationRequested(() => controller.abort());

            const result = await execAsync(command, {
                cwd: this.getWorkspaceRoot(),
                maxBuffer: 1024 * 1024, // 1MB buffer
                signal: controller.signal,
                timeout: 30000 // 30 second timeout
            });

            const output = result.stdout.trim();
            const errorOutput = result.stderr.trim();

            if (!output && !errorOutput) {
                return this.createSuccessResult(
                    { pattern, matchCount: 0, searchPath: targetPath },
                    `No matches found for pattern: "${pattern}"`
                );
            }

            // Count matches
            const lines = output.split('\n').filter(line => line.trim());
            const matchCount = lines.length;

            // Format output based on mode
            let formattedOutput: string;
            switch (outputMode) {
                case 'files_with_matches':
                    formattedOutput = `Files containing "${pattern}":\n${lines.map(file => `📄 ${file}`).join('\n')}`;
                    break;
                case 'count':
                    formattedOutput = `Match counts for "${pattern}":\n${lines.map(line => {
                        const [file, count] = line.split(':');
                        return `📄 ${file}: ${count} matches`;
                    }).join('\n')}`;
                    break;
                case 'content':
                default:
                    formattedOutput = `Search results for "${pattern}":\n\n${output}`;
                    break;
            }

            const summary = `🔍 Found ${matchCount} result${matchCount !== 1 ? 's' : ''} for "${pattern}"
Search path: ${targetPath}
${filePattern ? `File pattern: ${filePattern}` : ''}
${caseSensitive ? 'Case sensitive' : 'Case insensitive'}

${formattedOutput}`;

            return this.createSuccessResult({
                pattern,
                matchCount,
                searchPath: targetPath,
                outputMode,
                results: lines
            }, summary);

        } catch (error: any) {
            // Handle ripgrep not found
            if (error.code === 'ENOENT') {
                return this.createErrorResult('ripgrep (rg) not found. Please install ripgrep first.');
            }

            // Handle no matches (ripgrep exits with code 1 when no matches)
            if (error.code === 1 && !error.stderr) {
                return this.createSuccessResult(
                    { pattern, matchCount: 0, searchPath: targetPath },
                    `No matches found for pattern: "${pattern}"`
                );
            }

            // Handle cancellation
            if (error.signal === 'SIGTERM' || error.code === 'ABORT_ERR') {
                return this.createErrorResult('Search was cancelled');
            }

            return this.createErrorResult(`Search failed: ${error.message}`);
        }
    }
}

// Auto-register the tool
ToolRegistry.getInstance().registerTool(GrepTool);