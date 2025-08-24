/*---------------------------------------------------------------------------------------------
 * CLI Agent SDK - Complete Tools Test
 * Tests ALL 30 tools to ensure maximum functionality and system reliability
 * 
 * This is the definitive test suite for the CLI Agent SDK
 *--------------------------------------------------------------------------------------------*/

import { CliAgentSDK } from '../src/sdk';
import * as fs from 'fs-extra';
import * as path from 'path';

interface TestResult {
    toolName: string;
    success: boolean;
    executionTime: number;
    error?: string;
    output?: string;
    category: string;
    complexity: string;
}

class AllToolsTest {
    private sdk: CliAgentSDK;
    private results: TestResult[] = [];
    private workspaceDir: string;

    constructor() {
        this.sdk = new CliAgentSDK({
            openRouterApiKey: process.env.OPENROUTER_API_KEY || 'demo-key',
            enableLogging: false, // Reduce noise
            workingDirectory: path.join(__dirname, 'test-workspace'),
        });
        this.workspaceDir = path.join(__dirname, 'test-workspace');
    }

    async runAllTests(): Promise<void> {
        console.log('🚀 CLI AGENT SDK - COMPLETE TOOLS TEST');
        console.log('   Testing ALL 30 tools for maximum functionality');
        console.log('=' .repeat(80));

        try {
            await this.setupTestWorkspace();
            await this.sdk.initialize();

            const tools = this.sdk.listTools();
            console.log(`\n📊 Testando ${tools.length} ferramentas...\n`);

            // Test each tool
            for (const tool of tools) {
                await this.testTool(tool);
            }

            // Show comprehensive results
            await this.showResults();

        } catch (error) {
            console.error('❌ Test setup failed:', error);
        } finally {
            await this.cleanup();
        }
    }

    private async setupTestWorkspace(): Promise<void> {
        console.log('🔧 Setting up test workspace...');
        
        await fs.ensureDir(this.workspaceDir);
        
        // Create test files
        const testFiles = {
            'test-file.txt': 'Hello World!\nThis is a test file.\nTODO: Add more content',
            'test-data.json': JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2),
            'test-script.js': 'console.log("Hello from test script!");',
            'test-notebook.ipynb': JSON.stringify({
                cells: [
                    { cell_type: 'code', source: ['print("Hello from notebook!")'] }
                ],
                metadata: {},
                nbformat: 4,
                nbformat_minor: 4
            }, null, 2)
        };

        for (const [filename, content] of Object.entries(testFiles)) {
            await fs.writeFile(path.join(this.workspaceDir, filename), content);
        }

