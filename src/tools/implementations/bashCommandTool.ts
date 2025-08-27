/*---------------------------------------------------------------------------------------------
 * Bash Command Tool - Execute bash commands in the workspace
 * REFACTORED: Removed VSCode dependencies, optimized for CLI usage
 *--------------------------------------------------------------------------------------------*/

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult
} from '../types/cliTypes';

const execAsync = promisify(exec);

interface IBashCommandParams {
    command: string;
    description?: string;
    timeout?: number;
    workingDirectory?: string;
    runInBackground?: boolean;
    [key: string]: unknown;
}

export class BashCommandTool extends BaseTool<IBashCommandParams> {
    readonly name = 'bash';
    readonly description = `Execute bash/shell commands in workspace.

Use when: Running builds, installing packages, git operations, tests, or system commands.

Features: Timeout control, security blocking, output capture, working directory support, background execution.

Examples: "npm run build", "git status", "npm test", "mkdir src/components". SECURITY: Dangerous commands blocked.`;

    // Tag system implementation
    readonly tags = ['command-execution', 'core', 'system'];
    readonly category = 'command-execution';
    readonly complexity: 'core' = 'core';
    readonly inputSchema = {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The bash command to execute',
                examples: ['npm run build', 'git status', 'mkdir src/components', 'node --version']
            },
            description: {
                type: 'string',
                description: 'Clear, concise description of what this command does in 5-10 words'
            },
            timeout: {
                type: 'number',
                description: 'Optional timeout in milliseconds (max 600000ms / 10 minutes). Defaults to 120000ms (2 minutes)',
                minimum: 1000,
                maximum: 600000
            },
            workingDirectory: {
                type: 'string',
                description: 'Working directory to execute the command in. Defaults to workspace root'
            },
            runInBackground: {
                type: 'boolean',
                description: 'Run command in background and return immediately',
                default: false
            }
        },
        required: ['command']
    };

    private static readonly MAX_TIMEOUT = 600000; // 10 minutes
    private static readonly DEFAULT_TIMEOUT = 120000; // 2 minutes
    private static readonly MAX_OUTPUT_LENGTH = 30000; // Truncate if longer

    // Dangerous commands that should be blocked
    private static readonly DANGEROUS_COMMANDS = [
        'rm -rf /', 'rm -rf *', 'rm -rf ~',
        'sudo rm', 'mkfs', 'fdisk',
        'dd if=', 'shutdown', 'reboot',
        'kill -9 -1', 'killall', 'pkill',
        'chmod 777 /', 'chown root',
        'wget http', 'curl http', // Block random downloads
        'ssh ', 'scp ', 'rsync'
    ];

    /**
     * Get cross-platform shell options for command execution
     */
    private getShellOptions(): { shell?: string } {
        const platform = os.platform();
        
        switch (platform) {
            case 'win32':
                // Windows: Try PowerShell first, fallback to cmd
                if (this.isCommandAvailable('powershell.exe')) {
                    return { shell: 'powershell.exe' };
                }
                return {}; // Use default shell (cmd.exe)
                
            case 'darwin':
                // macOS: Try bash, fallback to zsh, then sh
                if (this.isCommandAvailable('/bin/bash')) {
                    return { shell: '/bin/bash' };
                }
                if (this.isCommandAvailable('/bin/zsh')) {
                    return { shell: '/bin/zsh' };
                }
                return { shell: '/bin/sh' };
                
            case 'linux':
                // Linux: Try bash, fallback to sh
                if (this.isCommandAvailable('/bin/bash')) {
                    return { shell: '/bin/bash' };
                }
                if (this.isCommandAvailable('/usr/bin/bash')) {
                    return { shell: '/usr/bin/bash' };
                }
                return { shell: '/bin/sh' };
                
            default:
                // Other Unix-like systems
                if (this.isCommandAvailable('/bin/bash')) {
                    return { shell: '/bin/bash' };
                }
                return { shell: '/bin/sh' };
        }
    }

    /**
     * Check if a command/shell is available on the system
     */
    private isCommandAvailable(command: string): boolean {
        try {
            // For full paths, check if file exists and is executable
            if (command.startsWith('/') || command.includes('\\')) {
                return fs.existsSync(command) && this.isExecutable(command);
            }
            
            // For command names, it would be available in PATH
            // This is a simple check, more sophisticated methods could be used
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if a file is executable
     */
    private isExecutable(filePath: string): boolean {
        try {
            const stats = fs.statSync(filePath);
            // Check if file has execute permissions (Unix-like systems)
            return !!(stats.mode & parseInt('111', 8));
        } catch {
            return false;
        }
    }

    /**
     * Adapt command for cross-platform compatibility
     */
    private adaptCommandForPlatform(command: string): string {
        const platform = os.platform();
        
        if (platform === 'win32') {
            // Windows-specific adaptations
            let adapted = command;
            
            // Convert Unix-style paths to Windows paths
            adapted = adapted.replace(/\/bin\//g, '');
            adapted = adapted.replace(/\/usr\/bin\//g, '');
            
            // Convert common Unix commands to Windows equivalents
            adapted = adapted.replace(/^ls\s/, 'dir ');
            adapted = adapted.replace(/^ls$/, 'dir');
            adapted = adapted.replace(/^cat\s/, 'type ');
            adapted = adapted.replace(/^cat$/, 'type');
            adapted = adapted.replace(/^rm\s/, 'del ');
            adapted = adapted.replace(/^rm$/, 'del');
            adapted = adapted.replace(/^cp\s/, 'copy ');
            adapted = adapted.replace(/^cp$/, 'copy');
            adapted = adapted.replace(/^mv\s/, 'move ');
            adapted = adapted.replace(/^mv$/, 'move');
            
            // Handle mkdir -p specifically
            adapted = adapted.replace(/mkdir\s+-p\s+/, 'mkdir ');
            
            // Convert path separators for Windows
            // But be careful not to break URLs or other contexts
            if (adapted.includes('/') && !adapted.includes('http')) {
                adapted = adapted.replace(/\//g, '\\');
            }
            
            return adapted;
        }
        
        return command; // No adaptation needed for Unix-like systems
    }

    async invoke(
        options: CliToolInvocationOptions<IBashCommandParams>,
        token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { 
            command, 
            description, 
            timeout = BashCommandTool.DEFAULT_TIMEOUT,
            workingDirectory,
            runInBackground = false 
        } = options.input;

        // Validate required parameters
        if (!command || typeof command !== 'string') {
            return this.createErrorResult('command is required and must be a string');
        }

        try {
            // Security check
            const securityIssue = this.checkCommandSecurity(command);
            if (securityIssue) {
                return this.createErrorResult(`Security blocked: ${securityIssue}`);
            }

            // Validate timeout
            const validTimeout = Math.min(Math.max(timeout, 1000), BashCommandTool.MAX_TIMEOUT);
            
            // Determine working directory
            const cwd = workingDirectory ? 
                this.resolveFilePath(workingDirectory) : 
                this.getWorkspaceRoot();

            // Adapt command for cross-platform compatibility
            const adaptedCommand = this.adaptCommandForPlatform(command);
            
            // Log command execution
            console.log(`🔧 Executing command: ${command}`);
            if (adaptedCommand !== command) {
                console.log(`🔄 Adapted for ${os.platform()}: ${adaptedCommand}`);
            }
            if (description) {
                console.log(`📝 Description: ${description}`);
            }
            console.log(`📁 Working directory: ${cwd}`);
            console.log(`⏱️ Timeout: ${validTimeout}ms`);

            return await this.executeBashCommand(adaptedCommand, cwd, validTimeout, token, runInBackground);

        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error executing command');
        }
    }

    private async executeBashCommand(
        command: string,
        cwd: string,
        timeout: number,
        token: CliCancellationToken,
        _runInBackground: boolean
    ): Promise<CliToolResult> {
        const startTime = Date.now();

        try {
            // Setup cancellation
            const controller = new AbortController();
            
            // Handle cancellation token
            if (token.isCancellationRequested) {
                return this.createErrorResult('Command execution was cancelled');
            }

            token.onCancellationRequested(() => {
                controller.abort();
            });

            // Execute command with cross-platform shell expansion support
            const shellOptions = this.getShellOptions();
            const result = await execAsync(command, {
                cwd,
                timeout,
                maxBuffer: 1024 * 1024, // 1MB buffer
                signal: controller.signal,
                ...shellOptions,
                env: {
                    ...process.env,
                    ...this.context.environment
                }
            });

            const executionTime = Date.now() - startTime;

            // Handle output
            let stdout = result.stdout || '';
            let stderr = result.stderr || '';

            // Truncate if too long
            if (stdout.length > BashCommandTool.MAX_OUTPUT_LENGTH) {
                stdout = stdout.substring(0, BashCommandTool.MAX_OUTPUT_LENGTH) + 
                    `\n... (output truncated at ${BashCommandTool.MAX_OUTPUT_LENGTH} characters)`;
            }

            if (stderr.length > BashCommandTool.MAX_OUTPUT_LENGTH) {
                stderr = stderr.substring(0, BashCommandTool.MAX_OUTPUT_LENGTH) + 
                    `\n... (error output truncated at ${BashCommandTool.MAX_OUTPUT_LENGTH} characters)`;
            }

            // Format success response
            const summary = this.formatCommandOutput(command, stdout, stderr, executionTime, cwd);

            return this.createSuccessResult({
                command,
                stdout,
                stderr,
                executionTime,
                cwd,
                exitCode: 0
            }, summary);

        } catch (error: unknown) {
            const executionTime = Date.now() - startTime;
            
            // Handle different error types
            const errorObj = error as { signal?: string; code?: string; killed?: boolean; stdout?: string; stderr?: string; };
            if (errorObj.signal === 'SIGTERM' || errorObj.code === 'ABORT_ERR') {
                return this.createErrorResult('Command execution was cancelled');
            }
            
            if (errorObj.killed && errorObj.signal === 'SIGTERM') {
                return this.createErrorResult(`Command timed out after ${timeout}ms`);
            }

            const stdout = errorObj.stdout || '';
            const stderr = errorObj.stderr || '';
            const exitCode = typeof errorObj.code === 'number' ? errorObj.code : 1;

            // Format error response with details
            const summary = this.formatCommandOutput(command, stdout, stderr, executionTime, cwd, exitCode);

            return this.createErrorResult(summary);
        }
    }

    private checkCommandSecurity(command: string): string | null {
        const lowerCommand = command.toLowerCase().trim();
        
        for (const dangerousCmd of BashCommandTool.DANGEROUS_COMMANDS) {
            if (lowerCommand.includes(dangerousCmd.toLowerCase())) {
                return `Dangerous command pattern detected: '${dangerousCmd}'`;
            }
        }

        // Additional security checks
        if (lowerCommand.includes('sudo') && !lowerCommand.startsWith('sudo npm') && !lowerCommand.startsWith('sudo yarn')) {
            return 'Sudo commands are restricted (except npm/yarn)';
        }

        if (lowerCommand.includes('>/dev/null') || lowerCommand.includes('2>/dev/null')) {
            // This is actually OK - just suppressing output
        }

        return null; // Command is safe
    }

    private formatCommandOutput(
        command: string,
        stdout: string,
        stderr: string,
        executionTime: number,
        cwd: string,
        exitCode?: number
    ): string {
        const lines = [`Command: ${command}`];
        lines.push(`Directory: ${cwd}`);
        lines.push(`Execution time: ${executionTime}ms`);
        
        if (exitCode !== undefined && exitCode !== 0) {
            lines.push(`Exit code: ${exitCode}`);
        }

        if (stdout.trim()) {
            lines.push('', 'Output:', '---', stdout.trim());
        }

        if (stderr.trim()) {
            lines.push('', 'Error Output:', '---', stderr.trim());
        }

        if (!stdout.trim() && !stderr.trim()) {
            lines.push('', 'No output generated');
        }

        return lines.join('\n');
    }
}

// Auto-register the tool
ToolRegistry.registerTool(BashCommandTool);