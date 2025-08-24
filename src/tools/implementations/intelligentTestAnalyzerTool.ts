/*---------------------------------------------------------------------------------------------
 * Intelligent Test Analyzer Tool - AI-powered test failure analysis and debugging
 * Based on VSCode Copilot's TestFailureTool with enhanced intelligence
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

interface ITestAnalyzerParams {
    action: 'analyze_failures' | 'find_failures' | 'suggest_fixes' | 'run_and_analyze';
    test_output?: string;
    test_file?: string;
    failure_pattern?: string;
    include_stack_trace?: boolean;
    max_failures?: number;
    [key: string]: unknown;
}

interface ITestFailure {
    testName: string;
    file: string;
    line?: number;
    errorMessage: string;
    stackTrace?: string;
    assertionType?: string;
    expected?: string;
    actual?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'assertion' | 'runtime' | 'timeout' | 'setup' | 'unknown';
}

interface ITestAnalysisResult {
    totalFailures: number;
    failures: ITestFailure[];
    patterns: string[];
    suggestions: IFixSuggestion[];
    priorityOrder: string[];
}

interface IFixSuggestion {
    testName: string;
    issue: string;
    suggestedFix: string;
    confidence: 'high' | 'medium' | 'low';
    codeExample?: string;
}

export class IntelligentTestAnalyzerTool extends BaseTool<ITestAnalyzerParams> {
    readonly name = 'test_analyzer';
    readonly tags = ['testing_quality', 'advanced', 'debugging', 'analysis'];
    readonly category = 'testing_quality';
    readonly complexity = 'advanced';
    readonly description = 'Analyze test failures with intelligent debugging and automated fix suggestions.\n\nUse this when tests are failing and you need to understand why, identify patterns, or get suggestions for fixes. Perfect for debugging failing test suites, understanding test error patterns, or getting AI-powered recommendations for resolving test issues. Essential during development when tests break after code changes.\n\nThe tool can analyze raw test output from any framework (Jest, Mocha, Vitest), categorize failures by type (assertion, runtime, timeout, setup), prioritize by severity, and provide specific fix suggestions with code examples. Supports running tests automatically and analyzing results.\n\nExamples: Analyzing "npm test" output to understand why 5 tests failed, finding all failures in "user.test.js", getting fix suggestions for timeout errors, or running tests and getting comprehensive failure analysis with priority rankings.';

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['analyze_failures', 'find_failures', 'suggest_fixes', 'run_and_analyze'],
                description: 'The test analysis action to perform'
            },
            test_output: {
                type: 'string',
                description: 'Raw test output to analyze (from npm test, jest, etc.)'
            },
            test_file: {
                type: 'string',
                description: 'Specific test file to analyze'
            },
            failure_pattern: {
                type: 'string',
                description: 'Pattern to search for in failure messages'
            },
            include_stack_trace: {
                type: 'boolean',
                description: 'Include full stack traces in analysis',
                default: true
            },
            max_failures: {
                type: 'number',
                description: 'Maximum number of failures to analyze',
                default: 10
            }
        },
        required: ['action']
    };

    private readonly testFrameworks = [
        { name: 'Jest', runCommand: 'npm test', patterns: ['FAIL', 'expect(', 'toBe(', 'toEqual('] },
        { name: 'Mocha', runCommand: 'npm test', patterns: ['failing', 'AssertionError', 'should', 'expect'] },
        { name: 'Vitest', runCommand: 'npx vitest run', patterns: ['FAIL', 'expect(', 'vi.'] },
        { name: 'Cypress', runCommand: 'npx cypress run', patterns: ['CypressError', 'cy.'] },
        { name: 'Playwright', runCommand: 'npx playwright test', patterns: ['Error:', 'expect('] }
    ];

    async invoke(
        options: CliToolInvocationOptions<ITestAnalyzerParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const params = options.input;

        // Validate required parameters
        if (!params.action || typeof params.action !== 'string') {
            return this.createErrorResult('action is required and must be a string');
        }

        const validActions = ['analyze_failures', 'find_failures', 'suggest_fixes', 'run_and_analyze'];
        if (!validActions.includes(params.action)) {
            return this.createErrorResult(`Invalid action: ${params.action}. Must be one of: ${validActions.join(', ')}`);
        }

        try {
            switch (params.action) {
                case 'analyze_failures':
                    return await this.handleAnalyzeFailures(params);
                case 'find_failures':
                    return await this.handleFindFailures(params);
                case 'suggest_fixes':
                    return await this.handleSuggestFixes(params);
                case 'run_and_analyze':
                    return await this.handleRunAndAnalyze(params);
                default:
                    return this.createErrorResult(`Unknown action: ${params.action}`);
            }
        } catch (error: any) {
            return this.createErrorResult(`Test analysis failed: ${error.message}`);
        }
    }

    private async handleAnalyzeFailures(params: ITestAnalyzerParams): Promise<CliToolResult> {
        if (!params.test_output) {
            return this.createErrorResult('test_output is required for analyze_failures action');
        }

        const analysis = await this.analyzeTestOutput(params.test_output, params.max_failures || 10);
        const response = this.formatAnalysisResponse(analysis);

        return this.createSuccessResult(null, response);
    }

    private async handleFindFailures(params: ITestAnalyzerParams): Promise<CliToolResult> {
        if (!params.test_file) {
            return this.createErrorResult('test_file is required for find_failures action');
        }

        try {
            // First, try to run tests for the specific file
            const testOutput = await this.runTestsForFile(params.test_file);
            const analysis = await this.analyzeTestOutput(testOutput, params.max_failures || 10);

            const response = [
                `**🔍 Test Failures Analysis for \`${params.test_file}\`**`,
                '',
                this.formatAnalysisResponse(analysis)
            ].join('\n');

            return this.createSuccessResult(null, response);
        } catch (error: any) {
            return this.createErrorResult(`Could not analyze test file: ${error.message}`);
        }
    }

    private async handleSuggestFixes(params: ITestAnalyzerParams): Promise<CliToolResult> {
        if (!params.test_output) {
            return this.createErrorResult('test_output is required for suggest_fixes action');
        }

        const analysis = await this.analyzeTestOutput(params.test_output, params.max_failures || 5);
        const suggestions = await this.generateFixSuggestions(analysis.failures);

        const response = this.formatFixSuggestionsResponse(suggestions);
        return this.createSuccessResult(null, response);
    }

    private async handleRunAndAnalyze(params: ITestAnalyzerParams): Promise<CliToolResult> {
        try {
            // Detect test framework
            const framework = await this.detectTestFramework();

            // Run tests
            console.log(`Running tests with ${framework.name}...`);
            const testOutput = await this.runTests(framework.runCommand);

            // Analyze results
            const analysis = await this.analyzeTestOutput(testOutput, params.max_failures || 10);

            const response = [
                `**🧪 Test Run Complete - ${framework.name}**`,
                '',
                this.formatAnalysisResponse(analysis),
                '',
                '**Next Steps:**',
                analysis.totalFailures > 0 ?
                    '- Use `suggest_fixes` action for specific fix recommendations' :
                    '- All tests passing! ✅'
            ].join('\n');

            return this.createSuccessResult(null, response);
        } catch (error: any) {
            return this.createErrorResult(`Test run failed: ${error.message}`);
        }
    }

    private async analyzeTestOutput(output: string, maxFailures: number): Promise<ITestAnalysisResult> {
        const failures = this.parseTestFailures(output);
        const limitedFailures = failures.slice(0, maxFailures);

        // Categorize and prioritize
        const categorizedFailures = limitedFailures.map(failure => this.categorizeFailure(failure));
        const prioritizedFailures = this.prioritizeFailures(categorizedFailures);

        // Find patterns
        const patterns = this.findFailurePatterns(failures);

        // Generate basic suggestions
        const suggestions = await this.generateFixSuggestions(prioritizedFailures.slice(0, 5));

        return {
            totalFailures: failures.length,
            failures: prioritizedFailures,
            patterns,
            suggestions,
            priorityOrder: prioritizedFailures.map(f => f.testName)
        };
    }

    private parseTestFailures(output: string): ITestFailure[] {
        const failures: ITestFailure[] = [];
        const lines = output.split('\n');

        let currentFailure: Partial<ITestFailure> | null = null;
        let inStackTrace = false;
        let stackLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Jest/Vitest failure patterns
            if (line.includes('FAIL') || line.includes('✕') || line.includes('×')) {
                if (currentFailure && currentFailure.testName) {
                    failures.push(this.finalizeFailure(currentFailure, stackLines));
                }
                currentFailure = this.parseFailureLine(line);
                inStackTrace = false;
                stackLines = [];
            }
            // Error messages
            else if (line.includes('Error:') || line.includes('AssertionError') || line.includes('expect(')) {
                if (currentFailure) {
                    currentFailure.errorMessage = line.trim();

                    // Try to extract expected/actual values
                    const expectedMatch = line.match(/Expected: (.+)/);
                    const actualMatch = line.match(/Received: (.+)/);

                    if (expectedMatch) {currentFailure.expected = expectedMatch[1];}
                    if (actualMatch) {currentFailure.actual = actualMatch[1];}
                }
            }
            // Stack trace detection
            else if (line.trim().startsWith('at ') || line.includes('    at ')) {
                inStackTrace = true;
                stackLines.push(line.trim());

                // Extract file and line number from stack trace
                if (currentFailure && !currentFailure.file) {
                    const fileMatch = line.match(/at .* \((.+):(\d+):\d+\)/);
                    if (fileMatch) {
                        currentFailure.file = fileMatch[1];
                        currentFailure.line = parseInt(fileMatch[2]);
                    }
                }
            }
            // Additional stack trace lines
            else if (inStackTrace && line.trim().length > 0) {
                stackLines.push(line.trim());
            }
            // Test names
            else if (line.includes('describes') || line.includes('it(') || line.includes('test(')) {
                if (currentFailure && !currentFailure.testName) {
                    const testMatch = line.match(/["'](.*?)["']/);
                    if (testMatch) {
                        currentFailure.testName = testMatch[1];
                    }
                }
            }
        }

        // Add final failure
        if (currentFailure && currentFailure.testName) {
            failures.push(this.finalizeFailure(currentFailure, stackLines));
        }

        return failures;
    }

    private parseFailureLine(line: string): Partial<ITestFailure> {
        const failure: Partial<ITestFailure> = {};

        // Extract test name from various formats
        const testNamePatterns = [
            /["'](.*?)["']/,  // "test name"
            /FAIL (.*?) /,     // FAIL test.js
            /✕ (.*?) \(/      // ✕ test name (
        ];

        for (const pattern of testNamePatterns) {
            const match = line.match(pattern);
            if (match) {
                failure.testName = match[1];
                break;
            }
        }

        // Extract file path
        const fileMatch = line.match(/([^\s]+\.(?:test|spec)\.[jt]sx?)/);
        if (fileMatch) {
            failure.file = fileMatch[1];
        }

        return failure;
    }

    private finalizeFailure(partial: Partial<ITestFailure>, stackLines: string[]): ITestFailure {
        return {
            testName: partial.testName || 'Unknown test',
            file: partial.file || 'Unknown file',
            line: partial.line,
            errorMessage: partial.errorMessage || 'No error message',
            stackTrace: stackLines.join('\n'),
            expected: partial.expected,
            actual: partial.actual,
            severity: 'medium', // Will be updated by categorizeFailure
            category: 'unknown' // Will be updated by categorizeFailure
        };
    }

    private categorizeFailure(failure: ITestFailure): ITestFailure {
        const message = failure.errorMessage.toLowerCase();

        // Categorize by type
        if (message.includes('expect') || message.includes('assertion') || message.includes('should')) {
            failure.category = 'assertion';
            failure.assertionType = this.extractAssertionType(failure.errorMessage);
        } else if (message.includes('timeout') || message.includes('exceeded')) {
            failure.category = 'timeout';
            failure.severity = 'high';
        } else if (message.includes('setup') || message.includes('beforeeach') || message.includes('aftereach')) {
            failure.category = 'setup';
            failure.severity = 'high';
        } else if (message.includes('error') || message.includes('exception')) {
            failure.category = 'runtime';
            failure.severity = 'high';
        }

        // Assign severity based on error patterns
        if (failure.severity === 'medium') { // Only if not already set
            if (message.includes('critical') || message.includes('fatal') || failure.category === 'runtime') {
                failure.severity = 'critical';
            } else if (message.includes('important') || failure.category === 'timeout') {
                failure.severity = 'high';
            } else if (message.includes('warning') || failure.category === 'assertion') {
                failure.severity = 'medium';
            } else {
                failure.severity = 'low';
            }
        }

        return failure;
    }

    private extractAssertionType(errorMessage: string): string {
        const assertionPatterns = [
            { pattern: /toBe\(/, type: 'strict equality' },
            { pattern: /toEqual\(/, type: 'deep equality' },
            { pattern: /toContain\(/, type: 'array/string contains' },
            { pattern: /toHaveLength\(/, type: 'length check' },
            { pattern: /toBeTruthy\(/, type: 'truthiness' },
            { pattern: /toBeFalsy\(/, type: 'falsiness' },
            { pattern: /toBeNull\(/, type: 'null check' },
            { pattern: /toBeUndefined\(/, type: 'undefined check' }
        ];

        for (const { pattern, type } of assertionPatterns) {
            if (pattern.test(errorMessage)) {
                return type;
            }
        }

        return 'unknown assertion';
    }

    private prioritizeFailures(failures: ITestFailure[]): ITestFailure[] {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

        return failures.sort((a, b) => {
            // Primary sort: severity
            const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
            if (severityDiff !== 0) {return severityDiff;}

            // Secondary sort: category importance
            const categoryOrder = { runtime: 4, setup: 3, timeout: 2, assertion: 1, unknown: 0 };
            return categoryOrder[b.category] - categoryOrder[a.category];
        });
    }

    private findFailurePatterns(failures: ITestFailure[]): string[] {
        const patterns: string[] = [];
        const errorMessages = failures.map(f => f.errorMessage);

        // Find common error patterns
        const commonWords = this.findCommonWords(errorMessages);
        if (commonWords.length > 0) {
            patterns.push(`Common error keywords: ${commonWords.join(', ')}`);
        }

        // Find file patterns
        const files = failures.map(f => f.file).filter(f => f !== 'Unknown file');
        const fileGroups = this.groupBy(files, f => path.dirname(f));
        for (const [dir, fileList] of Object.entries(fileGroups)) {
            if (fileList.length > 1) {
                patterns.push(`Multiple failures in directory: ${dir}`);
            }
        }

        // Find assertion patterns
        const assertionTypes = failures
            .filter(f => f.assertionType)
            .map(f => f.assertionType!);
        const commonAssertions = this.findMostCommon(assertionTypes);
        if (commonAssertions.length > 0) {
            patterns.push(`Common assertion types: ${commonAssertions.join(', ')}`);
        }

        return patterns;
    }

    private async generateFixSuggestions(failures: ITestFailure[]): Promise<IFixSuggestion[]> {
        const suggestions: IFixSuggestion[] = [];

        for (const failure of failures.slice(0, 5)) { // Limit to top 5
            const suggestion = this.generateFixSuggestion(failure);
            if (suggestion) {
                suggestions.push(suggestion);
            }
        }

        return suggestions;
    }

    private generateFixSuggestion(failure: ITestFailure): IFixSuggestion | null {

        // Assertion failures
        if (failure.category === 'assertion' && failure.expected && failure.actual) {
            return {
                testName: failure.testName,
                issue: `Assertion failed: expected ${failure.expected} but got ${failure.actual}`,
                suggestedFix: 'Update the expected value or fix the implementation to return the correct value',
                confidence: 'high',
                codeExample: `// If the expected value is wrong:\nexpect(result).toBe(${failure.actual});\n\n// If the implementation is wrong:\n// Fix the function to return ${failure.expected}`
            };
        }

        // Timeout failures
        if (failure.category === 'timeout') {
            return {
                testName: failure.testName,
                issue: 'Test timed out',
                suggestedFix: 'Increase timeout or optimize the code being tested',
                confidence: 'medium',
                codeExample: `// Increase timeout:\nit('${failure.testName}', async () => {\n  // test code\n}, 10000); // 10 second timeout\n\n// Or use jest.setTimeout(10000);`
            };
        }

        // Runtime errors
        if (failure.category === 'runtime') {
            return {
                testName: failure.testName,
                issue: 'Runtime error occurred',
                suggestedFix: 'Fix the underlying code error or add proper error handling',
                confidence: 'medium',
                codeExample: `// Add error handling:\ntry {\n  // test code\n} catch (error) {\n  expect(error).toBeInstanceOf(ExpectedErrorType);\n}`
            };
        }

        // Setup failures
        if (failure.category === 'setup') {
            return {
                testName: failure.testName,
                issue: 'Test setup/teardown failed',
                suggestedFix: 'Check beforeEach/afterEach hooks and test environment setup',
                confidence: 'high',
                codeExample: `// Check setup hooks:\nbeforeEach(() => {\n  // Ensure proper initialization\n});\n\nafterEach(() => {\n  // Clean up resources\n});`
            };
        }

        return null;
    }

    private async detectTestFramework(): Promise<{ name: string; runCommand: string }> {
        try {
            const packageJsonPath = path.join(this.getWorkspaceRoot(), 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

            // Check dependencies
            const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

            if (allDeps.jest || allDeps['@types/jest']) {
                return { name: 'Jest', runCommand: 'npm test' };
            } else if (allDeps.vitest) {
                return { name: 'Vitest', runCommand: 'npx vitest run' };
            } else if (allDeps.mocha) {
                return { name: 'Mocha', runCommand: 'npm test' };
            } else if (allDeps.cypress) {
                return { name: 'Cypress', runCommand: 'npx cypress run' };
            } else if (allDeps.playwright || allDeps['@playwright/test']) {
                return { name: 'Playwright', runCommand: 'npx playwright test' };
            }

            // Fallback to npm test
            return { name: 'Unknown', runCommand: 'npm test' };
        } catch {
            return { name: 'Unknown', runCommand: 'npm test' };
        }
    }

    private async runTests(command: string): Promise<string> {
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            exec(command, { cwd: this.getWorkspaceRoot() }, (error: any, stdout: any, stderr: any) => {
                // Test runners often exit with non-zero on failures, so we include stdout anyway
                const output = stdout + stderr;
                resolve(output);
            });
        });
    }

    private async runTestsForFile(testFile: string): Promise<string> {
        const framework = await this.detectTestFramework();
        const command = `${framework.runCommand} ${testFile}`;
        return this.runTests(command);
    }

    private findCommonWords(strings: string[]): string[] {
        const wordCounts: { [word: string]: number } = {};

        strings.forEach(str => {
            const words = str.toLowerCase().match(/\b\w{3,}\b/g) || [];
            words.forEach(word => {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            });
        });

        return Object.entries(wordCounts)
            .filter(([_, count]) => count > 1)
            .sort(([_, a], [__, b]) => b - a)
            .slice(0, 5)
            .map(([word, _]) => word);
    }

    private findMostCommon<T>(items: T[]): T[] {
        const counts: { [key: string]: number } = {};
        items.forEach(item => {
            const key = String(item);
            counts[key] = (counts[key] || 0) + 1;
        });

        return Object.entries(counts)
            .filter(([_, count]) => count > 1)
            .sort(([_, a], [__, b]) => b - a)
            .slice(0, 3)
            .map(([item, _]) => JSON.parse(`"${item}"`));
    }

    private groupBy<T>(items: T[], keyFn: (item: T) => string): { [key: string]: T[] } {
        return items.reduce((groups, item) => {
            const key = keyFn(item);
            groups[key] = groups[key] || [];
            groups[key].push(item);
            return groups;
        }, {} as { [key: string]: T[] });
    }

    private formatAnalysisResponse(analysis: ITestAnalysisResult): string {
        const lines = [
            `**🧪 Intelligent Test Analysis**`,
            `**Total Failures:** ${analysis.totalFailures}`,
            `**Analyzed:** ${analysis.failures.length}`,
            ''
        ];

        if (analysis.patterns.length > 0) {
            lines.push('**🔍 Patterns Detected:**');
            analysis.patterns.forEach(pattern => lines.push(`- ${pattern}`));
            lines.push('');
        }

        if (analysis.failures.length > 0) {
            lines.push('**📋 Prioritized Failures:**');
            analysis.failures.forEach((failure, index) => {
                const severityIcon = {
                    critical: '🔴',
                    high: '🟠',
                    medium: '🟡',
                    low: '🟢'
                }[failure.severity];

                lines.push(`${severityIcon} **${index + 1}. ${failure.testName}**`);
                lines.push(`   - File: \`${failure.file}${failure.line ? ':' + failure.line : ''}\``);
                lines.push(`   - Category: ${failure.category}`);
                lines.push(`   - Error: ${failure.errorMessage.substring(0, 100)}${failure.errorMessage.length > 100 ? '...' : ''}`);
                if (failure.expected && failure.actual) {
                    lines.push(`   - Expected: \`${failure.expected}\` | Actual: \`${failure.actual}\``);
                }
                lines.push('');
            });
        }

        if (analysis.suggestions.length > 0) {
            lines.push('**💡 Fix Suggestions:**');
            analysis.suggestions.forEach((suggestion, index) => {
                lines.push(`**${index + 1}. ${suggestion.testName}** (${suggestion.confidence} confidence)`);
                lines.push(`   - Issue: ${suggestion.issue}`);
                lines.push(`   - Fix: ${suggestion.suggestedFix}`);
                lines.push('');
            });
        }

        return lines.join('\n');
    }

    private formatFixSuggestionsResponse(suggestions: IFixSuggestion[]): string {
        const lines = [
            `**💡 AI-Powered Fix Suggestions**`,
            `**Total Suggestions:** ${suggestions.length}`,
            ''
        ];

        suggestions.forEach((suggestion, index) => {
            const confidenceIcon = {
                high: '🎯',
                medium: '🎯',
                low: '🤔'
            }[suggestion.confidence];

            lines.push(`${confidenceIcon} **${index + 1}. ${suggestion.testName}**`);
            lines.push(`**Issue:** ${suggestion.issue}`);
            lines.push(`**Suggested Fix:** ${suggestion.suggestedFix}`);
            lines.push(`**Confidence:** ${suggestion.confidence}`);

            if (suggestion.codeExample) {
                lines.push('**Code Example:**');
                lines.push('```javascript');
                lines.push(suggestion.codeExample);
                lines.push('```');
            }
            lines.push('');
        });

        return lines.join('\n');
    }
}

// Register the tool
ToolRegistry.registerTool(IntelligentTestAnalyzerTool);