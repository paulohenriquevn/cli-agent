#!/usr/bin/env ts-node

/*---------------------------------------------------------------------------------------------
 * Test CLI Tools - Verificar se sistema funciona sem VSCode
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from './src/tools/registry/toolRegistry';
import { CliExecutionContext, CliCancellationToken } from './src/tools/types/cliTypes';

// Import the refactored tools
import './src/tools/implementations/readFileTool';
import './src/tools/implementations/writeFileTool';
import './src/tools/implementations/editFileTool';
import './src/tools/implementations/bashCommandTool';
import './src/tools/implementations/grepTool';
import './src/tools/implementations/listDirectoryTool';
import './src/tools/implementations/globTool';
import './src/tools/implementations/multiEditTool';
import './src/tools/implementations/todoWriteTool';
import './src/tools/implementations/taskTool';
import './src/tools/implementations/webFetchTool';
import './src/tools/implementations/exitPlanModeTool';
import './src/tools/implementations/webSearchTool';
import './src/tools/implementations/executeCommandTool';

async function testCliTools() {
    console.log('🧪 Testing CLI Tools System...\n');

    // Create test context
    const context: CliExecutionContext = {
        workingDirectory: process.cwd(),
        environment: process.env as Record<string, string>,
        sessionId: 'test-session',
        timeout: 30000,
        verbose: true
    };

    const registry = ToolRegistry.getInstance();
    registry.setDefaultContext(context);

    console.log('📊 Registry Statistics:');
    const stats = registry.getStatistics();
    console.log(JSON.stringify(stats, null, 2));
    console.log('');

    // Test validation
    console.log('✅ Validating all tools...');
    const validation = await registry.validateAllTools(context);
    console.log(`Valid tools: ${validation.valid.length}`);
    console.log(`Invalid tools: ${validation.invalid.length}`);
    
    if (validation.invalid.length > 0) {
        console.log('❌ Invalid tools:');
        validation.invalid.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.error}`);
        });
    }
    console.log('');

    // Test tool execution
    console.log('🔧 Testing tool execution...\n');

    try {
        // Test 1: Read this test file
        console.log('1. Testing read_file...');
        const readResult = await registry.executeTool('read_file', {
            filePath: 'test-cli-tools.ts',
            limit: 10
        }, context);
        
        console.log('Result:', readResult.getText().substring(0, 200) + '...');
        console.log('✅ read_file works!\n');

        // Test 2: Write a test file
        console.log('2. Testing write_file...');
        const writeResult = await registry.executeTool('write_file', {
            filePath: 'test-output.txt',
            content: `CLI Tools Test
Generated at: ${new Date().toISOString()}
Working directory: ${context.workingDirectory}
Session ID: ${context.sessionId}

This file was created by the CLI tools system to test functionality.`
        }, context);
        
        console.log('Result:', writeResult.getText());
        console.log('✅ write_file works!\n');

        // Test 3: Execute a bash command
        console.log('3. Testing bash command...');
        const bashResult = await registry.executeTool('bash', {
            command: 'ls -la test-output.txt',
            description: 'List the test file we just created'
        }, context);
        
        console.log('Result:', bashResult.getText());
        console.log('✅ bash command works!\n');

        // Test 4: Edit the file we created
        console.log('4. Testing edit_file...');
        const editResult = await registry.executeTool('edit_file', {
            filePath: 'test-output.txt',
            oldText: 'CLI Tools Test',
            newText: 'CLI Tools Test - EDITED!'
        }, context);
        
        console.log('Result:', editResult.getText().substring(0, 300) + '...');
        console.log('✅ edit_file works!\n');

        // Test 5: List directory contents
        console.log('5. Testing ls (list directory)...');
        const lsResult = await registry.executeTool('ls', {
            path: '.',
            ignore: ['node_modules', '.git']
        }, context);
        
        console.log('Result:', lsResult.getText().substring(0, 400) + '...');
        console.log('✅ ls works!\n');

        // Test 6: Search for files
        console.log('6. Testing grep...');
        const grepResult = await registry.executeTool('grep', {
            pattern: 'CLI Tools Test',
            filePattern: '*.txt'
        }, context);
        
        console.log('Result:', grepResult.getText());
        console.log('✅ grep works!\n');

    } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    }

    console.log('🎉 All CLI tools tests passed!');
    console.log('🚀 System is ready for CLI usage without VSCode dependencies.');
}

// Run the test
if (require.main === module) {
    testCliTools().catch(error => {
        console.error('💥 Test failed:', error);
        process.exit(1);
    });
}