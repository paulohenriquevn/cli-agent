/*---------------------------------------------------------------------------------------------
 * Search Code Tool - Advanced code search with intelligent pattern matching
 * Enhanced version with semantic search and context-aware results
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

interface ISearchCodeParams {
    query: string;
    file_pattern?: string;
    include_tests?: boolean;
    case_sensitive?: boolean;
    whole_word?: boolean;
    regex?: boolean;
    max_results?: number;
    context_lines?: number;
    search_type?: 'text' | 'function' | 'class' | 'variable' | 'import';
    [key: string]: unknown;
}

interface ISearchResult {
    file: string;
    line: number;
    column: number;
    match: string;
    context_before: string[];
    context_after: string[];
    match_type: string;
    relevance_score: number;
}

interface ISearchSummary {
    query: string;
    total_matches: number;
    files_searched: number;
    files_with_matches: number;
    search_time_ms: number;
    results: ISearchResult[];
    suggestions: string[];
}

export class SearchCodeTool extends BaseTool<ISearchCodeParams> {
    readonly name = 'search_code';
    readonly description = `Advanced code search with intelligent pattern matching.

Use when: Finding functions, classes, variables, imports, or any code patterns across the project.

Features: Type-specific search, file pattern filtering, context lines, relevance scoring, regex support.

Examples: Find "processData" function, search "UserService" class, locate "apiKey" variable, find "lodash" imports.`;

    // Tag system implementation
    readonly tags = ['search-analysis', 'advanced', 'code-intelligence'];
    readonly category = 'search-analysis';
    readonly complexity: 'advanced' = 'advanced';
    readonly inputSchema = {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Text or pattern to search for in the codebase'
            },
            file_pattern: {
                type: 'string',
                description: 'File pattern to limit search (e.g., "*.ts", "src/**/*.js")',
                default: '*'
            },
            include_tests: {
                type: 'boolean',
                description: 'Include test files in search results',
                default: true
            },
            case_sensitive: {
                type: 'boolean',
                description: 'Perform case-sensitive search',
                default: false
            },
            whole_word: {
                type: 'boolean',
                description: 'Match whole words only',
                default: false
            },
            regex: {
                type: 'boolean',
                description: 'Treat query as regular expression',
                default: false
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 50
            },
            context_lines: {
                type: 'number',
                description: 'Number of context lines before and after match',
                default: 2
            },
            search_type: {
                type: 'string',
                enum: ['text', 'function', 'class', 'variable', 'import'],
                description: 'Type of search to perform',
                default: 'text'
            }
        },
        required: ['query']
    };

    async invoke(
        options: CliToolInvocationOptions<ISearchCodeParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const params = options.input;
        const startTime = Date.now();

        try {
            // Build search pattern based on type and options
            const searchPattern = this.buildSearchPattern(params);

            // Get files to search
            const filesToSearch = await this.getFilesToSearch(params);

            // Perform search
            const results = await this.performSearch(searchPattern, filesToSearch, params);

            // Calculate search summary
            const searchTime = Date.now() - startTime;
            const summary = this.createSearchSummary(params, results, filesToSearch.length, searchTime);

            const response = this.formatSearchResponse(summary);
            return this.createSuccessResult(null, response);

        } catch (_error: any) {
            return this.createErrorResult(`Code search failed: ${_error.message}`);
        }
    }

    private buildSearchPattern(params: ISearchCodeParams): RegExp {
        let pattern = params.query;

        // Add type-specific patterns
        switch (params.search_type) {
            case 'function':
                // Match function declarations
                pattern = params.regex ? pattern : `(function\\s+${this.escapeRegex(pattern)}|const\\s+${this.escapeRegex(pattern)}\\s*=|${this.escapeRegex(pattern)}\\s*\\()`;
                break;
            case 'class':
                // Match class declarations
                pattern = params.regex ? pattern : `(class\\s+${this.escapeRegex(pattern)}|interface\\s+${this.escapeRegex(pattern)})`;
                break;
            case 'variable':
                // Match variable declarations
                pattern = params.regex ? pattern : `(const\\s+${this.escapeRegex(pattern)}|let\\s+${this.escapeRegex(pattern)}|var\\s+${this.escapeRegex(pattern)})`;
                break;
            case 'import':
                // Match import statements
                pattern = params.regex ? pattern : `(import.*${this.escapeRegex(pattern)}|require.*${this.escapeRegex(pattern)})`;
                break;
            case 'text':
            default:
                // Regular text search
                if (!params.regex) {
                    pattern = params.whole_word ? `\\b${this.escapeRegex(pattern)}\\b` : this.escapeRegex(pattern);
                }
                break;
        }

        const flags = params.case_sensitive ? 'g' : 'gi';
        return new RegExp(pattern, flags);
    }

    private async getFilesToSearch(params: ISearchCodeParams): Promise<string[]> {
        const workspaceRoot = this.getWorkspaceRoot();
        const files: string[] = [];

        const filePattern = params.file_pattern || '*';
        const extensions = this.getRelevantExtensions(filePattern);

        await this.walkDirectory(workspaceRoot, files, extensions, params.include_tests !== false);

        return files;
    }

    private getRelevantExtensions(filePattern: string): string[] {
        if (filePattern.includes('*')) {
            // Extract extension from pattern like "*.ts" or "**/*.js"
            const match = filePattern.match(/\*\.(\w+)$/);
            if (match) {
                return [`.${match[1]}`];
            }
        }

        // Default to common code file extensions
        return ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs'];
    }

    private async walkDirectory(
        dir: string,
        files: string[],
        extensions: string[],
        includeTests: boolean
    ): Promise<void> {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    // Skip common non-source directories
                    if (!['node_modules', '.git', 'dist', 'build', '.vscode', 'coverage'].includes(entry.name)) {
                        await this.walkDirectory(fullPath, files, extensions, includeTests);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    const isTestFile = /\.(test|spec)\./i.test(entry.name);

                    if (extensions.includes(ext) && (includeTests || !isTestFile)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch {
            // Skip directories we can't read
        }
    }

    private async performSearch(
        pattern: RegExp,
        filesToSearch: string[],
        params: ISearchCodeParams
    ): Promise<ISearchResult[]> {
        const results: ISearchResult[] = [];
        const maxResults = params.max_results || 50;
        const contextLines = params.context_lines || 2;

        for (const filePath of filesToSearch) {
            if (results.length >= maxResults) {break;}

            try {
                const content = await fs.readFile(filePath, 'utf8');
                const lines = content.split('\n');

                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    const line = lines[lineIndex];
                    const matches = this.getMatches(line, pattern);

                    for (const match of matches) {
                        if (results.length >= maxResults) {break;}

                        const column = match.index || 0;
                        const contextBefore = lines.slice(
                            Math.max(0, lineIndex - contextLines),
                            lineIndex
                        );
                        const contextAfter = lines.slice(
                            lineIndex + 1,
                            Math.min(lines.length, lineIndex + contextLines + 1)
                        );

                        const relevanceScore = this.calculateRelevanceScore(
                            match[0],
                            params.query,
                            params.search_type || 'text'
                        );

                        results.push({
                            file: path.relative(this.getWorkspaceRoot(), filePath),
                            line: lineIndex + 1,
                            column: column + 1,
                            match: match[0],
                            context_before: contextBefore,
                            context_after: contextAfter,
                            match_type: params.search_type || 'text',
                            relevance_score: relevanceScore
                        });
                    }
                }
            } catch {
                // Skip files we can't read
                continue;
            }
        }

        // Sort by relevance score (highest first)
        return results.sort((a, b) => b.relevance_score - a.relevance_score);
    }

    private calculateRelevanceScore(match: string, query: string, searchType: string): number {
        let score = 0;

        // Exact match bonus
        if (match.toLowerCase() === query.toLowerCase()) {
            score += 10;
        }

        // Match type bonuses
        switch (searchType) {
            case 'function':
                if (match.includes('function') || match.includes('=>')) {score += 5;}
                break;
            case 'class':
                if (match.includes('class') || match.includes('interface')) {score += 5;}
                break;
            case 'variable':
                if (match.includes('const') || match.includes('let') || match.includes('var')) {score += 5;}
                break;
            case 'import':
                if (match.includes('import') || match.includes('require')) {score += 5;}
                break;
        }

        // Length similarity bonus (prefer shorter, more precise matches)
        const lengthRatio = query.length / match.length;
        if (lengthRatio > 0.5) {
            score += Math.floor(lengthRatio * 3);
        }

        return score;
    }

    private createSearchSummary(
        params: ISearchCodeParams,
        results: ISearchResult[],
        filesSearched: number,
        searchTime: number
    ): ISearchSummary {
        const filesWithMatches = new Set(results.map(r => r.file)).size;

        // Generate search suggestions based on results
        const suggestions = this.generateSearchSuggestions(params, results);

        return {
            query: params.query,
            total_matches: results.length,
            files_searched: filesSearched,
            files_with_matches: filesWithMatches,
            search_time_ms: searchTime,
            results,
            suggestions
        };
    }

    private generateSearchSuggestions(params: ISearchCodeParams, results: ISearchResult[]): string[] {
        const suggestions: string[] = [];

        if (results.length === 0) {
            suggestions.push('Try a broader search without whole_word option');
            suggestions.push('Check spelling and try case_insensitive search');
            suggestions.push('Use regex patterns for more flexible matching');
        } else if (results.length > 100) {
            suggestions.push('Consider narrowing search with file_pattern');
            suggestions.push('Use more specific search terms');
            suggestions.push('Try a specific search_type (function, class, variable)');
        }

        // Type-specific suggestions
        if (params.search_type === 'text' && results.length > 0) {
            const hasFunction = results.some(r => r.match.includes('function'));
            const hasClass = results.some(r => r.match.includes('class'));

            if (hasFunction) {
                suggestions.push('Try search_type: "function" for more precise function searches');
            }
            if (hasClass) {
                suggestions.push('Try search_type: "class" for class-specific searches');
            }
        }

        return suggestions;
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private formatSearchResponse(summary: ISearchSummary): string {
        const lines = [
            `**🔍 Code Search Results**`,
            `**Query:** \`${summary.query}\``,
            `**Matches:** ${summary.total_matches} in ${summary.files_with_matches} files`,
            `**Search Time:** ${summary.search_time_ms}ms`,
            `**Files Scanned:** ${summary.files_searched}`,
            ''
        ];

        if (summary.results.length === 0) {
            lines.push('❌ **No matches found**');

            if (summary.suggestions.length > 0) {
                lines.push('');
                lines.push('**💡 Suggestions:**');
                summary.suggestions.forEach(suggestion => {
                    lines.push(`- ${suggestion}`);
                });
            }

            return lines.join('\n');
        }

        // Group results by file
        const fileGroups = this.groupResultsByFile(summary.results);

        lines.push(`**📁 Results by File:**`);

        Object.entries(fileGroups).slice(0, 10).forEach(([file, fileResults]) => {
            lines.push(`**${file}** (${fileResults.length} matches)`);

            fileResults.slice(0, 5).forEach(result => {
                const scoreIndicator = result.relevance_score >= 10 ? '🎯' :
                    result.relevance_score >= 5 ? '⭐' : '📍';

                lines.push(`   ${scoreIndicator} Line ${result.line}: \`${result.match.trim()}\``);

                // Show context for top matches
                if (result.relevance_score >= 5 && result.context_before.length > 0) {
                    lines.push(`      Context: \`${result.context_before[result.context_before.length - 1]?.trim()}\``);
                }
            });

            if (fileResults.length > 5) {
                lines.push(`   ... and ${fileResults.length - 5} more matches`);
            }
            lines.push('');
        });

        const remainingFiles = Object.keys(fileGroups).length - 10;
        if (remainingFiles > 0) {
            lines.push(`... and ${remainingFiles} more files with matches`);
            lines.push('');
        }

        // Show suggestions if any
        if (summary.suggestions.length > 0) {
            lines.push('**💡 Search Suggestions:**');
            summary.suggestions.forEach(suggestion => {
                lines.push(`- ${suggestion}`);
            });
        }

        return lines.join('\n');
    }

    private groupResultsByFile(results: ISearchResult[]): { [file: string]: ISearchResult[] } {
        return results.reduce((groups, result) => {
            groups[result.file] = groups[result.file] || [];
            groups[result.file].push(result);
            return groups;
        }, {} as { [file: string]: ISearchResult[] });
    }

    private getMatches(text: string, pattern: RegExp): RegExpExecArray[] {
        const matches: RegExpExecArray[] = [];
        let match: RegExpExecArray | null;
        
        // Reset pattern lastIndex to ensure consistent behavior
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(text)) !== null) {
            matches.push(match);
            // Break on non-global patterns to avoid infinite loop
            if (!pattern.global) {
                break;
            }
        }
        
        return matches;
    }
}

// Register the tool
ToolRegistry.registerTool(SearchCodeTool);