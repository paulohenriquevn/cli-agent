/*---------------------------------------------------------------------------------------------
 * Grep Tool - Search for text patterns in files with fallback support
 * REFACTORED: Removed VSCode dependencies, added fallback implementations
 *--------------------------------------------------------------------------------------------*/

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult
} from '../types/cliTypes';

const execAsync = promisify(exec);

type SearchEngine = 'ripgrep' | 'grep' | 'javascript';

interface SearchMatch {
    file: string;
    line: number;
    content: string;
    beforeContext?: string[];
    afterContext?: string[];
}

interface SearchResult {
    matches: SearchMatch[];
    totalCount: number;
    engine: SearchEngine;
}

interface IGrepParams {
    pattern: string;
    path?: string;
    caseSensitive?: boolean;
    outputMode?: 'content' | 'files_with_matches' | 'count';
    contextLines?: number;
    filePattern?: string;
    maxResults?: number;
    [key: string]: unknown;
}

export class GrepTool extends BaseTool<IGrepParams> {
    readonly name = 'grep';
    readonly description = `Search for text patterns in files with automatic fallback support.

Use when: Finding code patterns, searching for functions, locating specific text across multiple files.

Features: Regex patterns, file type filtering, context lines, case sensitivity control.
Fallback: Automatically uses ripgrep → grep → JavaScript implementation based on availability.

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

        // Try different search engines with fallback
        const engines: SearchEngine[] = ['ripgrep', 'grep', 'javascript'];
        let lastError: string | null = null;

        for (const engine of engines) {
            try {
                if (token.isCancellationRequested) {
                    return this.createErrorResult('Search was cancelled');
                }

                const result = await this.searchWithEngine(
                    engine,
                    pattern,
                    targetPath,
                    caseSensitive,
                    contextLines,
                    filePattern,
                    maxResults,
                    token
                );

                if (result) {
                    return this.formatSearchResult(result, pattern, targetPath, outputMode, filePattern, caseSensitive);
                }
            } catch (error) {
                lastError = error instanceof Error ? error.message : `${engine} search failed`;
                // Continue to next engine on failure
                continue;
            }
        }

        return this.createErrorResult(`All search engines failed. Last error: ${lastError}`);
    }

    private async searchWithEngine(
        engine: SearchEngine,
        pattern: string,
        targetPath: string,
        caseSensitive: boolean,
        contextLines: number | undefined,
        filePattern: string | undefined,
        maxResults: number,
        token: CliCancellationToken
    ): Promise<SearchResult | null> {
        switch (engine) {
            case 'ripgrep':
                return await this.searchWithRipgrep(pattern, targetPath, caseSensitive, contextLines, filePattern, maxResults, token);
            case 'grep':
                return await this.searchWithGrep(pattern, targetPath, caseSensitive, contextLines, filePattern, maxResults, token);
            case 'javascript':
                return await this.searchWithJavaScript(pattern, targetPath, caseSensitive, contextLines, filePattern, maxResults, token);
            default:
                return null;
        }
    }

    private async searchWithRipgrep(
        pattern: string,
        targetPath: string,
        caseSensitive: boolean,
        contextLines: number | undefined,
        filePattern: string | undefined,
        maxResults: number,
        token: CliCancellationToken
    ): Promise<SearchResult | null> {
        // Check if ripgrep is available
        if (!await this.isCommandAvailable('rg')) {
            throw new Error('ripgrep (rg) not available');
        }

        const rgArgs: string[] = [];
        
        // Case sensitivity
        if (!caseSensitive) {
            rgArgs.push('-i');
        }

        // Always show line numbers for parsing
        rgArgs.push('-n');
        
        // Context lines
        if (contextLines !== undefined && contextLines > 0) {
            rgArgs.push(`-C ${contextLines}`);
        }

        // File pattern filtering
        if (filePattern) {
            rgArgs.push(`--glob "${filePattern}"`);
        }

        // Limit results
        rgArgs.push(`--max-count ${maxResults}`);
        rgArgs.push('--color never');

        const escapedPattern = pattern.replace(/"/g, '\\"');
        const command = `rg ${rgArgs.join(' ')} "${escapedPattern}" "${targetPath}"`;

        // Execute ripgrep command

        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());

        try {
            const result = await execAsync(command, {
                cwd: this.getWorkspaceRoot(),
                maxBuffer: 1024 * 1024,
                signal: controller.signal,
                timeout: 30000
            });

            return this.parseRipgrepOutput(result.stdout, contextLines);
        } catch (error: any) {
            // ripgrep returns exit code 1 when no matches found
            if (error.code === 1 && !error.stderr) {
                return { matches: [], totalCount: 0, engine: 'ripgrep' };
            }
            throw error;
        }
    }

    private async searchWithGrep(
        pattern: string,
        targetPath: string,
        caseSensitive: boolean,
        contextLines: number | undefined,
        filePattern: string | undefined,
        maxResults: number,
        token: CliCancellationToken
    ): Promise<SearchResult | null> {
        // Check if grep is available
        if (!await this.isCommandAvailable('grep')) {
            throw new Error('grep not available');
        }

        const grepArgs: string[] = [];
        
        // Case sensitivity
        if (!caseSensitive) {
            grepArgs.push('-i');
        }

        // Recursive search
        grepArgs.push('-r');
        
        // Show line numbers
        grepArgs.push('-n');
        
        // Context lines
        if (contextLines !== undefined && contextLines > 0) {
            grepArgs.push(`-C ${contextLines}`);
        }

        // File pattern filtering (limited support with grep)
        let findPattern = '';
        if (filePattern) {
            // Convert simple glob patterns to find-compatible patterns
            const findGlob = filePattern.replace(/\*/g, '*').replace(/\?/g, '?');
            findPattern = `find "${targetPath}" -name "${findGlob}" -type f -exec `;
        }

        const escapedPattern = pattern.replace(/"/g, '\\"');
        let command: string;
        
        if (findPattern) {
            command = `${findPattern}grep ${grepArgs.join(' ')} "${escapedPattern}" {} + | head -n ${maxResults}`;
        } else {
            command = `grep ${grepArgs.join(' ')} "${escapedPattern}" "${targetPath}" 2>/dev/null | head -n ${maxResults}`;
        }

        // Execute grep command

        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());

        try {
            const result = await execAsync(command, {
                cwd: this.getWorkspaceRoot(),
                maxBuffer: 1024 * 1024,
                signal: controller.signal,
                timeout: 30000
            });

            return this.parseGrepOutput(result.stdout, contextLines);
        } catch (error: any) {
            // grep returns exit code 1 when no matches found
            if (error.code === 1) {
                return { matches: [], totalCount: 0, engine: 'grep' };
            }
            throw error;
        }
    }

    private async searchWithJavaScript(
        pattern: string,
        targetPath: string,
        caseSensitive: boolean,
        contextLines: number | undefined,
        filePattern: string | undefined,
        maxResults: number,
        token: CliCancellationToken
    ): Promise<SearchResult> {
        // Execute JavaScript-based search
        
        const matches: SearchMatch[] = [];
        const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
        const fileGlobRegex = filePattern ? this.globToRegex(filePattern) : null;

        await this.searchDirectory(
            targetPath,
            '',
            regex,
            fileGlobRegex,
            contextLines || 0,
            matches,
            maxResults,
            token
        );

        return { matches, totalCount: matches.length, engine: 'javascript' };
    }

    private async searchDirectory(
        currentPath: string,
        relativePath: string,
        regex: RegExp,
        fileGlobRegex: RegExp | null,
        contextLines: number,
        matches: SearchMatch[],
        maxResults: number,
        token: CliCancellationToken
    ): Promise<void> {
        if (matches.length >= maxResults || token.isCancellationRequested) {
            return;
        }

        try {
            const entries = await fs.promises.readdir(currentPath);

            for (const entry of entries) {
                if (matches.length >= maxResults || token.isCancellationRequested) {
                    break;
                }

                // Skip hidden files and common ignore patterns
                if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'build') {
                    continue;
                }

                const entryPath = path.join(currentPath, entry);
                const entryRelativePath = relativePath ? path.join(relativePath, entry) : entry;

                try {
                    const stats = await fs.promises.stat(entryPath);
                    
                    if (stats.isDirectory()) {
                        await this.searchDirectory(
                            entryPath,
                            entryRelativePath,
                            regex,
                            fileGlobRegex,
                            contextLines,
                            matches,
                            maxResults,
                            token
                        );
                    } else if (stats.isFile()) {
                        // Check file pattern match
                        if (fileGlobRegex && !fileGlobRegex.test(entryRelativePath)) {
                            continue;
                        }

                        // Skip binary files
                        if (!this.isTextFile(entry)) {
                            continue;
                        }

                        await this.searchFile(entryPath, entryRelativePath, regex, contextLines, matches, maxResults - matches.length);
                    }
                } catch {
                    // Skip files that can't be accessed
                    continue;
                }
            }
        } catch {
            // Skip directories that can't be read
            return;
        }
    }

    private async searchFile(
        filePath: string,
        relativePath: string,
        regex: RegExp,
        contextLines: number,
        matches: SearchMatch[],
        remainingResults: number
    ): Promise<void> {
        if (remainingResults <= 0) {
            return;
        }

        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length && matches.length < matches.length + remainingResults; i++) {
                const line = lines[i];
                if (regex.test(line)) {
                    const beforeContext: string[] = [];
                    const afterContext: string[] = [];
                    
                    if (contextLines > 0) {
                        // Get context lines
                        for (let j = Math.max(0, i - contextLines); j < i; j++) {
                            beforeContext.push(lines[j]);
                        }
                        for (let j = i + 1; j < Math.min(lines.length, i + 1 + contextLines); j++) {
                            afterContext.push(lines[j]);
                        }
                    }

                    matches.push({
                        file: relativePath,
                        line: i + 1,
                        content: line,
                        beforeContext: beforeContext.length > 0 ? beforeContext : undefined,
                        afterContext: afterContext.length > 0 ? afterContext : undefined
                    });
                }
            }
        } catch {
            // Skip files that can't be read
            return;
        }
    }

    private async isCommandAvailable(command: string): Promise<boolean> {
        try {
            await execAsync(`which ${command}`, { timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }

    private globToRegex(pattern: string): RegExp {
        const regexStr = pattern
            .replace(/\./g, '\\.') 
            .replace(/\*\*/g, '§DOUBLE_STAR§')  
            .replace(/\*/g, '[^/]*')  
            .replace(/§DOUBLE_STAR§/g, '.*')  
            .replace(/\?/g, '[^/]');  

        return new RegExp(`^${regexStr}$`);
    }

    private isTextFile(filename: string): boolean {
        const textExtensions = [
            '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.css', '.scss', '.less',
            '.html', '.htm', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
            '.py', '.rb', '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.php',
            '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.sql', '.graphql',
            '.vue', '.svelte', '.elm', '.dart', '.kt', '.scala', '.clj', '.ex', '.exs'
        ];
        
        const ext = path.extname(filename).toLowerCase();
        return textExtensions.includes(ext) || !ext; // Include files without extensions
    }

    private parseRipgrepOutput(output: string, contextLines?: number): SearchResult {
        const matches: SearchMatch[] = [];
        const lines = output.split('\n').filter(line => line.trim());
        
        let currentMatch: Partial<SearchMatch> = {};
        let contextBuffer: string[] = [];
        let isAfterContext = false;

        for (const line of lines) {
            if (line.includes('--')) {
                // Separator line, reset context
                if (currentMatch.file && currentMatch.line && currentMatch.content) {
                    matches.push(currentMatch as SearchMatch);
                }
                currentMatch = {};
                contextBuffer = [];
                isAfterContext = false;
                continue;
            }

            const match = line.match(/^([^:]+):(\d+):(.*)$/) || line.match(/^([^:]+)-(\d+)-(.*)$/);
            if (match) {
                const [, file, lineNum, content] = match;
                const isMainMatch = line.includes(':');
                
                if (isMainMatch) {
                    if (currentMatch.file && currentMatch.line && currentMatch.content) {
                        matches.push(currentMatch as SearchMatch);
                    }
                    currentMatch = {
                        file,
                        line: parseInt(lineNum, 10),
                        content,
                        beforeContext: contextBuffer.length > 0 ? [...contextBuffer] : undefined
                    };
                    contextBuffer = [];
                    isAfterContext = true;
                } else {
                    // Context line
                    if (isAfterContext && currentMatch.file) {
                        if (!currentMatch.afterContext) {
                            currentMatch.afterContext = [];
                        }
                        currentMatch.afterContext.push(content);
                    } else {
                        contextBuffer.push(content);
                    }
                }
            }
        }

        // Add the last match
        if (currentMatch.file && currentMatch.line && currentMatch.content) {
            matches.push(currentMatch as SearchMatch);
        }

        return { matches, totalCount: matches.length, engine: 'ripgrep' };
    }

    private parseGrepOutput(output: string, contextLines?: number): SearchResult {
        const matches: SearchMatch[] = [];
        const lines = output.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            const match = line.match(/^([^:]+):(\d+):(.*)$/);
            if (match) {
                const [, file, lineNum, content] = match;
                matches.push({
                    file,
                    line: parseInt(lineNum, 10),
                    content
                });
            }
        }

        return { matches, totalCount: matches.length, engine: 'grep' };
    }

    private formatSearchResult(
        result: SearchResult,
        pattern: string,
        targetPath: string,
        outputMode: string,
        filePattern?: string,
        caseSensitive?: boolean
    ): CliToolResult {
        if (result.matches.length === 0) {
            return this.createSuccessResult(
                { pattern, matchCount: 0, searchPath: targetPath, engine: result.engine },
                `No matches found for pattern: "${pattern}" using ${result.engine}`
            );
        }

        let formattedOutput: string;
        const matchCount = result.matches.length;

        switch (outputMode) {
            case 'files_with_matches': {
                const uniqueFiles = [...new Set(result.matches.map(m => m.file))];
                formattedOutput = `Files containing "${pattern}":\n${uniqueFiles.map(file => `📄 ${file}`).join('\n')}`;
                break;
            }
            case 'count': {
                const fileCounts = new Map<string, number>();
                result.matches.forEach(m => {
                    fileCounts.set(m.file, (fileCounts.get(m.file) || 0) + 1);
                });
                const countLines = Array.from(fileCounts.entries()).map(([file, count]) => `📄 ${file}: ${count} matches`);
                formattedOutput = `Match counts for "${pattern}":\n${countLines.join('\n')}`;
                break;
            }
            case 'content':
            default: {
                const contentLines: string[] = [];
                let currentFile = '';
                
                result.matches.forEach(match => {
                    if (match.file !== currentFile) {
                        if (currentFile) contentLines.push('');
                        contentLines.push(`📄 ${match.file}`);
                        currentFile = match.file;
                    }
                    
                    // Add before context
                    if (match.beforeContext) {
                        match.beforeContext.forEach(line => {
                            contentLines.push(`  ${line}`);
                        });
                    }
                    
                    // Add main match
                    contentLines.push(`  ${match.line}: ${match.content}`);
                    
                    // Add after context
                    if (match.afterContext) {
                        match.afterContext.forEach(line => {
                            contentLines.push(`  ${line}`);
                        });
                    }
                });
                
                formattedOutput = `Search results for "${pattern}":\n\n${contentLines.join('\n')}`;
                break;
            }
        }

        const summary = `🔍 Found ${matchCount} result${matchCount !== 1 ? 's' : ''} for "${pattern}" using ${result.engine}
Search path: ${targetPath}
${filePattern ? `File pattern: ${filePattern}` : ''}
${caseSensitive ? 'Case sensitive' : 'Case insensitive'}

${formattedOutput}`;

        return this.createSuccessResult({
            pattern,
            matchCount,
            searchPath: targetPath,
            outputMode,
            engine: result.engine,
            results: result.matches.map(m => `${m.file}:${m.line}:${m.content}`)
        }, summary);
    }
}

// Auto-register the tool
ToolRegistry.registerTool(GrepTool);