        console.log('✅ Test workspace ready');
    }

    private async testTool(toolInfo: any): Promise<void> {
        const startTime = Date.now();
        
        try {
            process.stdout.write(`🔧 Testing ${toolInfo.name.padEnd(25)} `);
            
            let result;
            const testParams = this.getTestParams(toolInfo.name);
            
            if (testParams === null) {
                // Skip this tool - no test params defined
                process.stdout.write(`⏭️  SKIP (no test defined)\n`);
                this.results.push({
                    toolName: toolInfo.name,
                    success: false,
                    executionTime: 0,
                    error: 'No test defined',
                    category: toolInfo.category,
                    complexity: toolInfo.complexity
                });
                return;
            }

            result = await this.sdk.executeTool(toolInfo.name, testParams);
            
            const executionTime = Date.now() - startTime;
            const success = result.success;
            
            if (success) {
                process.stdout.write(`✅ SUCCESS (${executionTime}ms)\n`);
            } else {
                process.stdout.write(`❌ FAILED (${executionTime}ms): ${result.error}\n`);
            }

            this.results.push({
                toolName: toolInfo.name,
                success,
                executionTime,
                error: result.error,
                output: result.output?.substring(0, 100),
                category: toolInfo.category,
                complexity: toolInfo.complexity
            });

        } catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            process.stdout.write(`💥 ERROR (${executionTime}ms): ${errorMessage}\n`);
            
            this.results.push({
                toolName: toolInfo.name,
                success: false,
                executionTime,
                error: errorMessage,
                category: toolInfo.category,
                complexity: toolInfo.complexity
            });
        }
    }

    private getTestParams(toolName: string): any {
        const testFilePath = path.join(this.workspaceDir, 'test-file.txt');
        const testDataPath = path.join(this.workspaceDir, 'test-data.json');
        const notebookPath = path.join(this.workspaceDir, 'test-notebook.ipynb');
        
        const params: Record<string, any> = {
            // File Operations
            'read_file': { filePath: testFilePath },
            'write_file': { filePath: path.join(this.workspaceDir, 'output.txt'), content: 'Test output' },
            'edit_file': { filePath: testFilePath, oldText: 'TODO: Add more content', newText: 'Content added by test' },
            'multi_edit': { file_path: testFilePath, edits: [{ old_string: 'Hello', new_string: 'Hi' }] },
            'text_editor': { path: testFilePath, command: 'view' },

            // System Operations
            'bash': { command: 'echo "Test bash script"' },
            'execute_command': { command: 'echo "Test command"' },
            'ls': { path: this.workspaceDir },

            // Search Operations
            'glob': { pattern: '*.txt', path: this.workspaceDir },
            'grep': { pattern: 'Hello', path: this.workspaceDir, outputMode: 'files_with_matches' },
            'search_code': { query: 'test', path: this.workspaceDir },

            // Web Operations
            'web_search': { query: 'test query' },
            'web_fetch': { url: 'https://httpbin.org/json', method: 'GET' },
            'fetch_documentation': { url: 'https://httpbin.org/html', format: 'text' },
            'enhanced_web_search': { query: 'nodejs tutorial', searchDepth: 'basic' },

            // AI/Task Operations  
            'task': { description: 'Test task', prompt: 'This is a test', subagent_type: 'general-purpose' },
            'todo_write': { todos: [{ content: 'Test todo', status: 'pending', activeForm: 'Testing todo' }] },

            // Advanced Operations
            'advanced_diff': { action: 'compare_files', file_path_1: testFilePath, file_path_2: testDataPath, diffType: 'unified' },
            'advanced_patch': { patch: '--- a/test\n+++ b/test\n@@ -1 +1 @@\n-old\n+new', targetFile: testFilePath, dryRun: true },
            'computer_use': { action: 'left_click', coordinate: [100, 100] },

            // Planning Operations
            'create_execution_plan': { description: 'Test plan', tasks: [{ content: 'Step 1', status: 'pending', priority: 'medium', id: '1' }, { content: 'Step 2', status: 'pending', priority: 'medium', id: '2' }] },
            'exit_plan_mode': { plan: 'Test plan completed' },

            // Analysis Operations
            'symbol_analysis': { action: 'find_usages', symbol_name: 'test', filePath: path.join(this.workspaceDir, 'test-script.js'), analysisType: 'functions' },
            'test_analyzer': { action: 'analyze_failures', test_output: 'Test failed: assertion error', testPath: testFilePath },

            // Notebook Operations
            'notebook_read': { notebook_path: notebookPath, format: 'json' },
            'notebook_edit': { notebook_path: notebookPath, edit_mode: 'insert', cellIndex: 0, new_source: 'print("Modified!")', cell_type: 'code' },
            'advanced_notebook': { action: 'analyze', notebook_path: notebookPath, operation: 'analyze' },

            // Integration Operations
            'sub_agents': { action: 'list', taskType: 'test', payload: { message: 'test' } },
            'mcp_integration': { server: 'test-server', action: 'list_servers' },
            'hooks_management': { hookType: 'pre-commit', action: 'list', repoPath: this.workspaceDir }
        };

        return params[toolName] || null;
    }

    private async showResults(): Promise<void> {
        console.log('\n' + '=' .repeat(80));
        console.log('📊 RESULTADOS FINAIS - TESTE COMPLETO DE TODAS AS FERRAMENTAS');
        console.log('=' .repeat(80));

        const successful = this.results.filter(r => r.success);
        const failed = this.results.filter(r => !r.success);
        const skipped = this.results.filter(r => r.error === 'No test defined');

        console.log(`\n🎯 RESUMO GERAL:`);
        console.log(`   Total de ferramentas: ${this.results.length}`);
        console.log(`   ✅ Sucessos: ${successful.length} (${((successful.length / this.results.length) * 100).toFixed(1)}%)`);
        console.log(`   ❌ Falhas: ${failed.length - skipped.length} (${(((failed.length - skipped.length) / this.results.length) * 100).toFixed(1)}%)`);
        console.log(`   ⏭️  Puladas: ${skipped.length} (${((skipped.length / this.results.length) * 100).toFixed(1)}%)`);

        // Group by category
        const byCategory: Record<string, TestResult[]> = {};
        for (const result of this.results) {
            if (!byCategory[result.category]) {
                byCategory[result.category] = [];
            }
            byCategory[result.category].push(result);
        }

        console.log(`\n📋 RESULTADOS POR CATEGORIA:`);
        for (const [category, results] of Object.entries(byCategory)) {
            const success = results.filter(r => r.success).length;
            const total = results.length;
            const rate = ((success / total) * 100).toFixed(1);
            console.log(`   ${category.padEnd(25)}: ${success}/${total} (${rate}%)`);
        }

        // Group by complexity
        const byComplexity: Record<string, TestResult[]> = {};
        for (const result of this.results) {
            if (!byComplexity[result.complexity]) {
                byComplexity[result.complexity] = [];
            }
            byComplexity[result.complexity].push(result);
        }

        console.log(`\n⚡ RESULTADOS POR COMPLEXIDADE:`);
        for (const [complexity, results] of Object.entries(byComplexity)) {
            const success = results.filter(r => r.success).length;
            const total = results.length;
            const rate = ((success / total) * 100).toFixed(1);
            console.log(`   ${complexity.padEnd(15)}: ${success}/${total} (${rate}%)`);
        }

        // Show failed tools
        if (failed.length > skipped.length) {
            console.log(`\n❌ FERRAMENTAS COM FALHAS:`);
            for (const result of failed) {
                if (result.error !== 'No test defined') {
                    console.log(`   ${result.toolName.padEnd(25)}: ${result.error}`);
                }
            }
        }

        // Show performance stats
        const totalTime = this.results.reduce((sum, r) => sum + r.executionTime, 0);
        const avgTime = totalTime / this.results.length;
        
        console.log(`\n⚡ PERFORMANCE:`);
        console.log(`   Tempo total: ${totalTime}ms`);
        console.log(`   Tempo médio: ${avgTime.toFixed(2)}ms por ferramenta`);
        console.log(`   Ferramenta mais rápida: ${this.results.sort((a, b) => a.executionTime - b.executionTime)[0]?.toolName} (${Math.min(...this.results.map(r => r.executionTime))}ms)`);
        console.log(`   Ferramenta mais lenta: ${this.results.sort((a, b) => b.executionTime - a.executionTime)[0]?.toolName} (${Math.max(...this.results.map(r => r.executionTime))}ms)`);

        // Final verdict
        const successRate = (successful.length / this.results.length) * 100;
        console.log(`\n🏆 RESULTADO FINAL:`);
        
        if (successRate >= 90) {
            console.log(`   🥇 EXCELENTE! Taxa de sucesso: ${successRate.toFixed(1)}%`);
            console.log(`   🎉 Sistema CLI Agent SDK está TOTALMENTE FUNCIONAL!`);
        } else if (successRate >= 75) {
            console.log(`   🥈 BOM! Taxa de sucesso: ${successRate.toFixed(1)}%`);
            console.log(`   ⚡ Sistema CLI Agent SDK está MAJORITARIAMENTE FUNCIONAL!`);
        } else if (successRate >= 50) {
            console.log(`   🥉 PARCIAL. Taxa de sucesso: ${successRate.toFixed(1)}%`);
            console.log(`   🔧 Sistema CLI Agent SDK precisa de ajustes.`);
        } else {
            console.log(`   ❌ PROBLEMAS. Taxa de sucesso: ${successRate.toFixed(1)}%`);
            console.log(`   🚨 Sistema CLI Agent SDK precisa de correções significativas.`);
        }

        console.log('\n' + '=' .repeat(80));
    }

    private async cleanup(): Promise<void> {
        await this.sdk.dispose();
        // Optionally clean test workspace
        // await fs.remove(this.workspaceDir);
        console.log('\n✅ Teste completo finalizado.');
    }
}

// Run the comprehensive test
if (require.main === module) {
    const test = new AllToolsTest();
    test.runAllTests().catch(console.error);
}

export { AllToolsTest };