#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 * Direct CLI - LLM-Friendly tool execution without conversational layer
 *--------------------------------------------------------------------------------------------*/

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import dotenv from 'dotenv';

import { ToolRegistry } from './tools/registry/toolRegistry';
import { CliExecutionContext, CliCancellationToken } from './tools/types/cliTypes';

// Load environment variables
dotenv.config();

// Import ALL tools to ensure they're registered
import './tools/implementations/readFileTool';
import './tools/implementations/writeFileTool';
import './tools/implementations/editFileTool';
import './tools/implementations/bashCommandTool';
import './tools/implementations/executeCommandTool';
import './tools/implementations/globTool';
import './tools/implementations/grepTool';
import './tools/implementations/listDirectoryTool';
import './tools/implementations/webSearchTool';
import './tools/implementations/webFetchTool';
import './tools/implementations/taskTool';
import './tools/implementations/todoWriteTool';
import './tools/implementations/multiEditTool';
import './tools/implementations/advancedDiffTool';
import './tools/implementations/advancedNotebookTool';
import './tools/implementations/advancedPatchTool';
import './tools/implementations/computerUseTool';
import './tools/implementations/createExecutionPlanTool';
import './tools/implementations/enhancedWebSearchTool';
import './tools/implementations/exitPlanModeTool';
import './tools/implementations/fetchDocumentationTool';
import './tools/implementations/hooksManagementTool';
import './tools/implementations/intelligentTestAnalyzerTool';
import './tools/implementations/mcpIntegrationTool';
import './tools/implementations/notebookEditTool';
import './tools/implementations/notebookReadTool';
import './tools/implementations/searchCodeTool';
import './tools/implementations/subAgentsTool';
import './tools/implementations/symbolAnalysisTool';
import './tools/implementations/textEditorTool';
import './tools/implementations/toolHealingTool';
import './tools/implementations/toolNormalizationTool';

const program = new Command();

// Global execution context
const context: CliExecutionContext = {
    workingDirectory: process.cwd(),
    sessionId: `cli-session-${Date.now()}`,
    environment: process.env
};

/**
 * Execute any registered tool directly
 */
