/*---------------------------------------------------------------------------------------------
 * Text Editor Tool - Advanced text editing with multiple methods
 * Replicates Claude Code's Text Editor Tool functionality
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';

interface ITextEditorParams {
    command: 'view' | 'str_replace' | 'create' | 'insert' | 'undo_edit';
    path?: string;
    file_text?: string;
    old_str?: string;
    new_str?: string;
    insert_line?: number;
    view_range?: [number, number];
}

interface IEditHistory {
    path: string;
    original_content: string;
    modified_content: string;
    timestamp: number;
    operation: string;
}

export class TextEditorTool extends BaseTool<ITextEditorParams> {
    readonly name = 'text_editor';
    readonly description = `Advanced text editing system - Comprehensive file operations with five specialized commands and undo capability for precise code modifications.

Use when: Needing fine-grained control over text modifications, performing safe string replacements, executing line-based insertions, requiring undo functionality, or conducting careful code editing with change tracking.

Features: Five specialized commands (view, str_replace, create, insert, undo_edit), edit history management, unique string matching for safe replacements, directory browsing, and rollback operations.

Examples: Safely replacing function names across files, creating new configuration files, inserting code at specific line numbers, viewing file ranges, or undoing recent text modifications.`;

    // Tag system implementation
    readonly tags = ['text-editing', 'file-operations', 'undo', 'string-replacement', 'file-creation', 'line-insertion'];
    readonly category = 'file-operations';
    readonly complexity: 'core' | 'advanced' | 'essential' = 'core';

    readonly inputSchema = {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                enum: ['view', 'str_replace', 'create', 'insert', 'undo_edit'],
                description: 'The editing command to execute'
            },
            path: {
                type: 'string',
                description: 'File path (required for most commands)'
            },
            file_text: {
                type: 'string',
                description: 'File content for create command'
            },
            old_str: {
                type: 'string',
                description: 'String to replace (for str_replace command)'
            },
            new_str: {
                type: 'string',
                description: 'Replacement string (for str_replace command)'
            },
            insert_line: {
                type: 'number',
                description: 'Line number to insert at (for insert command)'
            },
            view_range: {
                type: 'array',
                items: { type: 'number' },
                minItems: 2,
                maxItems: 2,
                description: 'Range [start_line, end_line] for view command'
            }
        },
        required: ['command']
    };

    private static editHistory: IEditHistory[] = [];
    private static readonly MAX_HISTORY = 50;

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ITextEditorParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const params = options.input;

        try {
            switch (params.command) {
                case 'view':
                    return await this.handleView(params);
                case 'str_replace':
                    return await this.handleStrReplace(params);
                case 'create':
                    return await this.handleCreate(params);
                case 'insert':
                    return await this.handleInsert(params);
                case 'undo_edit':
                    return await this.handleUndoEdit(params);
                default:
                    return this.createErrorResult(`Unknown command: ${params.command}`);
            }
        } catch (error: any) {
            return this.createErrorResult(`Text editor operation failed: ${error.message}`);
        }
    }

    private async handleView(params: ITextEditorParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.path) {
            return this.createErrorResult('path is required for view command');
        }

        const fullPath = path.isAbsolute(params.path) ? params.path : path.resolve(this.getWorkspaceRoot(), params.path);

        try {
            const stats = await fs.stat(fullPath);

            if (stats.isDirectory()) {
                // List directory contents
                const items = await fs.readdir(fullPath, { withFileTypes: true });
                const contents = items.map(item => {
                    const type = item.isDirectory() ? 'DIR' : 'FILE';
                    return `${type}: ${item.name}`;
                }).join('\n');

                return this.createSuccessResult(null, [
                    `**📁 Directory View: \`${params.path}\`**`,
                    '',
                    '```',
                    contents,
                    '```'
                ].join('\n'));
            } else {
                // Read file content
                const content = await fs.readFile(fullPath, 'utf8');
                const lines = content.split('\n');

                let viewContent = content;
                let lineInfo = `1-${lines.length}`;

                if (params.view_range && Array.isArray(params.view_range) && params.view_range.length === 2) {
                    const [start, end] = params.view_range;
                    const startLine = Math.max(1, start) - 1; // Convert to 0-based
                    const endLine = Math.min(lines.length, end);

                    viewContent = lines.slice(startLine, endLine).join('\n');
                    lineInfo = `${start}-${end}`;
                }

                return this.createSuccessResult(null, [
                    `**📄 File View: \`${params.path}\` (Lines ${lineInfo})**`,
                    '',
                    '```',
                    viewContent,
                    '```'
                ].join('\n'));
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return this.createErrorResult(`File or directory not found: ${params.path}`);
            }
            throw error;
        }
    }

    private async handleStrReplace(params: ITextEditorParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.path || !params.old_str || params.new_str === undefined) {
            return this.createErrorResult('path, old_str, and new_str are required for str_replace command');
        }

        const fullPath = path.isAbsolute(params.path) ? params.path : path.resolve(this.getWorkspaceRoot(), params.path);

        // Read current content
        const originalContent = await fs.readFile(fullPath, 'utf8');

        // Perform replacement
        const oldStr = params.old_str;
        const newStr = params.new_str;

        // Check if old_str exists
        if (!originalContent.includes(oldStr)) {
            return this.createErrorResult(`String not found in file: "${oldStr}"`);
        }

        // Check if old_str is unique
        const occurrences = (originalContent.match(new RegExp(this.escapeRegExp(oldStr), 'g')) || []).length;
        if (occurrences > 1) {
            return this.createErrorResult(`String "${oldStr}" appears ${occurrences} times. Please provide a more specific string that appears only once.`);
        }

        // Perform replacement
        const newContent = originalContent.replace(oldStr, newStr);

        // Save edit to history
        this.saveEditToHistory(fullPath, originalContent, newContent, 'str_replace');

        // Write file
        await fs.writeFile(fullPath, newContent, 'utf8');

        // Notify VS Code
        const uri = vscode.Uri.file(fullPath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(newContent, 'utf8'));

        return this.createSuccessResult(null, [
            `**✏️ String Replace Complete**`,
            `**File:** \`${params.path}\``,
            `**Replaced:** \`${oldStr.substring(0, 50)}${oldStr.length > 50 ? '...' : ''}\``,
            `**With:** \`${newStr.substring(0, 50)}${newStr.length > 50 ? '...' : ''}\``,
            '',
            '✅ File updated successfully'
        ].join('\n'));
    }

    private async handleCreate(params: ITextEditorParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.path || params.file_text === undefined) {
            return this.createErrorResult('path and file_text are required for create command');
        }

        const fullPath = path.isAbsolute(params.path) ? params.path : path.resolve(this.getWorkspaceRoot(), params.path);

        // Check if file already exists
        try {
            await fs.access(fullPath);
            return this.createErrorResult(`File already exists: ${params.path}`);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        // Ensure directory exists
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });

        // Create file
        await fs.writeFile(fullPath, params.file_text, 'utf8');

        // Notify VS Code
        const uri = vscode.Uri.file(fullPath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(params.file_text, 'utf8'));

        return this.createSuccessResult(null, [
            `**📝 File Created**`,
            `**Path:** \`${params.path}\``,
            `**Size:** ${params.file_text.length} characters`,
            '',
            '✅ File created successfully'
        ].join('\n'));
    }

    private async handleInsert(params: ITextEditorParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.path || params.file_text === undefined || params.insert_line === undefined) {
            return this.createErrorResult('path, file_text, and insert_line are required for insert command');
        }

        const fullPath = path.isAbsolute(params.path) ? params.path : path.resolve(this.getWorkspaceRoot(), params.path);

        // Read current content
        const originalContent = await fs.readFile(fullPath, 'utf8');
        const lines = originalContent.split('\n');

        // Validate line number
        const insertLine = params.insert_line;
        if (insertLine < 1 || insertLine > lines.length + 1) {
            return this.createErrorResult(`Invalid line number. Must be between 1 and ${lines.length + 1}`);
        }

        // Insert content
        const insertIndex = insertLine - 1; // Convert to 0-based
        lines.splice(insertIndex, 0, params.file_text);
        const newContent = lines.join('\n');

        // Save edit to history
        this.saveEditToHistory(fullPath, originalContent, newContent, 'insert');

        // Write file
        await fs.writeFile(fullPath, newContent, 'utf8');

        // Notify VS Code
        const uri = vscode.Uri.file(fullPath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(newContent, 'utf8'));

        return this.createSuccessResult(null, [
            `**📝 Text Inserted**`,
            `**File:** \`${params.path}\``,
            `**Line:** ${insertLine}`,
            `**Content:** \`${params.file_text.substring(0, 50)}${params.file_text.length > 50 ? '...' : ''}\``,
            '',
            '✅ Text inserted successfully'
        ].join('\n'));
    }

    private async handleUndoEdit(params: ITextEditorParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.path) {
            return this.createErrorResult('path is required for undo_edit command');
        }

        const fullPath = path.isAbsolute(params.path) ? params.path : path.resolve(this.getWorkspaceRoot(), params.path);

        // Find most recent edit for this file
        const recentEdit = TextEditorTool.editHistory
            .filter(edit => edit.path === fullPath)
            .sort((a, b) => b.timestamp - a.timestamp)[0];

        if (!recentEdit) {
            return this.createErrorResult(`No edit history found for file: ${params.path}`);
        }

        // Restore original content
        await fs.writeFile(fullPath, recentEdit.original_content, 'utf8');

        // Notify VS Code
        const uri = vscode.Uri.file(fullPath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(recentEdit.original_content, 'utf8'));

        // Remove from history
        const editIndex = TextEditorTool.editHistory.indexOf(recentEdit);
        TextEditorTool.editHistory.splice(editIndex, 1);

        return this.createSuccessResult(null, [
            `**↶ Undo Edit Complete**`,
            `**File:** \`${params.path}\``,
            `**Operation:** ${recentEdit.operation}`,
            `**Timestamp:** ${new Date(recentEdit.timestamp).toLocaleString()}`,
            '',
            '✅ File reverted to previous state'
        ].join('\n'));
    }

    private saveEditToHistory(filePath: string, originalContent: string, modifiedContent: string, operation: string): void {
        const edit: IEditHistory = {
            path: filePath,
            original_content: originalContent,
            modified_content: modifiedContent,
            timestamp: Date.now(),
            operation
        };

        TextEditorTool.editHistory.push(edit);

        // Keep only recent edits
        if (TextEditorTool.editHistory.length > TextEditorTool.MAX_HISTORY) {
            TextEditorTool.editHistory.shift();
        }
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Static methods for accessing edit history
    public static getEditHistory(): IEditHistory[] {
        return [...TextEditorTool.editHistory];
    }

    public static clearEditHistory(): void {
        TextEditorTool.editHistory = [];
    }
}

// Register the tool
ToolRegistry.getInstance().registerTool(TextEditorTool);