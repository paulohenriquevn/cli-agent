/*---------------------------------------------------------------------------------------------
 * Execute Command Tool - Enhanced command execution with advanced features
 * REFACTORED: Removed VSCode dependencies
 *--------------------------------------------------------------------------------------------*/

import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult
} from '../types/cliTypes';

const execAsync = promisify(exec);

interface IExecuteCommandParams {
    command: string;
    args?: string[];
    workingDirectory?: string;
    environment?: Record<string, string>;
    timeout?: number;
}

export class ExecuteCommandTool extends BaseTool<IExecuteCommandParams> {
    readonly name = 'execute_command';
    readonly description = `Execute commands with advanced options and environment control.

Use when: Need precise command execution with custom environment, arguments, or advanced options.

Features: Environment variables, argument arrays, working directory control, timeout management.

Examples: Run build scripts, execute tests with specific config, run commands with custom env vars.`;

    readonly tags = ['command-execution', 'advanced', 'system'];
    readonly category = 'command-execution';
    readonly complexity: 'advanced' = 'advanced';
    readonly inputSchema = {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The command to execute',
                examples: ['npm', 'python', 'docker', 'git']
            },
            args: {
                type: 'array',
                items: { type: 'string' },
                description: 'Command arguments as array',
                examples: [['run', 'build'], ['--version'], ['status', '--porcelain']]
            },
            workingDirectory: {
                type: 'string',
                description: 'Working directory for command execution'
            },
            environment: {
                type: 'object',
                description: 'Environment variables to set',
                examples: [{'NODE_ENV': 'production', 'API_KEY': 'secret'}]
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 30000)',
                default: 30000,
                minimum: 1000,
                maximum: 300000
            }
        },
        required: ['command']
    };

    async invoke(
        options: CliToolInvocationOptions<IExecuteCommandParams>,
        token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { command, args = [], workingDirectory, environment, timeout = 30000 } = options.input;

        try {
            return await this.executeAdvancedCommand(command, args, workingDirectory, environment, timeout, token);
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error executing command');
        }
    }

    private async executeAdvancedCommand(
        command: string,
        args: string[],
        workingDirectory?: string,
        environment?: Record<string, string>,
        timeout?: number,
_token?: CliCancellationToken
    ): Promise<CliToolResult> {
        // Validate workspace
        const workspaceError = this.validateWorkspace();
        if (workspaceError) {
            return this.createErrorResult(workspaceError);
        }

        const cwd = workingDirectory ? this.resolveFilePath(workingDirectory) : this.getWorkspaceRoot();
        const fullCommand = `${command} ${args.join(' ')}`;
        
        console.log(`⚡ Executing: ${fullCommand}`);
        console.log(`📁 Directory: ${cwd}`);
        if (environment) {
            console.log(`🌐 Environment: ${Object.keys(environment).join(', ')}`);
        }

        // Check for cancellation
        if (_token?.isCancellationRequested) {
            return this.createErrorResult('Command execution was cancelled');
        }

        try {
            const startTime = Date.now();
            
            // Setup environment
            const env = {
                ...process.env,
                ...this.context.environment,
                ...environment
            };

            const result = await execAsync(fullCommand, {
                cwd,
                timeout,
                env,
                maxBuffer: 1024 * 1024 // 1MB buffer
            });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            const summary = this.formatCommandResult(
                command, 
                args, 
                cwd, 
                environment, 
                executionTime, 
                result.stdout, 
                result.stderr
            );

            return this.createSuccessResult({
                command,
                args,
                workingDirectory: cwd,
                environment,
                executionTime,
                exitCode: 0,
                stdout: result.stdout,
                stderr: result.stderr
            }, summary);

        } catch (error: unknown) {
            const executionTime = Date.now() - Date.now();
            
            const errorObj = error as { stdout?: string; stderr?: string; code?: number; killed?: boolean; signal?: string };
            if (errorObj.killed && errorObj.signal === 'SIGTERM') {
                return this.createErrorResult(`Command timed out after ${timeout}ms`);
            }

            const summary = this.formatCommandResult(
                command,
                args,
                cwd,
                environment,
                executionTime,
                errorObj.stdout || '',
                errorObj.stderr || '',
                errorObj.code || 1
            );

            return this.createErrorResult(summary);
        }
    }

    private formatCommandResult(
        command: string,
        args: string[],
        cwd: string,
        environment?: Record<string, string>,
        executionTime?: number,
        stdout?: string,
        stderr?: string,
        exitCode?: number
    ): string {
        const lines = [`⚡ Advanced Command Execution Complete`];
        lines.push(`Command: ${command} ${args.join(' ')}`);
        lines.push(`Directory: ${cwd}`);
        if (environment) {
            lines.push(`Environment: ${Object.keys(environment).length} variables set`);
        }
        if (executionTime !== undefined) {
            lines.push(`Execution time: ${executionTime}ms`);
        }
        if (exitCode !== undefined && exitCode !== 0) {
            lines.push(`Exit code: ${exitCode}`);
        }
        lines.push('');

        if (stdout?.trim()) {
            lines.push('📤 Output:');
            lines.push(stdout.trim());
            lines.push('');
        }

        if (stderr?.trim()) {
            lines.push('📤 Error Output:');
            lines.push(stderr.trim());
            lines.push('');
        }

        if (!stdout?.trim() && !stderr?.trim()) {
            lines.push('No output generated');
        }

        return lines.join('\n');
    }
}

// Auto-register the tool
ToolRegistry.registerTool(ExecuteCommandTool);