async function executeTool(toolName: string, params: Record<string, unknown>): Promise<void> {
    try {
        const cancellationToken = new CliCancellationToken();
        const result = await ToolRegistry.executeTool(toolName, params, context, cancellationToken);
        
        if (result.isSuccess) {
            // Output the result
            if (result.output && typeof result.output === 'string') {
                console.log(result.output);
            } else if (result.data) {
                console.log(JSON.stringify(result.data, null, 2));
            }
            process.exit(0);
        } else {
            console.error(chalk.red('❌ Tool execution failed:'), result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

// Dynamically create commands for all registered tools
function createToolCommands(): void {
    const tools = ToolRegistry.getTools();
    
    for (const tool of tools) {
        const command = program
            .command(tool.name)
            .description(tool.description);
        
        // Add options based on tool schema
        if (tool.inputSchema && tool.inputSchema.properties) {
            for (const [propName, propSchema] of Object.entries(tool.inputSchema.properties as Record<string, unknown>)) {
                const isRequired = tool.inputSchema.required?.includes(propName) || false;
                const optionFlag = `--${propName} <${propName}>`;
                const description = (propSchema as { description?: string }).description || `${propName} parameter`;
                
                if (isRequired) {
                    command.requiredOption(optionFlag, description);
                } else {
                    command.option(optionFlag, description);
                }
            }
        }
        
        command.action(async (options) => {
            await executeTool(tool.name, options);
        });
    }
}

// List all available tools
program
    .command('list-tools')
    .description('List all available tools')
    .action(() => {
        const tools = ToolRegistry.getTools();
        const stats = ToolRegistry.getStats();
        
        console.log(chalk.blue(`🛠️  Available Tools (${stats.totalTools})`));
        console.log(chalk.gray('=' .repeat(50)));
        
        const categories = ToolRegistry.getCategories();
        for (const category of categories) {
            const categoryTools = ToolRegistry.getToolsByCategory(category);
            if (categoryTools.length > 0) {
                console.log(chalk.yellow(`\n📂 ${category.toUpperCase()}`));
                for (const tool of categoryTools) {
                    console.log(`  ${chalk.green(tool.name)} - ${tool.description}`);
                }
            }
        }
        
        // Tools without category
        const uncategorizedTools = tools.filter(tool => !tool.category);
        if (uncategorizedTools.length > 0) {
            console.log(chalk.yellow('\n📂 OTHER'));
            for (const tool of uncategorizedTools) {
                console.log(`  ${chalk.green(tool.name)} - ${tool.description}`);
            }
        }
    });

// Tool info command
program
    .command('tool-info <toolName>')
    .description('Get detailed information about a specific tool')
    .action((toolName: string) => {
        const tool = ToolRegistry.getTool(toolName);
        
        if (!tool) {
            console.error(chalk.red(`❌ Tool '${toolName}' not found`));
            console.log(chalk.yellow('💡 Use "list-tools" to see available tools'));
            process.exit(1);
        }
        
        console.log(chalk.blue(`🔧 Tool: ${tool.name}`));
        console.log(chalk.gray('=' .repeat(50)));
        console.log(`${chalk.yellow('Description:')} ${tool.description}`);
        console.log(`${chalk.yellow('Category:')} ${tool.category || 'None'}`);
        console.log(`${chalk.yellow('Complexity:')} ${tool.complexity}`);
        
        if (tool.tags && tool.tags.length > 0) {
            console.log(`${chalk.yellow('Tags:')} ${tool.tags.join(', ')}`);
        }
        
        if (tool.inputSchema && tool.inputSchema.properties) {
            console.log(chalk.yellow('\nParameters:'));
            const required = tool.inputSchema.required || [];
            
            for (const [propName, propSchema] of Object.entries(tool.inputSchema.properties as Record<string, unknown>)) {
                const isRequired = required.includes(propName);
                const mark = isRequired ? chalk.red('*') : ' ';
                const schemaObj = propSchema as { type?: string; description?: string; examples?: unknown[] };
                console.log(`  ${mark}${chalk.green(`--${propName}`)} <${schemaObj.type || 'string'}> - ${schemaObj.description || 'No description'}`);
                
                if (schemaObj.examples) {
                    console.log(`    ${chalk.gray('Examples:')} ${JSON.stringify(schemaObj.examples)}`);
                }
            }
            
            console.log(chalk.gray('\n* Required parameters'));
        }
        
        // Usage example
        console.log(chalk.yellow('\nUsage:'));
        let exampleCommand = `cli-agent ${tool.name}`;
        
        if (tool.inputSchema && tool.inputSchema.properties) {
            const required = tool.inputSchema.required || [];
            for (const propName of required) {
                exampleCommand += ` --${propName}="<value>"`;
            }
        }
        
        console.log(`  ${chalk.cyan(exampleCommand)}`);
    });

// Status command
program
    .command('status')
    .description('Show CLI status and statistics')
    .action(() => {
        const stats = ToolRegistry.getStats();
        
        console.log(chalk.blue('📊 CLI Agent Status'));
        console.log(chalk.gray('=' .repeat(30)));
        console.log(`${chalk.yellow('Working Directory:')} ${context.workingDirectory}`);
        console.log(`${chalk.yellow('Session ID:')} ${context.sessionId}`);
        console.log(`${chalk.yellow('Total Tools:')} ${stats.totalTools}`);
        console.log(`${chalk.yellow('Categories:')} ${stats.categoriesCount}`);
        
        console.log(chalk.blue('\n🏷️  Tools by Category:'));
        for (const [category, count] of Object.entries(stats.toolsByCategory)) {
            console.log(`  ${chalk.green(category)}: ${count}`);
        }
        
        console.log(chalk.blue('\n⚡ Tools by Complexity:'));
        for (const [complexity, count] of Object.entries(stats.toolsByComplexity)) {
            console.log(`  ${chalk.green(complexity)}: ${count}`);
        }
    });

// Raw execute command (for dynamic tool calling)
program
    .command('execute <toolName>')
    .description('Execute a tool with JSON parameters')
    .option('-p, --params <params>', 'Parameters as JSON string')
    .option('-f, --file <file>', 'Load parameters from JSON file')
    .action(async (toolName: string, options) => {
        let params: Record<string, unknown> = {};
        
        try {
            if (options.file) {
                const filePath = path.resolve(options.file);
                params = await fs.readJson(filePath);
            } else if (options.params) {
                params = JSON.parse(options.params);
            }
            
            await executeTool(toolName, params);
            
        } catch (error) {
            console.error(chalk.red('❌ Error parsing parameters:'), error);
            process.exit(1);
        }
    });

// Help override to show tools
program.on('--help', () => {
    console.log('\nAvailable Tools:');
    const tools = ToolRegistry.getTools().slice(0, 5); // Show first 5
    for (const tool of tools) {
        console.log(`  ${chalk.green(tool.name)} - ${tool.description}`);
    }
    console.log(`\nUse ${chalk.cyan('cli-agent list-tools')} to see all available tools`);
    console.log(`Use ${chalk.cyan('cli-agent tool-info <toolName>')} for detailed tool information`);
});

// Error handling
program.on('command:*', () => {
    console.error(chalk.red('❌ Invalid command'));
    console.log(chalk.yellow('💡 Use --help to see available commands and tools'));
    process.exit(1);
});

// Configure program
program
    .name('cli-agent')
    .description('LLM-Friendly CLI for direct tool execution')
    .version('1.0.0');

// Create tool commands dynamically
createToolCommands();

// Parse arguments
if (process.argv.length === 2) {
    // No arguments, show help
    program.help();
} else {
    program.parse();
}