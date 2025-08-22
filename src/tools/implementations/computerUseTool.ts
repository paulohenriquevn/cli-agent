/*---------------------------------------------------------------------------------------------
 * Computer Use Tool - Desktop interaction capabilities
 * Replicates Claude Code's Computer Use Tool functionality
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';

interface IComputerUseParams {
    action: 'screenshot' | 'left_click' | 'right_click' | 'middle_click' | 'double_click' | 'triple_click' |
            'type' | 'key' | 'scroll' | 'mouse_move' | 'left_click_drag';
    coordinate?: [number, number];
    text?: string;
    key?: string;
    scroll_direction?: 'up' | 'down' | 'left' | 'right';
    scroll_amount?: number;
    drag_to?: [number, number];
}

export class ComputerUseTool extends BaseTool<IComputerUseParams> {
    readonly name = 'computer_use';
    readonly description = 'Control the desktop with mouse clicks, keyboard input, and screen capture (like Claude Computer Use).\n\nUse this when you need to interact with applications outside VS Code, capture screenshots for analysis, automate GUI interactions, or control desktop applications. Perfect for testing user interfaces, documenting workflows, or automating repetitive desktop tasks. Essential for scenarios requiring interaction with system dialogs or external applications.\n\nWorks cross-platform (Windows, macOS, Linux) with native system APIs and tools. Supports all mouse actions (click, drag, scroll), keyboard input (text typing, key combinations), and screen capture. Automatically handles platform differences and provides visual feedback.\n\nExamples: Taking screenshot to analyze current desktop state, clicking "OK" button at coordinates [300, 400], typing "hello world" into active application, pressing "Ctrl+C" to copy, scrolling down 3 times, or dragging from [100,100] to [200,200].';
    readonly tags = ['advanced-tools', 'advanced', 'desktop', 'automation'];
    readonly category = 'advanced-tools';
    readonly complexity = 'advanced';
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['screenshot', 'left_click', 'right_click', 'middle_click', 'double_click', 'triple_click',
                    'type', 'key', 'scroll', 'mouse_move', 'left_click_drag'],
                description: 'The desktop action to perform'
            },
            coordinate: {
                type: 'array',
                items: { type: 'number' },
                minItems: 2,
                maxItems: 2,
                description: 'X, Y coordinates for mouse actions'
            },
            text: {
                type: 'string',
                description: 'Text to type (for type action)'
            },
            key: {
                type: 'string',
                description: 'Key to press (e.g., "Enter", "Escape", "Tab", "Ctrl+C")'
            },
            scroll_direction: {
                type: 'string',
                enum: ['up', 'down', 'left', 'right'],
                description: 'Direction to scroll'
            },
            scroll_amount: {
                type: 'number',
                description: 'Amount to scroll (default: 3)',
                default: 3
            },
            drag_to: {
                type: 'array',
                items: { type: 'number' },
                minItems: 2,
                maxItems: 2,
                description: 'End coordinates for drag action'
            }
        },
        required: ['action']
    };

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IComputerUseParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const params = options.input;

        try {
            // Check if running in a supported environment
            if (typeof process === 'undefined' || !process.platform) {
                return this.createErrorResult('Computer use actions are not supported in browser environment');
            }

            switch (params.action) {
                case 'screenshot':
                    return await this.handleScreenshot();
                case 'left_click':
                case 'right_click':
                case 'middle_click':
                case 'double_click':
                case 'triple_click':
                    return await this.handleClick(params);
                case 'type':
                    return await this.handleType(params);
                case 'key':
                    return await this.handleKey(params);
                case 'scroll':
                    return await this.handleScroll(params);
                case 'mouse_move':
                    return await this.handleMouseMove(params);
                case 'left_click_drag':
                    return await this.handleDrag(params);
                default:
                    return this.createErrorResult(`Unknown action: ${params.action}`);
            }
        } catch (_error: any) {
            return this.createErrorResult(`Computer use action failed: ${_error.message}`);
        }
    }

    private async handleScreenshot(): Promise<vscode.LanguageModelToolResult> {
        try {
            // Create a platform-specific screenshot command
            let screenshotCommand: string = '';
            let outputPath: string;

            switch (process.platform) {
                case 'win32': {
                    // Windows: Use PowerShell Add-Type for screenshot
                    outputPath = path.join(require('os').tmpdir(), `screenshot_${Date.now()}.png`);
                    screenshotCommand = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | ForEach-Object { $bitmap = New-Object System.Drawing.Bitmap $_.Width, $_.Height; $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($_.X, $_.Y, 0, 0, $_.Size); $bitmap.Save('${outputPath}', [System.Drawing.Imaging.ImageFormat]::Png); $graphics.Dispose(); $bitmap.Dispose() }"`;
                    break;
                }

                case 'darwin': {
                    // macOS: Use screencapture
                    outputPath = path.join(require('os').tmpdir(), `screenshot_${Date.now()}.png`);
                    screenshotCommand = `screencapture -x "${outputPath}"`;
                    break;
                }

                case 'linux': {
                    // Linux: Try multiple screenshot tools
                    outputPath = path.join(require('os').tmpdir(), `screenshot_${Date.now()}.png`);

                    // Try different screenshot tools in order of preference
                    const tools = [
                        `gnome-screenshot -f "${outputPath}"`,
                        `scrot "${outputPath}"`,
                        `import -window root "${outputPath}"`, // ImageMagick
                        `spectacle -b -o "${outputPath}"` // KDE
                    ];

                    let toolFound = false;
                    for (const tool of tools) {
                        try {
                            const toolName = tool.split(' ')[0];
                            await this.executeCommand(`which ${toolName}`);
                            screenshotCommand = tool;
                            toolFound = true;
                            break;
                        } catch {
                            continue;
                        }
                    }

                    if (!toolFound) {
                        return this.createErrorResult(
                            'No screenshot tool found. Please install one of: gnome-screenshot, scrot, imagemagick, or spectacle'
                        );
                    }
                    break;
                }

                default:
                    return this.createErrorResult(`Screenshot not supported on platform: ${process.platform}`);
            }

            // Execute screenshot command
            await this.executeCommand(screenshotCommand);

            // Verify file was created
            try {
                await fs.access(outputPath);
            } catch {
                return this.createErrorResult('Screenshot failed - output file not created');
            }

            // Copy screenshot to workspace if possible
            const workspaceRoot = this.getWorkspaceRoot();
            const workspaceScreenshotPath = path.join(workspaceRoot, 'screenshots', `screenshot_${Date.now()}.png`);

            try {
                await fs.mkdir(path.dirname(workspaceScreenshotPath), { recursive: true });
                await fs.copyFile(outputPath, workspaceScreenshotPath);

                // Show screenshot in VS Code
                const uri = vscode.Uri.file(workspaceScreenshotPath);
                await vscode.commands.executeCommand('vscode.open', uri);

                return this.createSuccessResult(null, [
                    `**📸 Screenshot Captured**`,
                    `**Saved to:** \`${path.relative(workspaceRoot, workspaceScreenshotPath)}\``,
                    `**Temp file:** \`${outputPath}\``,
                    '',
                    '✅ Screenshot opened in VS Code'
                ].join('\n'));
            } catch {
                // Fallback: just return temp path
                return this.createSuccessResult(null, [
                    `**📸 Screenshot Captured**`,
                    `**Location:** \`${outputPath}\``,
                    '',
                    '✅ Screenshot saved successfully'
                ].join('\n'));
            }

        } catch (_error: any) {
            return this.createErrorResult(`Screenshot failed: ${_error.message}`);
        }
    }

    private async handleClick(params: IComputerUseParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.coordinate || params.coordinate.length !== 2) {
            return this.createErrorResult('coordinate [x, y] is required for click actions');
        }

        const [x, y] = params.coordinate;
        const actionName = params.action.replace('_', ' ');

        try {
            let command: string;

            switch (process.platform) {
                case 'win32': {
                    // Windows: Use PowerShell with Windows API
                    const clickType = this.getWindowsClickType(params.action);
                    command = `powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\\"user32.dll\\")] public static extern void SetCursorPos(int x, int y); [DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo); }'; [Mouse]::SetCursorPos(${x}, ${y}); Start-Sleep -Milliseconds 100; [Mouse]::mouse_event(${clickType}, 0, 0, 0, 0)"`;
                    break;
                }

                case 'darwin': {
                    // macOS: Use AppleScript
                    const macClickType = this.getMacClickType(params.action);
                    command = `osascript -e 'tell application "System Events" to ${macClickType} at {${x}, ${y}}'`;
                    break;
                }

                case 'linux':
                    // Linux: Use xdotool
                    try {
                        await this.executeCommand('which xdotool');
                        const linuxClickType = this.getLinuxClickType(params.action);
                        command = `xdotool mousemove ${x} ${y} ${linuxClickType}`;
                    } catch {
                        return this.createErrorResult('xdotool is required for click actions on Linux. Please install it: sudo apt install xdotool');
                    }
                    break;

                default:
                    return this.createErrorResult(`Click actions not supported on platform: ${process.platform}`);
            }

            await this.executeCommand(command);

            return this.createSuccessResult(null, [
                `**🖱️ ${actionName.charAt(0).toUpperCase() + actionName.slice(1)} Complete**`,
                `**Coordinates:** (${x}, ${y})`,
                '',
                '✅ Click action executed successfully'
            ].join('\n'));

        } catch (_error: any) {
            return this.createErrorResult(`Click action failed: ${_error.message}`);
        }
    }

    private async handleType(params: IComputerUseParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.text) {
            return this.createErrorResult('text is required for type action');
        }

        try {
            let command: string;

            switch (process.platform) {
                case 'win32': {
                    // Windows: Use PowerShell SendKeys
                    const escapedText = params.text.replace(/[+^%~(){}[\]]/g, '{$&}');
                    command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedText}')"`;
                    break;
                }

                case 'darwin': {
                    // macOS: Use AppleScript
                    const escapedMacText = params.text.replace(/"/g, '\\"');
                    command = `osascript -e 'tell application "System Events" to keystroke "${escapedMacText}"'`;
                    break;
                }

                case 'linux':
                    // Linux: Use xdotool
                    try {
                        await this.executeCommand('which xdotool');
                        command = `xdotool type "${params.text}"`;
                    } catch {
                        return this.createErrorResult('xdotool is required for typing on Linux. Please install it: sudo apt install xdotool');
                    }
                    break;

                default:
                    return this.createErrorResult(`Type action not supported on platform: ${process.platform}`);
            }

            await this.executeCommand(command);

            return this.createSuccessResult(null, [
                `**⌨️ Text Typed**`,
                `**Content:** \`${params.text.substring(0, 100)}${params.text.length > 100 ? '...' : ''}\``,
                '',
                '✅ Text input completed successfully'
            ].join('\n'));

        } catch (_error: any) {
            return this.createErrorResult(`Type action failed: ${_error.message}`);
        }
    }

    private async handleKey(params: IComputerUseParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.key) {
            return this.createErrorResult('key is required for key action');
        }

        try {
            let command: string;

            switch (process.platform) {
                case 'win32': {
                    // Windows: Use PowerShell SendKeys
                    const winKey = this.convertKeyToWindows(params.key);
                    command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${winKey}')"`;
                    break;
                }

                case 'darwin': {
                    // macOS: Use AppleScript
                    const macKey = this.convertKeyToMac(params.key);
                    command = `osascript -e 'tell application "System Events" to ${macKey}'`;
                    break;
                }

                case 'linux': {
                    // Linux: Use xdotool
                    try {
                        await this.executeCommand('which xdotool');
                        const linuxKey = this.convertKeyToLinux(params.key);
                        command = `xdotool key ${linuxKey}`;
                    } catch {
                        return this.createErrorResult('xdotool is required for key actions on Linux. Please install it: sudo apt install xdotool');
                    }
                    break;
                }

                default:
                    return this.createErrorResult(`Key action not supported on platform: ${process.platform}`);
            }

            await this.executeCommand(command);

            return this.createSuccessResult(null, [
                `**⌨️ Key Pressed**`,
                `**Key:** \`${params.key}\``,
                '',
                '✅ Key action executed successfully'
            ].join('\n'));

        } catch (_error: any) {
            return this.createErrorResult(`Key action failed: ${_error.message}`);
        }
    }

    private async handleScroll(params: IComputerUseParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.scroll_direction) {
            return this.createErrorResult('scroll_direction is required for scroll action');
        }

        const amount = params.scroll_amount || 3;

        try {
            let command: string;

            switch (process.platform) {
                case 'win32': {
                    // Windows: Use PowerShell mouse_event
                    const winScrollCode = params.scroll_direction === 'up' ? 120 : params.scroll_direction === 'down' ? -120 : 0;
                    if (winScrollCode === 0) {
                        return this.createErrorResult('Only up/down scrolling supported on Windows');
                    }
                    command = `powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo); }'; for($i=0; $i -lt ${amount}; $i++) { [Mouse]::mouse_event(0x0800, 0, 0, ${winScrollCode}, 0); Start-Sleep -Milliseconds 50 }"`;
                    break;
                }

                case 'darwin': {
                    // macOS: Use AppleScript
                    const macScrollDir = params.scroll_direction === 'up' ? 'up' : params.scroll_direction === 'down' ? 'down' :
                        params.scroll_direction === 'left' ? 'left' : 'right';
                    command = `osascript -e 'tell application "System Events" to repeat ${amount} times' -e 'scroll ${macScrollDir} 1' -e 'delay 0.05' -e 'end repeat'`;
                    break;
                }

                case 'linux': {
                    // Linux: Use xdotool
                    try {
                        await this.executeCommand('which xdotool');
                        const linuxScrollButton = this.getLinuxScrollButton(params.scroll_direction);
                        command = `for i in $(seq 1 ${amount}); do xdotool click ${linuxScrollButton}; sleep 0.05; done`;
                    } catch {
                        return this.createErrorResult('xdotool is required for scroll actions on Linux. Please install it: sudo apt install xdotool');
                    }
                    break;
                }

                default:
                    return this.createErrorResult(`Scroll action not supported on platform: ${process.platform}`);
            }

            await this.executeCommand(command);

            return this.createSuccessResult(null, [
                `**🖱️ Scroll Complete**`,
                `**Direction:** ${params.scroll_direction}`,
                `**Amount:** ${amount}`,
                '',
                '✅ Scroll action executed successfully'
            ].join('\n'));

        } catch (_error: any) {
            return this.createErrorResult(`Scroll action failed: ${_error.message}`);
        }
    }

    private async handleMouseMove(params: IComputerUseParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.coordinate || params.coordinate.length !== 2) {
            return this.createErrorResult('coordinate [x, y] is required for mouse_move action');
        }

        const [x, y] = params.coordinate;

        try {
            let command: string;

            switch (process.platform) {
                case 'win32':
                    // Windows: Use PowerShell SetCursorPos
                    command = `powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\\"user32.dll\\")] public static extern void SetCursorPos(int x, int y); }'; [Mouse]::SetCursorPos(${x}, ${y})"`;
                    break;

                case 'darwin':
                    // macOS: Use Python with Quartz (if available) or AppleScript workaround
                    command = `osascript -e 'tell application "System Events" to set mouseLocation to {${x}, ${y}}'`;
                    break;

                case 'linux':
                    // Linux: Use xdotool
                    try {
                        await this.executeCommand('which xdotool');
                        command = `xdotool mousemove ${x} ${y}`;
                    } catch {
                        return this.createErrorResult('xdotool is required for mouse movement on Linux. Please install it: sudo apt install xdotool');
                    }
                    break;

                default:
                    return this.createErrorResult(`Mouse movement not supported on platform: ${process.platform}`);
            }

            await this.executeCommand(command);

            return this.createSuccessResult(null, [
                `**🖱️ Mouse Moved**`,
                `**Position:** (${x}, ${y})`,
                '',
                '✅ Mouse movement completed successfully'
            ].join('\n'));

        } catch (_error: any) {
            return this.createErrorResult(`Mouse movement failed: ${_error.message}`);
        }
    }

    private async handleDrag(params: IComputerUseParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.coordinate || params.coordinate.length !== 2) {
            return this.createErrorResult('coordinate [x, y] is required for drag start position');
        }

        if (!params.drag_to || params.drag_to.length !== 2) {
            return this.createErrorResult('drag_to [x, y] is required for drag end position');
        }

        const [startX, startY] = params.coordinate;
        const [endX, endY] = params.drag_to;

        try {
            let command: string;

            switch (process.platform) {
                case 'win32':
                    // Windows: Use PowerShell with mouse events
                    command = `powershell -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\\"user32.dll\\")] public static extern void SetCursorPos(int x, int y); [DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo); }'; [Mouse]::SetCursorPos(${startX}, ${startY}); Start-Sleep -Milliseconds 100; [Mouse]::mouse_event(0x0002, 0, 0, 0, 0); Start-Sleep -Milliseconds 100; [Mouse]::SetCursorPos(${endX}, ${endY}); Start-Sleep -Milliseconds 100; [Mouse]::mouse_event(0x0004, 0, 0, 0, 0)"`;
                    break;

                case 'darwin':
                    // macOS: Use AppleScript
                    command = `osascript -e 'tell application "System Events"' -e 'set mouseLocation to {${startX}, ${startY}}' -e 'mouse down at {${startX}, ${startY}}' -e 'delay 0.1' -e 'set mouseLocation to {${endX}, ${endY}}' -e 'delay 0.1' -e 'mouse up at {${endX}, ${endY}}' -e 'end tell'`;
                    break;

                case 'linux':
                    // Linux: Use xdotool
                    try {
                        await this.executeCommand('which xdotool');
                        command = `xdotool mousemove ${startX} ${startY} mousedown 1 mousemove ${endX} ${endY} mouseup 1`;
                    } catch {
                        return this.createErrorResult('xdotool is required for drag actions on Linux. Please install it: sudo apt install xdotool');
                    }
                    break;

                default:
                    return this.createErrorResult(`Drag action not supported on platform: ${process.platform}`);
            }

            await this.executeCommand(command);

            return this.createSuccessResult(null, [
                `**🖱️ Drag Complete**`,
                `**From:** (${startX}, ${startY})`,
                `**To:** (${endX}, ${endY})`,
                '',
                '✅ Drag action executed successfully'
            ].join('\n'));

        } catch (_error: any) {
            return this.createErrorResult(`Drag action failed: ${_error.message}`);
        }
    }

    // Helper methods for platform-specific implementations
    private async executeCommand(command: string): Promise<void> {
        const { exec } = require('child_process');
        return new Promise((resolve, reject) => {
            exec(command, (error: any, _stdout: any, _stderr: any) => {
                if (error) {
                    reject(new Error(`Command failed: ${error.message}`));
                } else {
                    resolve();
                }
            });
        });
    }

    private getWindowsClickType(action: string): number {
        switch (action) {
            case 'left_click': return 0x0002; // MOUSEEVENTF_LEFTDOWN
            case 'right_click': return 0x0008; // MOUSEEVENTF_RIGHTDOWN
            case 'middle_click': return 0x0020; // MOUSEEVENTF_MIDDLEDOWN
            case 'double_click': return 0x0002; // Will need double execution
            case 'triple_click': return 0x0002; // Will need triple execution
            default: return 0x0002;
        }
    }

    private getMacClickType(action: string): string {
        switch (action) {
            case 'left_click': return 'click';
            case 'right_click': return 'right click';
            case 'middle_click': return 'middle click';
            case 'double_click': return 'double click';
            case 'triple_click': return 'triple click';
            default: return 'click';
        }
    }

    private getLinuxClickType(action: string): string {
        switch (action) {
            case 'left_click': return 'click 1';
            case 'right_click': return 'click 3';
            case 'middle_click': return 'click 2';
            case 'double_click': return 'click --repeat 2 1';
            case 'triple_click': return 'click --repeat 3 1';
            default: return 'click 1';
        }
    }

    private getLinuxScrollButton(direction: string): string {
        switch (direction) {
            case 'up': return '4';
            case 'down': return '5';
            case 'left': return '6';
            case 'right': return '7';
            default: return '5';
        }
    }

    private convertKeyToWindows(key: string): string {
        const keyMap: { [key: string]: string } = {
            'Enter': '{ENTER}',
            'Tab': '{TAB}',
            'Escape': '{ESC}',
            'Space': ' ',
            'Backspace': '{BACKSPACE}',
            'Delete': '{DELETE}',
            'Home': '{HOME}',
            'End': '{END}',
            'PageUp': '{PGUP}',
            'PageDown': '{PGDN}',
            'ArrowUp': '{UP}',
            'ArrowDown': '{DOWN}',
            'ArrowLeft': '{LEFT}',
            'ArrowRight': '{RIGHT}',
            'F1': '{F1}', 'F2': '{F2}', 'F3': '{F3}', 'F4': '{F4}',
            'F5': '{F5}', 'F6': '{F6}', 'F7': '{F7}', 'F8': '{F8}',
            'F9': '{F9}', 'F10': '{F10}', 'F11': '{F11}', 'F12': '{F12}',
            'Ctrl+C': '^c',
            'Ctrl+V': '^v',
            'Ctrl+X': '^x',
            'Ctrl+Z': '^z',
            'Ctrl+Y': '^y',
            'Ctrl+A': '^a',
            'Ctrl+S': '^s'
        };

        return keyMap[key] || key;
    }

    private convertKeyToMac(key: string): string {
        const keyMap: { [key: string]: string } = {
            'Enter': 'key code 36',
            'Tab': 'key code 48',
            'Escape': 'key code 53',
            'Space': 'key code 49',
            'Backspace': 'key code 51',
            'Delete': 'key code 117',
            'Home': 'key code 115',
            'End': 'key code 119',
            'PageUp': 'key code 116',
            'PageDown': 'key code 121',
            'ArrowUp': 'key code 126',
            'ArrowDown': 'key code 125',
            'ArrowLeft': 'key code 123',
            'ArrowRight': 'key code 124',
            'Ctrl+C': 'key code 8 using command down',
            'Ctrl+V': 'key code 9 using command down',
            'Ctrl+X': 'key code 7 using command down',
            'Ctrl+Z': 'key code 6 using command down',
            'Ctrl+A': 'key code 0 using command down',
            'Ctrl+S': 'key code 1 using command down'
        };

        return keyMap[key] || `keystroke "${key}"`;
    }

    private convertKeyToLinux(key: string): string {
        const keyMap: { [key: string]: string } = {
            'Enter': 'Return',
            'Tab': 'Tab',
            'Escape': 'Escape',
            'Space': 'space',
            'Backspace': 'BackSpace',
            'Delete': 'Delete',
            'Home': 'Home',
            'End': 'End',
            'PageUp': 'Page_Up',
            'PageDown': 'Page_Down',
            'ArrowUp': 'Up',
            'ArrowDown': 'Down',
            'ArrowLeft': 'Left',
            'ArrowRight': 'Right',
            'Ctrl+C': 'ctrl+c',
            'Ctrl+V': 'ctrl+v',
            'Ctrl+X': 'ctrl+x',
            'Ctrl+Z': 'ctrl+z',
            'Ctrl+Y': 'ctrl+y',
            'Ctrl+A': 'ctrl+a',
            'Ctrl+S': 'ctrl+s'
        };

        return keyMap[key] || key;
    }
}

// Register the tool
ToolRegistry.getInstance().registerTool(ComputerUseTool);