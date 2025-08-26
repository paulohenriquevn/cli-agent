/*---------------------------------------------------------------------------------------------
 * SDK Test - Validate that CLI Agent tools work correctly through the SDK
 * 
 * This test validates the SDK functionality without requiring LangGraph dependencies
 *--------------------------------------------------------------------------------------------*/

import { SDKLangGraph, CLIAgentTools, type SDKLangGraphConfig } from '../SDKLangGraph';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
    test: string;
    passed: boolean;
    error?: string;
    duration?: number;
}

class SDKTestSuite {
    private results: TestResult[] = [];
    private testDir: string;

    constructor() {
        this.testDir = path.join(process.cwd(), 'test-workspace');
    }

    async setupTestEnvironment(): Promise<void> {
        // Create test directory
        if (!fs.existsSync(this.testDir)) {
            fs.mkdirSync(this.testDir, { recursive: true });
        }

        // Create test files
        fs.writeFileSync(
            path.join(this.testDir, 'test.txt'), 
            'Hello World!\nThis is a test file.\nLine 3 content.'
        );

        fs.writeFileSync(
            path.join(this.testDir, 'package.json'),
            JSON.stringify({
                name: 'test-project',
                version: '1.0.0',
                dependencies: {
                    'express': '^4.18.0'
                }
            }, null, 2)
        );

        fs.writeFileSync(
            path.join(this.testDir, 'app.js'),
            `
function greetUser(name) {
    return "Hello " + name;
}

class UserService {
    constructor() {
        this.users = [];
    }
}

const express = require('express');
            `.trim()
        );
    }

    async cleanupTestEnvironment(): Promise<void> {
        if (fs.existsSync(this.testDir)) {
            fs.rmSync(this.testDir, { recursive: true, force: true });
        }
    }

