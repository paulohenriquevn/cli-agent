/*---------------------------------------------------------------------------------------------
 * Edit File Tool - Makes targeted edits to existing files
 * REFACTORED: Removed VSCode dependencies
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult
} from '../types/cliTypes';

interface IEditFileParams {
    filePath: string;
    oldText: string;
    newText: string;
    replaceAll?: boolean;
    [key: string]: unknown;
}

export class EditFileTool extends BaseTool<IEditFileParams> {
    readonly name = 'edit_file';
    readonly description = `Edit existing files by replacing specific text.

Use when: Making targeted code changes, fixing bugs, updating imports, or renaming functions.

Features: Exact text matching, single or multiple replacements, diff preview of changes.

Examples: Fix "let x = 1" to "const x = 1", update imports, rename functions, replace all occurrences.`;

    // Tag system implementation
    readonly tags = ['file_operations', 'core', 'essential'];
    readonly category = 'file_operations';
    readonly complexity: 'essential' = 'essential';
    readonly inputSchema = {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'The path to the file to edit (relative to workspace root or absolute)',
                examples: ['src/app.js', 'utils/helpers.ts', 'config/settings.json']
            },
            oldText: {
                type: 'string',
                description: 'The exact text to find and replace. Must match exactly including whitespace.',
                examples: ['let x = 1', 'import old from "old"', 'function oldName']
            },
            newText: {
                type: 'string',
                description: 'The new text to replace the old text with'
            },
            replaceAll: {
                type: 'boolean',
                description: 'Replace all occurrences of oldText (default: false - replace only first)',
                default: false
            }
        },
        required: ['filePath', 'oldText', 'newText']
    };

    async invoke(
        options: CliToolInvocationOptions<IEditFileParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { filePath, oldText, newText, replaceAll = false } = options.input;

        try {
            return await this.executeEdit(filePath, oldText, newText, replaceAll);
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error editing file');
        }
    }

    private async executeEdit(filePath: string, oldText: string, newText: string, replaceAll: boolean): Promise<CliToolResult> {
        // Validate workspace
        const workspaceError = this.validateWorkspace();
        if (workspaceError) {
            return this.createErrorResult(workspaceError);
        }

        // Resolve file path
        const resolvedPath = this.resolveFilePath(filePath);

        // Check if file exists
        if (!await this.fileExists(filePath)) {
            return this.createErrorResult(`File not found: ${filePath}`);
        }

        // Check if it's a file (not directory)
        const stats = await fs.promises.stat(resolvedPath);
        if (!stats.isFile()) {
            return this.createErrorResult(`Path is not a file: ${filePath}`);
        }

        // Read current content
        const originalContent = await fs.promises.readFile(resolvedPath, 'utf-8');

        // Validate that oldText exists in file
        if (!originalContent.includes(oldText)) {
            return this.createErrorResult(`Text not found in file: "${oldText.substring(0, 50)}${oldText.length > 50 ? '...' : ''}"`);
        }

        // Perform replacement
        let newContent: string;
        let replacementCount: number;

        if (replaceAll) {
            // Replace all occurrences
            const oldLength = originalContent.length;
            newContent = originalContent.split(oldText).join(newText);
            replacementCount = (oldLength - newContent.length + oldText.length * (originalContent.split(oldText).length - 1)) / oldText.length;
        } else {
            // Replace only first occurrence
            const index = originalContent.indexOf(oldText);
            if (index === -1) {
                return this.createErrorResult(`Text not found: "${oldText}"`);
            }
            newContent = originalContent.substring(0, index) + newText + originalContent.substring(index + oldText.length);
            replacementCount = 1;
        }

        // Validate that changes were made
        if (originalContent === newContent) {
            return this.createErrorResult('No changes made - old and new text are identical');
        }

        // Write updated content
        await fs.promises.writeFile(resolvedPath, newContent, 'utf-8');

        // Generate diff preview
        const diffPreview = this.generateDiffPreview(originalContent, newContent, oldText, newText);

        // Get file stats
        const newStats = await fs.promises.stat(resolvedPath);
        const originalLines = originalContent.split('\n').length;
        const newLines = newContent.split('\n').length;

        const summary = `✅ Edited file: ${filePath}
Replacements: ${replacementCount} occurrence${replacementCount !== 1 ? 's' : ''}
Size: ${this.formatFileSize(stats.size)} → ${this.formatFileSize(newStats.size)}
Lines: ${originalLines} → ${newLines}

${diffPreview}`;

        return this.createSuccessResult({
            filePath,
            replacementCount,
            oldSize: stats.size,
            newSize: newStats.size,
            oldLines: originalLines,
            newLines: newLines
        }, summary);
    }

    private generateDiffPreview(originalContent: string, newContent: string, oldText: string, newText: string): string {
        const lines = ['Changes made:'];
        
        // Show the specific change
        const oldPreview = oldText.length > 100 ? oldText.substring(0, 97) + '...' : oldText;
        const newPreview = newText.length > 100 ? newText.substring(0, 97) + '...' : newText;
        
        lines.push('- ' + oldPreview.replace(/\n/g, '\\n'));
        lines.push('+ ' + newPreview.replace(/\n/g, '\\n'));

        // Show context of first change
        const index = originalContent.indexOf(oldText);
        if (index !== -1) {
            const contextStart = Math.max(0, index - 50);
            const contextEnd = Math.min(originalContent.length, index + oldText.length + 50);
            const context = originalContent.substring(contextStart, contextEnd);
            
            lines.push('', 'Context:');
            lines.push('...' + context.replace(/\n/g, '\\n') + '...');
        }

        return lines.join('\n');
    }

    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
}

// Auto-register the tool
ToolRegistry.registerTool(EditFileTool);