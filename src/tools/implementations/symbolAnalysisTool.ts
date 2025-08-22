/*---------------------------------------------------------------------------------------------
 * Symbol Analysis Tool - Intelligent code symbol usage analysis and navigation
 * Based on VSCode Copilot's UsagesTool with enhanced analysis capabilities
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';

interface ISymbolAnalysisParams {
    action: 'find_usages' | 'find_definitions' | 'find_implementations' | 'analyze_symbol' | 'find_references';
    symbol_name: string;
    file_paths?: string[];
    include_tests?: boolean;
    max_results?: number;
    search_scope?: 'workspace' | 'project' | 'file';
}

interface ISymbolLocation {
    file: string;
    line: number;
    column: number;
    code_snippet: string;
    usage_type: 'definition' | 'reference' | 'implementation' | 'import' | 'export';
    context?: string;
}

interface ISymbolAnalysisResult {
    symbol: string;
    total_found: number;
    definitions: ISymbolLocation[];
    references: ISymbolLocation[];
    implementations: ISymbolLocation[];
    imports: ISymbolLocation[];
    exports: ISymbolLocation[];
    analysis: {
        symbol_type: string;
        usage_patterns: string[];
        refactoring_safety: 'safe' | 'risky' | 'dangerous';
        recommendations: string[];
    };
}

export class SymbolAnalysisTool extends BaseTool<ISymbolAnalysisParams> {
    readonly name = 'symbol_analysis';
    readonly description = `Analyze code symbols - Track symbol usage patterns and assess refactoring safety across your codebase with intelligent analysis.

Use when: Understanding symbol dependencies before refactoring, finding all references before renaming/removing code, assessing refactoring safety, or navigating large codebases where manual searching is impractical.

Features: Comprehensive symbol tracking (definitions, references, implementations, imports, exports), refactoring safety assessment (safe/risky/dangerous), usage pattern analysis, and multi-language support with test file filtering.

Examples: Finding all usages of "calculateTotal" before renaming, analyzing "UserService" class dependencies, checking if "oldVariable" can be safely removed, or getting complete "ApiInterface" analysis with safety recommendations.`;

    // Tag system implementation
    readonly tags = ['code-analysis', 'refactoring', 'symbols', 'usage-tracking', 'safety-assessment', 'navigation'];
    readonly category = 'code-analysis';
    readonly complexity: 'core' | 'advanced' | 'essential' = 'advanced';

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['find_usages', 'find_definitions', 'find_implementations', 'analyze_symbol', 'find_references'],
                description: 'Type of symbol analysis to perform'
            },
            symbol_name: {
                type: 'string',
                description: 'Name of the symbol to analyze (function, class, variable, etc.)'
            },
            file_paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional specific files to search in'
            },
            include_tests: {
                type: 'boolean',
                description: 'Include test files in the analysis',
                default: true
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 50
            },
            search_scope: {
                type: 'string',
                enum: ['workspace', 'project', 'file'],
                description: 'Scope of the search',
                default: 'workspace'
            }
        },
        required: ['action', 'symbol_name']
    };

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ISymbolAnalysisParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const params = options.input;

        try {
            switch (params.action) {
                case 'find_usages':
                case 'find_references':
                    return await this.handleFindUsages(params);
                case 'find_definitions':
                    return await this.handleFindDefinitions(params);
                case 'find_implementations':
                    return await this.handleFindImplementations(params);
                case 'analyze_symbol':
                    return await this.handleAnalyzeSymbol(params);
                default:
                    return this.createErrorResult(`Unknown action: ${params.action}`);
            }
        } catch (_error: any) {
            return this.createErrorResult(`Symbol analysis failed: ${_error.message}`);
        }
    }

    private async handleFindUsages(params: ISymbolAnalysisParams): Promise<vscode.LanguageModelToolResult> {
        const usages = await this.findSymbolUsages(params.symbol_name, {
            includePaths: params.file_paths,
            includeTests: params.include_tests !== false,
            maxResults: params.max_results || 50,
            scope: params.search_scope || 'workspace'
        });

        const response = this.formatUsagesResponse(usages, 'usages');
        return this.createSuccessResult(null, response);
    }

    private async handleFindDefinitions(params: ISymbolAnalysisParams): Promise<vscode.LanguageModelToolResult> {
        const definitions = await this.findSymbolDefinitions(params.symbol_name, {
            includePaths: params.file_paths,
            includeTests: params.include_tests !== false,
            maxResults: params.max_results || 10,
            scope: params.search_scope || 'workspace'
        });

        const response = this.formatLocationsResponse(definitions, 'definitions', params.symbol_name);
        return this.createSuccessResult(null, response);
    }

    private async handleFindImplementations(params: ISymbolAnalysisParams): Promise<vscode.LanguageModelToolResult> {
        const implementations = await this.findSymbolImplementations(params.symbol_name, {
            includePaths: params.file_paths,
            includeTests: params.include_tests !== false,
            maxResults: params.max_results || 20,
            scope: params.search_scope || 'workspace'
        });

        const response = this.formatLocationsResponse(implementations, 'implementations', params.symbol_name);
        return this.createSuccessResult(null, response);
    }

    private async handleAnalyzeSymbol(params: ISymbolAnalysisParams): Promise<vscode.LanguageModelToolResult> {
        const analysis = await this.performCompleteSymbolAnalysis(params.symbol_name, {
            includePaths: params.file_paths,
            includeTests: params.include_tests !== false,
            maxResults: params.max_results || 100,
            scope: params.search_scope || 'workspace'
        });

        const response = this.formatCompleteAnalysisResponse(analysis);
        return this.createSuccessResult(null, response);
    }

    private async findSymbolUsages(symbolName: string, options: any): Promise<ISymbolLocation[]> {
        const usages: ISymbolLocation[] = [];

        // Get all files to search
        const filesToSearch = await this.getFilesToSearch(options);

        for (const filePath of filesToSearch) {
            try {
                const fileUsages = await this.findSymbolInFile(symbolName, filePath, ['reference', 'definition', 'implementation']);
                usages.push(...fileUsages);

                if (usages.length >= options.maxResults) {
                    break;
                }
            } catch {
                // Continue with other files if one fails
                continue;
            }
        }

        return usages.slice(0, options.maxResults);
    }

    private async findSymbolDefinitions(symbolName: string, options: any): Promise<ISymbolLocation[]> {
        const definitions: ISymbolLocation[] = [];
        const filesToSearch = await this.getFilesToSearch(options);

        for (const filePath of filesToSearch) {
            try {
                const fileDefinitions = await this.findSymbolInFile(symbolName, filePath, ['definition']);
                definitions.push(...fileDefinitions);

                if (definitions.length >= options.maxResults) {
                    break;
                }
            } catch {
                continue;
            }
        }

        return definitions.slice(0, options.maxResults);
    }

    private async findSymbolImplementations(symbolName: string, options: any): Promise<ISymbolLocation[]> {
        const implementations: ISymbolLocation[] = [];
        const filesToSearch = await this.getFilesToSearch(options);

        for (const filePath of filesToSearch) {
            try {
                const fileImplementations = await this.findSymbolInFile(symbolName, filePath, ['implementation', 'definition']);
                implementations.push(...fileImplementations);

                if (implementations.length >= options.maxResults) {
                    break;
                }
            } catch {
                continue;
            }
        }

        return implementations.slice(0, options.maxResults);
    }

    private async performCompleteSymbolAnalysis(symbolName: string, options: any): Promise<ISymbolAnalysisResult> {
        // Find all types of usages
        const [definitions, references, implementations] = await Promise.all([
            this.findSymbolDefinitions(symbolName, { ...options, maxResults: 10 }),
            this.findSymbolUsages(symbolName, { ...options, maxResults: 50 }),
            this.findSymbolImplementations(symbolName, { ...options, maxResults: 20 })
        ]);

        // Separate imports and exports
        const imports = references.filter(ref => ref.usage_type === 'import');
        const exports = references.filter(ref => ref.usage_type === 'export');
        const actualReferences = references.filter(ref => ref.usage_type === 'reference');

        // Analyze symbol
        const analysis = await this.analyzeSymbolUsagePatterns({
            definitions,
            references: actualReferences,
            implementations,
            imports,
            exports
        });

        return {
            symbol: symbolName,
            total_found: definitions.length + actualReferences.length + implementations.length + imports.length + exports.length,
            definitions,
            references: actualReferences,
            implementations,
            imports,
            exports,
            analysis
        };
    }

    private async findSymbolInFile(symbolName: string, filePath: string, usageTypes: string[]): Promise<ISymbolLocation[]> {
        const locations: ISymbolLocation[] = [];

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');

            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                const lineText = line.trim();

                // Skip empty lines and comments
                if (!lineText || lineText.startsWith('//') || lineText.startsWith('*')) {
                    continue;
                }

                // Find all occurrences of the symbol in this line
                const regex = new RegExp(`\\b${this.escapeRegExp(symbolName)}\\b`, 'g');
                let match;

                while ((match = regex.exec(line)) !== null) {
                    const column = match.index;
                    const usageType = this.determineUsageType(line, symbolName, column);

                    if (usageTypes.includes(usageType)) {
                        const context = this.extractContext(lines, lineIndex, 2);

                        locations.push({
                            file: path.relative(this.getWorkspaceRoot(), filePath),
                            line: lineIndex + 1,
                            column: column + 1,
                            code_snippet: line.trim(),
                            usage_type: usageType as any,
                            context
                        });
                    }
                }
            }
        } catch {
            // File read error - skip this file
        }

        return locations;
    }

    private determineUsageType(line: string, symbolName: string, _position: number): string {
        const trimmedLine = line.trim();

        // Check for imports
        if (trimmedLine.includes('import') && trimmedLine.includes(symbolName)) {
            return 'import';
        }

        // Check for exports
        if (trimmedLine.includes('export') && trimmedLine.includes(symbolName)) {
            return 'export';
        }

        // Check for function definitions
        if (trimmedLine.includes('function') && trimmedLine.includes(symbolName)) {
            return 'definition';
        }

        // Check for class definitions
        if (trimmedLine.includes('class') && trimmedLine.includes(symbolName)) {
            return 'definition';
        }

        // Check for variable declarations
        if ((trimmedLine.includes('const') || trimmedLine.includes('let') || trimmedLine.includes('var')) &&
            trimmedLine.includes(symbolName)) {
            return 'definition';
        }

        // Check for interface/type definitions
        if ((trimmedLine.includes('interface') || trimmedLine.includes('type')) &&
            trimmedLine.includes(symbolName)) {
            return 'definition';
        }

        // Check for implementations (class methods, etc.)
        if (trimmedLine.includes(symbolName) &&
            (trimmedLine.includes('(') || trimmedLine.includes('{') || trimmedLine.includes('=>'))) {
            return 'implementation';
        }

        // Default to reference
        return 'reference';
    }

    private extractContext(lines: string[], currentLine: number, contextLines: number): string {
        const start = Math.max(0, currentLine - contextLines);
        const end = Math.min(lines.length, currentLine + contextLines + 1);

        return lines.slice(start, end)
            .map((line, index) => {
                const lineNum = start + index + 1;
                const prefix = lineNum === currentLine + 1 ? '>' : ' ';
                return `${prefix} ${lineNum}: ${line}`;
            })
            .join('\n');
    }

    private async getFilesToSearch(options: any): Promise<string[]> {
        if (options.includePaths) {
            return options.includePaths.map((p: string) =>
                path.isAbsolute(p) ? p : path.resolve(this.getWorkspaceRoot(), p)
            );
        }

        // Get all relevant files in workspace
        const workspaceRoot = this.getWorkspaceRoot();
        const allFiles = await this.getAllFiles(workspaceRoot, options.includeTests);

        return allFiles;
    }

    private async getAllFiles(rootPath: string, includeTests: boolean): Promise<string[]> {
        const files: string[] = [];
        const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.cpp', '.c', '.h'];

        const walkDir = async(dir: string): Promise<void> => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);

                    if (entry.isDirectory()) {
                        // Skip node_modules and other common directories
                        if (!['node_modules', '.git', 'dist', 'build', '.vscode'].includes(entry.name)) {
                            await walkDir(fullPath);
                        }
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        const isTestFile = entry.name.includes('.test.') || entry.name.includes('.spec.');

                        if (extensions.includes(ext) && (includeTests || !isTestFile)) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch {
                // Skip directories we can't read
            }
        };

        await walkDir(rootPath);
        return files;
    }

    private async analyzeSymbolUsagePatterns(data: any): Promise<any> {
        const { definitions, references, implementations, imports, exports } = data;

        // Determine symbol type
        let symbolType = 'unknown';
        if (definitions.length > 0) {
            const firstDef = definitions[0];
            if (firstDef.code_snippet.includes('function')) {symbolType = 'function';}
            else if (firstDef.code_snippet.includes('class')) {symbolType = 'class';}
            else if (firstDef.code_snippet.includes('interface')) {symbolType = 'interface';}
            else if (firstDef.code_snippet.includes('const') || firstDef.code_snippet.includes('let')) {symbolType = 'variable';}
            else if (firstDef.code_snippet.includes('type')) {symbolType = 'type';}
        }

        // Analyze usage patterns
        const patterns: string[] = [];
        if (imports.length > 0) {patterns.push(`Imported in ${imports.length} files`);}
        if (exports.length > 0) {patterns.push(`Exported from ${exports.length} locations`);}
        if (implementations.length > references.length) {patterns.push('More implementations than references - likely interface/abstract');}
        if (references.length > 10) {patterns.push('Heavily used symbol');}
        if (definitions.length > 1) {patterns.push('Multiple definitions found');}

        // Determine refactoring safety
        let refactoringSafety: 'safe' | 'risky' | 'dangerous' = 'safe';
        const totalUsages = references.length + implementations.length;

        if (totalUsages > 50) {refactoringSafety = 'dangerous';}
        else if (totalUsages > 20) {refactoringSafety = 'risky';}

        if (exports.length > 0) {refactoringSafety = 'risky';} // Exported symbols are risky to change
        if (definitions.length > 1) {refactoringSafety = 'dangerous';} // Multiple definitions

        // Generate recommendations
        const recommendations: string[] = [];
        if (refactoringSafety === 'dangerous') {
            recommendations.push('Use "Find All References" before renaming');
            recommendations.push('Consider gradual migration strategy');
        }
        if (exports.length > 0) {
            recommendations.push('Symbol is exported - check external dependencies');
        }
        if (definitions.length > 1) {
            recommendations.push('Multiple definitions found - ensure you\'re targeting the right one');
        }
        if (totalUsages === 0 && definitions.length > 0) {
            recommendations.push('Symbol appears unused - candidate for removal');
        }

        return {
            symbol_type: symbolType,
            usage_patterns: patterns,
            refactoring_safety: refactoringSafety,
            recommendations
        };
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private formatUsagesResponse(usages: ISymbolLocation[], type: string): string {
        const lines = [
            `**🔍 Symbol ${type.charAt(0).toUpperCase() + type.slice(1)} Found**`,
            `**Total:** ${usages.length}`,
            ''
        ];

        if (usages.length === 0) {
            lines.push('No usages found for this symbol.');
            return lines.join('\n');
        }

        // Group by file
        const fileGroups = this.groupBy(usages, usage => usage.file);

        Object.entries(fileGroups).forEach(([file, fileUsages]) => {
            lines.push(`**📁 ${file}** (${fileUsages.length} usages)`);

            fileUsages.slice(0, 10).forEach(usage => {
                const typeIcon = {
                    definition: '🔧',
                    reference: '📍',
                    implementation: '⚙️',
                    import: '📥',
                    export: '📤'
                }[usage.usage_type] || '🔍';

                lines.push(`   ${typeIcon} Line ${usage.line}: \`${usage.code_snippet}\``);
            });

            if (fileUsages.length > 10) {
                lines.push(`   ... and ${fileUsages.length - 10} more`);
            }
            lines.push('');
        });

        return lines.join('\n');
    }

    private formatLocationsResponse(locations: ISymbolLocation[], type: string, symbolName: string): string {
        const lines = [
            `**🎯 Symbol ${type.charAt(0).toUpperCase() + type.slice(1)}: \`${symbolName}\`**`,
            `**Found:** ${locations.length}`,
            ''
        ];

        if (locations.length === 0) {
            lines.push(`No ${type} found for this symbol.`);
            return lines.join('\n');
        }

        locations.forEach((location, index) => {
            const typeIcon = {
                definition: '🔧',
                reference: '📍',
                implementation: '⚙️',
                import: '📥',
                export: '📤'
            }[location.usage_type] || '🔍';

            lines.push(`${typeIcon} **${index + 1}. ${location.file}:${location.line}**`);
            lines.push(`   \`${location.code_snippet}\``);

            if (location.context) {
                lines.push('   **Context:**');
                lines.push('   ```');
                lines.push(location.context);
                lines.push('   ```');
            }
            lines.push('');
        });

        return lines.join('\n');
    }

    private formatCompleteAnalysisResponse(analysis: ISymbolAnalysisResult): string {
        const lines = [
            `**🔬 Complete Symbol Analysis: \`${analysis.symbol}\`**`,
            `**Total Locations:** ${analysis.total_found}`,
            `**Symbol Type:** ${analysis.analysis.symbol_type}`,
            `**Refactoring Safety:** ${this.getSafetyIcon(analysis.analysis.refactoring_safety)} ${analysis.analysis.refactoring_safety}`,
            ''
        ];

        // Summary counts
        lines.push('**📊 Summary:**');
        lines.push(`- 🔧 Definitions: ${analysis.definitions.length}`);
        lines.push(`- 📍 References: ${analysis.references.length}`);
        lines.push(`- ⚙️ Implementations: ${analysis.implementations.length}`);
        lines.push(`- 📥 Imports: ${analysis.imports.length}`);
        lines.push(`- 📤 Exports: ${analysis.exports.length}`);
        lines.push('');

        // Usage patterns
        if (analysis.analysis.usage_patterns.length > 0) {
            lines.push('**🔍 Usage Patterns:**');
            analysis.analysis.usage_patterns.forEach(pattern => {
                lines.push(`- ${pattern}`);
            });
            lines.push('');
        }

        // Recommendations
        if (analysis.analysis.recommendations.length > 0) {
            lines.push('**💡 Recommendations:**');
            analysis.analysis.recommendations.forEach(rec => {
                lines.push(`- ${rec}`);
            });
            lines.push('');
        }

        // Top definitions
        if (analysis.definitions.length > 0) {
            lines.push('**🔧 Key Definitions:**');
            analysis.definitions.slice(0, 3).forEach((def, index) => {
                lines.push(`${index + 1}. **${def.file}:${def.line}**`);
                lines.push(`   \`${def.code_snippet}\``);
            });
            lines.push('');
        }

        // Recent references
        if (analysis.references.length > 0) {
            lines.push('**📍 Recent References:**');
            analysis.references.slice(0, 5).forEach((ref, index) => {
                lines.push(`${index + 1}. **${ref.file}:${ref.line}**`);
                lines.push(`   \`${ref.code_snippet}\``);
            });

            if (analysis.references.length > 5) {
                lines.push(`   ... and ${analysis.references.length - 5} more references`);
            }
        }

        return lines.join('\n');
    }

    private getSafetyIcon(safety: string): string {
        return {
            safe: '✅',
            risky: '⚠️',
            dangerous: '🚨'
        }[safety] || '❓';
    }

    private groupBy<T>(items: T[], keyFn: (item: T) => string): { [key: string]: T[] } {
        return items.reduce((groups, item) => {
            const key = keyFn(item);
            groups[key] = groups[key] || [];
            groups[key].push(item);
            return groups;
        }, {} as { [key: string]: T[] });
    }
}

// Register the tool
ToolRegistry.getInstance().registerTool(SymbolAnalysisTool);