    private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
        const startTime = Date.now();
        try {
            await testFn();
            this.results.push({
                test: testName,
                passed: true,
                duration: Date.now() - startTime
            });
            console.log(`✅ ${testName} - PASSED (${Date.now() - startTime}ms)`);
        } catch (error) {
            this.results.push({
                test: testName,
                passed: false,
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime
            });
            console.log(`❌ ${testName} - FAILED: ${error instanceof Error ? error.message : error}`);
        }
    }

    async runAllTests(): Promise<void> {
        console.log('🧪 Starting LangGraph Bridge Test Suite...\n');

        await this.setupTestEnvironment();

        try {
            // Test 1: Bridge Initialization
            await this.runTest('Bridge Initialization', async () => {
                const config: SDKLangGraphConfig = {
                    workingDirectory: this.testDir,
                    enableLogging: false
                };
                
                const bridge = new SDKLangGraph(config);
                const tools = bridge.getAllTools();
                
                if (tools.length === 0) {
                    throw new Error('No tools returned from bridge');
                }
                
                console.log(`  Found ${tools.length} tools`);
            });

            // Test 2: Tool Filtering
            await this.runTest('Tool Filtering', async () => {
                const bridge = new SDKLangGraph({
                    workingDirectory: this.testDir,
                    includeCategories: ['file_operations']
                });
                
                const fileTools = bridge.getAllTools();
                const hasReadTool = fileTools.some((tool: any) => tool.name === 'read_file');
                
                if (!hasReadTool) {
                    throw new Error('read_file tool not found in file_operations category');
                }
                
                console.log(`  Filtered to ${fileTools.length} file operation tools`);
            });

            // Test 3: CLIAgentTools Convenience Methods
            await this.runTest('CLIAgentTools Convenience Methods', async () => {
                const allTools = CLIAgentTools.getAllTools();
                const fileTools = CLIAgentTools.getFileTools();
                const essentialTools = CLIAgentTools.getEssentialTools();
                
                if (allTools.length === 0) {
                    throw new Error('getAllTools returned empty array');
                }
                
                if (fileTools.length === 0) {
                    throw new Error('getFileTools returned empty array');
                }
                
                if (essentialTools.length === 0) {
                    throw new Error('getEssentialTools returned empty array');
                }
                
                console.log(`  All: ${allTools.length}, File: ${fileTools.length}, Essential: ${essentialTools.length}`);
            });

            // Test 4: Tool Execution - read_file
            await this.runTest('Tool Execution - read_file', async () => {
                const bridge = new SDKLangGraph({
                    workingDirectory: this.testDir,
                    enableLogging: false
                });
                
                const result = await bridge.executeTool('read_file', {
                    filePath: 'test.txt'
                });
                
                if (!result.success) {
                    throw new Error(`Tool execution failed: ${result.error}`);
                }
                
                if (!result.result?.includes('Hello World!')) {
                    throw new Error('File content not correctly read');
                }
                
                console.log(`  Execution time: ${result.executionTimeMs}ms`);
            });

            // Test 5: Tool Execution - ls
            await this.runTest('Tool Execution - ls', async () => {
                const bridge = new SDKLangGraph({
                    workingDirectory: this.testDir,
                    enableLogging: false
                });
                
                const result = await bridge.executeTool('ls', {
                    path: '.'
                });
                
                if (!result.success) {
                    throw new Error(`Tool execution failed: ${result.error}`);
                }
                
                if (!result.result?.includes('test.txt')) {
                    throw new Error('Directory listing does not include test.txt');
                }
                
                console.log(`  Found test files in directory`);
            });

            // Test 6: Tool Execution - search_code
            await this.runTest('Tool Execution - search_code', async () => {
                const bridge = new SDKLangGraph({
                    workingDirectory: this.testDir,
                    enableLogging: false
                });
                
                const result = await bridge.executeTool('search_code', {
                    query: 'function',
                    search_type: 'function',
                    max_results: 5
                });
                
                if (!result.success) {
                    throw new Error(`Tool execution failed: ${result.error}`);
                }
                
                if (!result.result?.includes('greetUser')) {
                    throw new Error('Function search did not find greetUser function');
                }
                
                console.log(`  Found functions in code`);
            });

            // Test 7: Tool Execution - write_file
            await this.runTest('Tool Execution - write_file', async () => {
                const bridge = new SDKLangGraph({
                    workingDirectory: this.testDir,
                    enableLogging: false
                });
                
                const testContent = 'This is a generated test file.';
                const result = await bridge.executeTool('write_file', {
                    filePath: 'generated.txt',
                    content: testContent
                });
                
                if (!result.success) {
                    throw new Error(`Tool execution failed: ${result.error}`);
                }
                
                // Verify file was written
                const filePath = path.join(this.testDir, 'generated.txt');
                if (!fs.existsSync(filePath)) {
                    throw new Error('Generated file does not exist');
                }
                
                const content = fs.readFileSync(filePath, 'utf-8');
                if (!content.includes(testContent)) {
                    throw new Error('Generated file content is incorrect');
                }
                
                console.log(`  File written successfully`);
            });

            // Test 8: Error Handling
            await this.runTest('Error Handling', async () => {
                const bridge = new SDKLangGraph({
                    workingDirectory: this.testDir,
                    enableLogging: false
                });
                
                const result = await bridge.executeTool('read_file', {
                    filePath: 'nonexistent.txt'
                });
                
                if (result.success) {
                    throw new Error('Expected tool to fail for nonexistent file');
                }
                
                if (!result.error?.includes('not found') && !result.error?.includes('does not exist')) {
                    throw new Error('Error message does not indicate file not found');
                }
                
                console.log(`  Error handled correctly: ${result.error}`);
            });

            // Test 9: Tool Metadata
            await this.runTest('Tool Metadata', async () => {
                const bridge = new SDKLangGraph({
                    workingDirectory: this.testDir
                });
                
                const metadata = bridge.getToolsMetadata();
                
                if (metadata.length === 0) {
                    throw new Error('No tool metadata returned');
                }
                
                const readToolMeta = metadata.find((meta: any) => meta.name === 'read_file');
                if (!readToolMeta) {
                    throw new Error('read_file metadata not found');
                }
                
                if (!readToolMeta.parameters || readToolMeta.parameters.length === 0) {
                    throw new Error('read_file parameters not found in metadata');
                }
                
                console.log(`  Metadata for ${metadata.length} tools`);
            });

            // Test 10: Execution Stats
            await this.runTest('Execution Stats', async () => {
                const bridge = new SDKLangGraph({
                    workingDirectory: this.testDir,
                    enableLogging: false
                });
                
                // Execute some tools
                await bridge.executeTool('read_file', { filePath: 'test.txt' });
                await bridge.executeTool('ls', { path: '.' });
                await bridge.executeTool('read_file', { filePath: 'package.json' });
                
                const stats = bridge.getExecutionStats();
                
                if (stats['read_file'] !== 2) {
                    throw new Error(`Expected read_file to be executed 2 times, got ${stats['read_file']}`);
                }
                
                if (stats['ls'] !== 1) {
                    throw new Error(`Expected ls to be executed 1 time, got ${stats['ls']}`);
                }
                
                console.log(`  Stats: ${JSON.stringify(stats)}`);
            });

        } finally {
            await this.cleanupTestEnvironment();
        }
    }

    printSummary(): void {
        console.log('\n📊 Test Summary:');
        console.log('================');
        
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const totalTime = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
        
        console.log(`Total Tests: ${this.results.length}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        console.log(`Total Time: ${totalTime}ms`);
        console.log(`Success Rate: ${Math.round((passed / this.results.length) * 100)}%`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.filter(r => !r.passed).forEach(result => {
                console.log(`  - ${result.test}: ${result.error}`);
            });
        }
        
        console.log(failed === 0 ? '\n🎉 All tests passed! Bridge is working correctly.' : '\n⚠️  Some tests failed. Please review.');
    }

    getResults(): TestResult[] {
        return this.results;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const testSuite = new SDKTestSuite();
    testSuite.runAllTests().then(() => {
        testSuite.printSummary();
        process.exit(testSuite.getResults().some(r => !r.passed) ? 1 : 0);
    }).catch(error => {
        console.error('Test suite failed to run:', error);
        process.exit(1);
    });
}

export { SDKTestSuite };