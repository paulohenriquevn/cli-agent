/*---------------------------------------------------------------------------------------------
 * CLI Agent SDK - Complete Demo
 * Comprehensive demonstration of ALL 30 tools with real-world examples
 * 
 * This demo shows practical usage of every tool in the CLI Agent SDK
 *--------------------------------------------------------------------------------------------*/

import { CliAgentSDK, SDKConfig } from '../src/sdk';
import * as fs from 'fs-extra';
import * as path from 'path';

// Demo configuration
const demoConfig: Partial<SDKConfig> = {
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    enableHealing: true,
    enableNormalization: true,
    enableLogging: true,
    workingDirectory: path.join(__dirname, 'demo-workspace'),
    sessionId: `comprehensive-demo-${Date.now()}`,
    customLogger: (level, message, data) => {
        console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`);
        if (data) console.log('  Data:', JSON.stringify(data, null, 2));
    }
};

class CompleteDemo {
    private sdk: CliAgentSDK;
    private demoResults: Record<string, any> = {};
    private workspaceDir: string;

    constructor() {
        this.sdk = new CliAgentSDK(demoConfig);
        this.workspaceDir = demoConfig.workingDirectory!;
    }

    async runFullDemo() {
        console.log('🚀 CLI AGENT SDK - COMPLETE DEMO');
        console.log('   Comprehensive demonstration of ALL 30 tools');
        console.log('=' .repeat(80));

        try {
            await this.setupDemo();
            await this.sdk.initialize();
            
            // Get all available tools
            const tools = this.sdk.listTools();
            console.log(`\n📊 Total tools available: ${tools.length}`);
            
            // Group tools by category for organized demonstration
            const toolsByCategory = this.groupToolsByCategory(tools);
            
            // Demonstrate each category
            await this.demonstrateFileOperations(toolsByCategory['files'] || []);
            await this.demonstrateSystemOperations(toolsByCategory['system'] || []);
            await this.demonstrateSearchOperations(toolsByCategory['search'] || []);
            await this.demonstrateWebOperations(toolsByCategory['web'] || []);
            await this.demonstrateAnalysisOperations(toolsByCategory['analysis'] || []);
            await this.demonstrateDevelopmentOperations(toolsByCategory['development'] || []);
            await this.demonstrateAdvancedOperations(toolsByCategory['advanced'] || []);
            await this.demonstrateIntegrationOperations(toolsByCategory['integration'] || []);
            await this.demonstrateOtherOperations(toolsByCategory['other'] || []);

            // Demonstrate batch operations with all tools
            await this.demonstrateBatchOperations();

            // Show final statistics
            await this.showFinalStatistics();

        } catch (error) {
            console.error('❌ Demo failed:', error);
        } finally {
            await this.cleanupDemo();
        }
    }

    private async setupDemo() {
        console.log('\n🔧 Setting up demo workspace...');
        
        // Create demo workspace
        await fs.ensureDir(this.workspaceDir);
        
        // Create sample files for demonstration
        const sampleFiles = {
            'package.json': JSON.stringify({
                name: 'demo-project',
                version: '1.0.0',
                description: 'Demo project for CLI Agent SDK',
                scripts: {
                    start: 'node index.js',
                    test: 'jest',
                    build: 'webpack'
                },
                dependencies: {
                    express: '^4.18.0',
                    lodash: '^4.17.21'
                }
            }, null, 2),
            'index.js': `// Demo JavaScript file
const express = require('express');
const app = express();

// TODO: Add error handling
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// FIXME: Add proper port configuration
app.listen(3000, () => {
    console.log('Server running on port 3000');
});`,
            'README.md': `# Demo Project

This is a demo project for testing CLI Agent SDK.

## Features
- Express server
- Basic routing
- TODO items for testing

## Installation
\`\`\`bash
npm install
\`\`\`
`,
            'test.js': `// Test file
describe('Demo tests', () => {
    test('should pass', () => {
        expect(1 + 1).toBe(2);
    });
    
    // TODO: Add more tests
});`,
            'config.json': JSON.stringify({
                environment: 'development',
                debug: true,
                database: {
                    host: 'localhost',
                    port: 5432
                }
            }, null, 2)
        };

        // Create subdirectories and files
        await fs.ensureDir(path.join(this.workspaceDir, 'src'));
        await fs.ensureDir(path.join(this.workspaceDir, 'tests'));
        await fs.ensureDir(path.join(this.workspaceDir, 'docs'));

        // Write sample files
        for (const [filename, content] of Object.entries(sampleFiles)) {
            await fs.writeFile(path.join(this.workspaceDir, filename), content);
        }

        console.log('✅ Demo workspace created');
    }

    private groupToolsByCategory(tools: any[]): Record<string, any[]> {
        const categories: Record<string, any[]> = {};
        
        for (const tool of tools) {
            const category = tool.category || 'other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(tool);
        }
        
        return categories;
    }

    // FILE OPERATIONS
    private async demonstrateFileOperations(tools: any[]) {
        console.log('\n📁 === FILE OPERATIONS ===');
        
        // read_file
        await this.demonstrateTool('read_file', {
            filePath: path.join(this.workspaceDir, 'package.json')
        });

        // write_file
        await this.demonstrateTool('write_file', {
            filePath: path.join(this.workspaceDir, 'demo-output.txt'),
            content: 'This is a demo file created by CLI Agent SDK!\nTimestamp: ' + new Date().toISOString()
        });

        // edit_file (with potential healing)
        await this.demonstrateTool('edit_file', {
            filePath: path.join(this.workspaceDir, 'index.js'),
            oldText: '// TODO: Add error handling',
            newText: '// Added error handling middleware\napp.use((err, req, res, next) => {\n    console.error(err.stack);\n    res.status(500).send("Something broke!");\n});'
        });

        // multi_edit
        await this.demonstrateTool('multi_edit', {
            file_path: path.join(this.workspaceDir, 'index.js'),
            edits: [
                {
                    old_string: '// FIXME: Add proper port configuration',
                    new_string: '// Port configuration from environment\nconst PORT = process.env.PORT || 3000;'
                },
                {
                    old_string: 'app.listen(3000,',
                    new_string: 'app.listen(PORT,'
                }
            ]
        });

        // text_editor
        await this.demonstrateTool('text_editor', {
            path: path.join(this.workspaceDir, 'README.md'),
            command: 'str_replace',
            old_str: '## Installation',
            new_str: '## CLI Agent SDK Demo\nThis file was modified by the CLI Agent SDK demo.\n\n## Installation'
        });
    }

    // SYSTEM OPERATIONS  
    private async demonstrateSystemOperations(tools: any[]) {
        console.log('\n💻 === SYSTEM OPERATIONS ===');

        // ls (listDirectory)
        await this.demonstrateTool('ls', {
            path: this.workspaceDir
        });

        // execute_command
        await this.demonstrateTool('execute_command', {
            command: process.platform === 'win32' ? 'dir' : 'ls -la',
            workingDirectory: this.workspaceDir
        });

        // bash
        if (process.platform !== 'win32') {
            await this.demonstrateTool('bash', {
                command: 'echo "Hello from bash script!" && pwd && date'
            });
        }
    }

    // SEARCH OPERATIONS
    private async demonstrateSearchOperations(tools: any[]) {
        console.log('\n🔍 === SEARCH OPERATIONS ===');

        // glob
        await this.demonstrateTool('glob', {
            pattern: '**/*.js',
            path: this.workspaceDir
        });

        // grep
        await this.demonstrateTool('grep', {
            pattern: 'TODO|FIXME',
            path: this.workspaceDir,
            outputMode: 'content'
        });

        // search_code
        await this.demonstrateTool('search_code', {
            query: 'express',
            path: this.workspaceDir,
            fileTypes: ['js', 'json']
        });
    }

    // WEB OPERATIONS
    private async demonstrateWebOperations(tools: any[]) {
        console.log('\n🌐 === WEB OPERATIONS ===');

        // web_search
        await this.demonstrateTool('web_search', {
            query: 'Node.js best practices 2024',
            blockedDomains: ['example.com']
        });

        // web_fetch
        await this.demonstrateTool('web_fetch', {
            url: 'https://api.github.com/repos/microsoft/vscode/releases/latest',
            method: 'GET'
        });

        // fetch_documentation
        await this.demonstrateTool('fetch_documentation', {
            url: 'https://nodejs.org/api/fs.html',
            format: 'markdown',
            maxLength: 1000
        });

        // enhanced_web_search
        await this.demonstrateTool('enhanced_web_search', {
            query: 'TypeScript generics tutorial',
            searchDepth: 'basic',
            includeCode: true
        });
    }

    // ANALYSIS OPERATIONS
    private async demonstrateAnalysisOperations(tools: any[]) {
        console.log('\n📊 === ANALYSIS OPERATIONS ===');

        // symbol_analysis
        await this.demonstrateTool('symbol_analysis', {
            action: 'find_usages',
            symbol_name: 'express',
            filePath: path.join(this.workspaceDir, 'index.js'),
            analysisType: 'functions'
        });

        // test_analyzer
        await this.demonstrateTool('test_analyzer', {
            action: 'analyze_failures',
            test_output: 'Test failed: assertion error in test.js',
            testPath: path.join(this.workspaceDir, 'test.js')
        });
    }

    // DEVELOPMENT OPERATIONS
    private async demonstrateDevelopmentOperations(tools: any[]) {
        console.log('\n🛠️ === DEVELOPMENT OPERATIONS ===');

        // todo_write
        await this.demonstrateTool('todo_write', {
            todos: [
                {
                    content: 'Implement user authentication',
                    status: 'pending',
                    activeForm: 'Implementing user authentication'
                },
                {
                    content: 'Add database integration',
                    status: 'in_progress', 
                    activeForm: 'Adding database integration'
                },
                {
                    content: 'Setup CI/CD pipeline',
                    status: 'completed',
                    activeForm: 'Setting up CI/CD pipeline'
                }
            ]
        });

        // create_execution_plan
        await this.demonstrateTool('create_execution_plan', {
            description: 'Refactor authentication system',
            tasks: [
                { content: 'Update login flow', status: 'pending', priority: 'medium', id: '1' },
                { content: 'Add OAuth support', status: 'pending', priority: 'high', id: '2' },
                { content: 'Implement JWT tokens', status: 'pending', priority: 'medium', id: '3' },
                { content: 'Add password reset', status: 'pending', priority: 'low', id: '4' }
            ]
        });

        // exit_plan_mode
        await this.demonstrateTool('exit_plan_mode', {
            plan: 'Complete refactoring of authentication system with OAuth integration and improved security measures.'
        });
    }

    // ADVANCED OPERATIONS
    private async demonstrateAdvancedOperations(tools: any[]) {
        console.log('\n⚡ === ADVANCED OPERATIONS ===');

        // advanced_diff
        await this.demonstrateTool('advanced_diff', {
            action: 'compare_files',
            file_path_1: path.join(this.workspaceDir, 'index.js'),
            file_path_2: path.join(this.workspaceDir, 'README.md'),
            diffType: 'unified'
        });

        // advanced_patch
        const samplePatch = `--- index.js.orig
+++ index.js
@@ -1,4 +1,6 @@
 // Demo JavaScript file
 const express = require('express');
+const cors = require('cors');
 const app = express();
+app.use(cors());`;

        await this.demonstrateTool('advanced_patch', {
            patch: samplePatch,
            targetFile: path.join(this.workspaceDir, 'index.js'),
            dryRun: true
        });

        // computer_use (simulated)
        await this.demonstrateTool('computer_use', {
            action: 'left_click',
            coordinate: [100, 100]
        });
    }

    // INTEGRATION OPERATIONS
    private async demonstrateIntegrationOperations(tools: any[]) {
        console.log('\n🔗 === INTEGRATION OPERATIONS ===');

        // task
        await this.demonstrateTool('task', {
            description: 'Code quality analysis',
            prompt: 'Analyze the JavaScript files for code quality issues and suggest improvements',
            subagent_type: 'code-reviewer'
        });

        // sub_agents
        await this.demonstrateTool('sub_agents', {
            action: 'list',
            taskType: 'security-audit',
            payload: {
                message: 'Audit security of project files',
                targetPath: this.workspaceDir
            }
        });

        // mcp_integration
        await this.demonstrateTool('mcp_integration', {
            server: 'test-server',
            action: 'list_servers'
        });

        // hooks_management
        await this.demonstrateTool('hooks_management', {
            hookType: 'pre-commit',
            action: 'list',
            repoPath: this.workspaceDir
        });
    }

    // OTHER OPERATIONS
    private async demonstrateOtherOperations(tools: any[]) {
        console.log('\n📋 === OTHER OPERATIONS ===');

        // tool_healing (if available) - disabled
        // await this.demonstrateTool('tool_healing', {
        //     originalTool: 'edit_file',
        //     originalParams: {
        //         filePath: path.join(this.workspaceDir, 'test.js'),
        //         oldString: 'some\\nstring\\nwith\\nescapes',
        //         newString: 'corrected string'
        //     },
        //     healingStrategy: 'unescape'
        // });

        // tool_normalization - disabled
        // await this.demonstrateTool('tool_normalization', {
        //     toolName: 'read_file',
        //     modelFamily: 'gpt-4',
        //     inputSchema: {
        //         type: 'object',
        //         properties: {
        //             filePath: { type: 'string' }
        //         }
        //     }
        // });

        // notebook_read (create a sample notebook first)
        const sampleNotebook = {
            cells: [
                {
                    cell_type: 'code',
                    source: ['print("Hello from notebook!")'],
                    outputs: []
                },
                {
                    cell_type: 'markdown', 
                    source: ['# Demo Notebook\nThis is a test notebook.']
                }
            ],
            metadata: {},
            nbformat: 4,
            nbformat_minor: 4
        };

        const notebookPath = path.join(this.workspaceDir, 'demo.ipynb');
        await fs.writeJSON(notebookPath, sampleNotebook);

        await this.demonstrateTool('notebook_read', {
            notebook_path: notebookPath,
            format: 'json'
        });

        // notebook_edit  
        await this.demonstrateTool('notebook_edit', {
            notebook_path: notebookPath,
            edit_mode: 'replace',
            cell_id: '1',
            new_source: 'print("Modified by CLI Agent SDK!")\nprint("Timestamp:", __import__("datetime").datetime.now())',
            cell_type: 'code'
        });

        // advanced_notebook
        await this.demonstrateTool('advanced_notebook', {
            action: 'analyze',
            notebook_path: notebookPath,
            operation: 'analyze'
        });
    }

    // BATCH OPERATIONS DEMONSTRATION
    private async demonstrateBatchOperations() {
        console.log('\n🚀 === BATCH OPERATIONS DEMO ===');

        console.log('Executing parallel batch with multiple tools...');

        const batchResult = await this.sdk.executeBatch({
            operations: [
                {
                    id: 'read-package',
                    toolName: 'read_file',
                    parameters: { filePath: path.join(this.workspaceDir, 'package.json') }
                },
                {
                    id: 'list-files',
                    toolName: 'glob',
                    parameters: { pattern: '**/*', path: this.workspaceDir }
                },
                {
                    id: 'search-todos',
                    toolName: 'grep', 
                    parameters: { pattern: 'TODO|FIXME', path: this.workspaceDir }
                },
                {
                    id: 'web-search',
                    toolName: 'web_search',
                    parameters: { query: 'JavaScript best practices' }
                },
                {
                    id: 'create-summary',
                    toolName: 'write_file',
                    parameters: {
                        filePath: path.join(this.workspaceDir, 'batch-summary.txt'),
                        content: `Batch operation completed at ${new Date().toISOString()}\nThis file was created as part of a batch operation.`
                    }
                }
            ],
            options: {
                parallel: true,
                stopOnError: false,
                timeout: 60000
            }
        });

        console.log(`✅ Batch completed: ${batchResult.metadata.successfulOperations}/${batchResult.metadata.totalOperations} operations successful`);
        console.log(`⏱️  Total execution time: ${batchResult.totalExecutionTime}ms`);

        this.demoResults.batchOperation = batchResult;
    }

    // UTILITY METHOD TO DEMONSTRATE INDIVIDUAL TOOLS
    private async demonstrateTool(toolName: string, parameters: any) {
        try {
            console.log(`\n🔧 Demonstrating: ${toolName}`);
            console.log(`   Parameters:`, JSON.stringify(parameters, null, 2));
            
            const startTime = Date.now();
            const result = await this.sdk.executeTool(toolName, parameters);
            const executionTime = Date.now() - startTime;

            if (result.success) {
                console.log(`   ✅ Success (${executionTime}ms)`);
                if (result.output && result.output.length < 200) {
                    console.log(`   Output: ${result.output}`);
                } else if (result.data) {
                    console.log(`   Data keys: ${Object.keys(result.data).join(', ')}`);
                }
            } else {
                console.log(`   ❌ Failed: ${result.error}`);
            }

            // Store result for final analysis
            this.demoResults[toolName] = {
                success: result.success,
                executionTime,
                hasOutput: !!result.output,
                hasData: !!result.data,
                healingApplied: result.metadata?.healingApplied,
                normalizationApplied: result.metadata?.normalizationApplied
            };

        } catch (error) {
            console.log(`   ❌ Exception: ${error instanceof Error ? error.message : error}`);
            this.demoResults[toolName] = {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private async showFinalStatistics() {
        console.log('\n📊 === FINAL STATISTICS ===');
        
        const stats = this.sdk.getStats();
        console.log('SDK Statistics:', {
            totalTools: stats.totalTools,
            totalExecutions: stats.executionStats.totalExecutions,
            successfulExecutions: stats.executionStats.successfulExecutions,
            failedExecutions: stats.executionStats.failedExecutions,
            averageExecutionTime: `${stats.executionStats.averageExecutionTime.toFixed(2)}ms`
        });

        // Analyze demo results
        const successful = Object.values(this.demoResults).filter((r: any) => r.success).length;
        const total = Object.keys(this.demoResults).length;
        const successRate = ((successful / total) * 100).toFixed(1);

        console.log('\nDemo Results Analysis:');
        console.log(`  Tools tested: ${total}`);
        console.log(`  Successful: ${successful} (${successRate}%)`);
        console.log(`  Failed: ${total - successful}`);

        // Show tools that used healing or normalization
        const healingUsed = Object.entries(this.demoResults)
            .filter(([_, result]: [string, any]) => result.healingApplied)
            .map(([tool, _]) => tool);

        const normalizationUsed = Object.entries(this.demoResults)
            .filter(([_, result]: [string, any]) => result.normalizationApplied) 
            .map(([tool, _]) => tool);

        if (healingUsed.length > 0) {
            console.log(`  Healing applied: ${healingUsed.join(', ')}`);
        }

        if (normalizationUsed.length > 0) {
            console.log(`  Normalization applied: ${normalizationUsed.join(', ')}`);
        }

        // Show category breakdown
        const tools = this.sdk.listTools();
        const categoryStats = tools.reduce((acc, tool) => {
            const category = tool.category || 'other';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('\nTools by Category:');
        Object.entries(categoryStats)
            .sort(([,a], [,b]) => b - a)
            .forEach(([category, count]) => {
                console.log(`  ${category}: ${count} tools`);
            });
    }

    private async cleanupDemo() {
        console.log('\n🧹 Cleaning up demo...');
        
        try {
            await this.sdk.dispose();
            // Optionally remove demo workspace
            // await fs.remove(this.workspaceDir);
            console.log('✅ Demo cleanup completed');
        } catch (error) {
            console.warn('⚠️  Cleanup warning:', error);
        }
    }
}

// Run the complete demo
async function runDemo() {
    const demo = new CompleteDemo();
    await demo.runFullDemo();
}

// Export for use in other files
export { CompleteDemo };

// Run demo if this file is executed directly
if (require.main === module) {
    runDemo().catch(console.error);
}