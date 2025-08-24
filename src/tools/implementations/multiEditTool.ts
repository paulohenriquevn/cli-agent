/*---------------------------------------------------------------------------------------------
 * Multi Edit Tool - Perform multiple edits to a single file in one operation
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

interface IEditOperation {
    old_string: string;
    new_string: string;
    replace_all?: boolean;
}

interface IMultiEditParams {
    file_path: string;
    edits: IEditOperation[];
}

export class MultiEditTool extends BaseTool<IMultiEditParams> {
    readonly name = 'multi_edit';
    readonly description = `Make multiple edits to ONE file in single operation.

Use when: Making several related changes to the same file, refactoring code, batch updates.

Features: Atomic operations (all succeed or none), sequential application, change preview.

Examples: Update imports + function names, fix multiple bugs in one file, batch renaming.`;

    readonly tags = ['file_operations', 'advanced', 'editing'];
    readonly category = 'file_operations';
    readonly complexity: 'advanced' = 'advanced';
    readonly inputSchema = {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'The path to the file to edit (absolute or relative to workspace)',
                examples: ['src/components/Button.tsx', 'utils/helpers.js']
            },
            edits: {
                type: 'array',
                description: 'Array of edit operations to perform sequentially',
                items: {
                    type: 'object',
                    properties: {
                        old_string: {
                            type: 'string',
                            description: 'The text to replace'
                        },
                        new_string: {
                            type: 'string',
                            description: 'The replacement text'
                        },
                        replace_all: {
                            type: 'boolean',
                            description: 'Replace all occurrences (default: false)',
                            default: false
                        }
                    },
                    required: ['old_string', 'new_string']
                },
                minItems: 1
            }
        },
        required: ['file_path', 'edits']
    };

    async invoke(
        options: CliToolInvocationOptions<IMultiEditParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { file_path, edits } = options.input;

        try {
            return await this.executeMultiEdit(file_path, edits);
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error during multi-edit');
        }
    }

    private async executeMultiEdit(filePath: string, edits: IEditOperation[]): Promise<CliToolResult> {
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

        // Read original content
        const originalContent = await fs.promises.readFile(resolvedPath, 'utf-8');
        let currentContent = originalContent;

        // Validate all edits before applying any
        const validationErrors = this.validateEdits(edits, originalContent);
        if (validationErrors.length > 0) {
            return this.createErrorResult(`Validation failed:\n${validationErrors.join('\n')}`);
        }

        // Apply edits sequentially
        const appliedEdits: Array<{
            operation: IEditOperation;
            success: boolean;
            replacementCount: number;
            error?: string;
        }> = [];

        for (let i = 0; i < edits.length; i++) {
            const edit = edits[i];

            try {
                const result = this.applyEdit(currentContent, edit);
                currentContent = result.newContent;
                
                appliedEdits.push({
                    operation: edit,
                    success: true,
                    replacementCount: result.replacementCount
                });

            } catch (error) {
                appliedEdits.push({
                    operation: edit,
                    success: false,
                    replacementCount: 0,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                // If any edit fails, return error without saving
                return this.createErrorResult(
                    `Edit ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
                    `No changes were saved to the file.`
                );
            }
        }

        // Save the file only if all edits succeeded
        await fs.promises.writeFile(resolvedPath, currentContent, 'utf-8');

        // Generate summary
        const summary = this.generateEditSummary(filePath, originalContent, currentContent, appliedEdits);

        return this.createSuccessResult({
            file_path: filePath,
            totalEdits: edits.length,
            successfulEdits: appliedEdits.filter(e => e.success).length,
            totalReplacements: appliedEdits.reduce((sum, e) => sum + e.replacementCount, 0),
            originalSize: originalContent.length,
            newSize: currentContent.length
        }, summary);
    }

    private validateEdits(edits: IEditOperation[], content: string): string[] {
        const errors: string[] = [];

        for (let i = 0; i < edits.length; i++) {
            const edit = edits[i];

            // Check if old_string exists in content
            if (!content.includes(edit.old_string)) {
                errors.push(`Edit ${i + 1}: Text not found: "${edit.old_string.substring(0, 50)}${edit.old_string.length > 50 ? '...' : ''}"`);
            }

            // Check for identical old and new strings
            if (edit.old_string === edit.new_string) {
                errors.push(`Edit ${i + 1}: Old and new strings are identical`);
            }

            // Check for empty old_string
            if (!edit.old_string.trim()) {
                errors.push(`Edit ${i + 1}: old_string cannot be empty`);
            }
        }

        return errors;
    }

    private applyEdit(content: string, edit: IEditOperation): { newContent: string; replacementCount: number } {
        const { old_string, new_string, replace_all = false } = edit;

        if (replace_all) {
            // Replace all occurrences
            const parts = content.split(old_string);
            const replacementCount = parts.length - 1;
            
            if (replacementCount === 0) {
                throw new Error(`Text not found: "${old_string}"`);
            }

            return {
                newContent: parts.join(new_string),
                replacementCount
            };
        } else {
            // Replace only first occurrence
            const index = content.indexOf(old_string);
            if (index === -1) {
                throw new Error(`Text not found: "${old_string}"`);
            }

            const newContent = content.substring(0, index) + new_string + content.substring(index + old_string.length);
            return {
                newContent,
                replacementCount: 1
            };
        }
    }

    private generateEditSummary(
        filePath: string,
        originalContent: string,
        newContent: string,
        appliedEdits: Array<{
            operation: IEditOperation;
            success: boolean;
            replacementCount: number;
            error?: string;
        }>
    ): string {
        const lines = [`✅ Multi-edit completed: ${filePath}`];
        
        // File stats
        const originalLines = originalContent.split('\n').length;
        const newLines = newContent.split('\n').length;
        const sizeChange = newContent.length - originalContent.length;
        const sizeChangeStr = sizeChange === 0 ? 'no change' : 
                             sizeChange > 0 ? `+${sizeChange} chars` : 
                             `${sizeChange} chars`;

        lines.push(`Edits applied: ${appliedEdits.length}`);
        lines.push(`Lines: ${originalLines} → ${newLines}`);
        lines.push(`Size change: ${sizeChangeStr}`);
        lines.push('');

        // Edit details
        lines.push('Edit operations:');
        for (let i = 0; i < appliedEdits.length; i++) {
            const edit = appliedEdits[i];
            const oldPreview = edit.operation.old_string.length > 50 ? 
                              edit.operation.old_string.substring(0, 47) + '...' : 
                              edit.operation.old_string;
            const newPreview = edit.operation.new_string.length > 50 ? 
                              edit.operation.new_string.substring(0, 47) + '...' : 
                              edit.operation.new_string;

            lines.push(`  ${i + 1}. ${edit.replacementCount} replacement${edit.replacementCount !== 1 ? 's' : ''}`);
            lines.push(`     - ${oldPreview.replace(/\n/g, '\\n')}`);
            lines.push(`     + ${newPreview.replace(/\n/g, '\\n')}`);
        }

        return lines.join('\n');
    }
}

// Auto-register the tool
ToolRegistry.registerTool(MultiEditTool);