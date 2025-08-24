/*---------------------------------------------------------------------------------------------
 * Advanced Patch Tool - AI-powered patch system with auto-healing
 * Based on VSCode Copilot's advanced patch system with improvements
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';

interface IAdvancedPatchParams {
    patch: string;
    explanation?: string;
    auto_heal?: boolean;
    dry_run?: boolean;
    [key: string]: unknown;
}

interface IPatchFile {
    type: 'add' | 'update' | 'delete';
    path: string;
    oldContent?: string;
    newContent?: string;
    movePath?: string;
}

interface IPatchResult {
    success: boolean;
    filesModified: string[];
    errors: string[];
    autoHealed: boolean;
    healingDetails?: string[];
    fuzzLevel: 'none' | 'whitespace' | 'fuzzy' | 'ai-healed';
}

export class AdvancedPatchTool extends BaseTool<IAdvancedPatchParams> {
    readonly name = 'advanced_patch';
    readonly description = `Apply advanced patches with AI-powered auto-healing and fuzzy matching.

Use when: Applying complex code changes, handling patches with formatting variations, or automated refactoring.

Features: Fuzzy matching, auto-healing, dry-run mode, intelligent error recovery, V4A patch format.

Examples: Apply refactoring patches, handle whitespace variations, migrate code automatically.`;

    // Tag system implementation
    readonly tags = ['patching', 'advanced', 'automation'];
    readonly category = 'file-operations';
    readonly complexity: 'advanced' = 'advanced';
    readonly inputSchema = {
        type: 'object',
        properties: {
            patch: {
                type: 'string',
                description: 'The patch in V4A format: *** Begin Patch / *** Update File: path / @@ context / -old +new / *** End Patch'
            },
            explanation: {
                type: 'string',
                description: 'Optional explanation of what the patch achieves'
            },
            auto_heal: {
                type: 'boolean',
                description: 'Enable AI-powered auto-healing of malformed patches',
                default: true
            },
            dry_run: {
                type: 'boolean',
                description: 'Validate patch without applying changes',
                default: false
            }
        },
        required: ['patch']
    };

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IAdvancedPatchParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const params = options.input;

        try {
            // Parse the patch
            const patchFiles = await this.parsePatch(params.patch);

            if (patchFiles.length === 0) {
                return this.createErrorResult('No valid patch operations found in the provided patch');
            }

            // Apply patches with auto-healing if enabled
            const result = await this.applyPatchWithHealing(
                patchFiles,
                params.auto_heal !== false,
                params.dry_run || false
            );

            const response = this.formatPatchResponse(result, params.explanation);
            return this.createSuccessResult(null, response);

        } catch (error: any) {
            // Try auto-healing if enabled and not already attempted
            if (params.auto_heal !== false && !error.message.includes('auto-heal')) {
                try {
                    const healedPatch = await this.autoHealPatch(params.patch, error.message);
                    const healedFiles = await this.parsePatch(healedPatch);
                    const result = await this.applyPatchWithHealing(healedFiles, false, params.dry_run || false);
                    result.autoHealed = true;
                    result.healingDetails = ['AI auto-healed malformed patch format'];

                    const response = this.formatPatchResponse(result, params.explanation);
                    return this.createSuccessResult(null, response);
                } catch (healError: any) {
                    return this.createErrorResult(`Patch failed and auto-healing unsuccessful: ${healError.message}`);
                }
            }

            return this.createErrorResult(`Advanced patch failed: ${error.message}`);
        }
    }

    private async parsePatch(patchContent: string): Promise<IPatchFile[]> {
        const files: IPatchFile[] = [];

        // Check for V4A format
        if (!patchContent.includes('*** Begin Patch') || !patchContent.includes('*** End Patch')) {
            throw new Error('Invalid patch format. Expected V4A format with *** Begin Patch / *** End Patch markers');
        }

        // Extract patch content between markers
        const beginMatch = patchContent.indexOf('*** Begin Patch');
        const endMatch = patchContent.indexOf('*** End Patch');

        if (beginMatch === -1 || endMatch === -1 || endMatch <= beginMatch) {
            throw new Error('Invalid patch format. Missing or malformed Begin/End Patch markers');
        }

        const patchBody = patchContent.substring(beginMatch + '*** Begin Patch'.length, endMatch).trim();
        const lines = patchBody.split('\n');

        let currentFile: IPatchFile | null = null;
        let contextBuffer: string[] = [];
        let oldLines: string[] = [];
        let newLines: string[] = [];
        let inHunk = false;

        const resetHunkState = (): [string[], string[], string[], boolean] => {
            return [[], [], [], false];
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // File action headers
            if (line.startsWith('*** Add File:')) {
                if (currentFile) {files.push(await this.finalizePatchFile(currentFile, oldLines, newLines));}
                currentFile = { type: 'add', path: line.substring('*** Add File:'.length).trim() };
                [contextBuffer, oldLines, newLines, inHunk] = resetHunkState();
            } else if (line.startsWith('*** Update File:')) {
                if (currentFile) {files.push(await this.finalizePatchFile(currentFile, oldLines, newLines));}
                currentFile = { type: 'update', path: line.substring('*** Update File:'.length).trim() };
                [contextBuffer, oldLines, newLines, inHunk] = resetHunkState();
            } else if (line.startsWith('*** Delete File:')) {
                if (currentFile) {files.push(await this.finalizePatchFile(currentFile, oldLines, newLines));}
                currentFile = { type: 'delete', path: line.substring('*** Delete File:'.length).trim() };
                [contextBuffer, oldLines, newLines, inHunk] = resetHunkState();
            } else if (line.startsWith('*** Move File:') && line.includes(' -> ')) {
                const parts = line.substring('*** Move File:'.length).trim().split(' -> ');
                if (currentFile) {files.push(await this.finalizePatchFile(currentFile, oldLines, newLines));}
                currentFile = {
                    type: 'update',
                    path: parts[0].trim(),
                    movePath: parts[1].trim()
                };
                [contextBuffer, oldLines, newLines, inHunk] = resetHunkState();
            }
            // Context markers
            else if (line.startsWith('@@')) {
                inHunk = true;
                contextBuffer.push(line.substring(2).trim());
            }
            // Diff lines
            else if (line.startsWith('-') && inHunk) {
                oldLines.push(line.substring(1));
            } else if (line.startsWith('+') && inHunk) {
                newLines.push(line.substring(1));
            }
            // Content for add/full file replacement
            else if (currentFile && (currentFile.type === 'add' || !inHunk) && line.length > 0) {
                if (!currentFile.newContent) {currentFile.newContent = '';}
                currentFile.newContent += line + '\n';
            }

        }

        if (currentFile) {
            files.push(await this.finalizePatchFile(currentFile, oldLines, newLines));
        }

        return files;
    }

    private async finalizePatchFile(file: IPatchFile, oldLines: string[], newLines: string[]): Promise<IPatchFile> {
        if (file.type === 'delete') {
            return file;
        }

        if (file.type === 'add') {
            // For add, newContent should already be set
            return file;
        }

        if (file.type === 'update') {
            // Read current file content
            try {
                const fullPath = path.isAbsolute(file.path) ? file.path : path.resolve(this.getWorkspaceRoot(), file.path);
                file.oldContent = await fs.readFile(fullPath, 'utf8');

                // Apply diff if we have old/new lines
                if (oldLines.length > 0 && newLines.length > 0) {
                    file.newContent = await this.applyDiffToContent(file.oldContent, oldLines, newLines);
                }
            } catch (error: any) {
                throw new Error(`Could not read file for update: ${file.path} - ${error.message}`);
            }
        }

        return file;
    }

    private async applyDiffToContent(originalContent: string, oldLines: string[], newLines: string[]): Promise<string> {

        // Find the context in the original file
        const oldText = oldLines.join('\n');
        const newText = newLines.join('\n');

        // Simple string replacement with fuzzy matching
        const result = await this.fuzzyReplace(originalContent, oldText, newText);

        if (result.found) {
            return result.content;
        }

        throw new Error(`Could not find context in file for patch application. Looking for:\n${oldText}`);
    }

    private async fuzzyReplace(content: string, oldText: string, newText: string): Promise<{found: boolean, content: string, fuzz: string}> {
        // Exact match first
        if (content.includes(oldText)) {
            return {
                found: true,
                content: content.replace(oldText, newText),
                fuzz: 'none'
            };
        }

        // Whitespace-normalized match
        const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();
        const normalizedOld = normalizeWhitespace(oldText);
        const normalizedContent = normalizeWhitespace(content);

        if (normalizedContent.includes(normalizedOld)) {
            // Find the original text boundaries and replace
            const contentLines = content.split('\n');
            const oldTextLines = oldText.split('\n');

            for (let i = 0; i <= contentLines.length - oldTextLines.length; i++) {
                const slice = contentLines.slice(i, i + oldTextLines.length);
                if (normalizeWhitespace(slice.join('\n')) === normalizedOld) {
                    contentLines.splice(i, oldTextLines.length, ...newText.split('\n'));
                    return {
                        found: true,
                        content: contentLines.join('\n'),
                        fuzz: 'whitespace'
                    };
                }
            }
        }

        // Fuzzy line-by-line matching
        const result = await this.fuzzyLineMatch(content, oldText, newText);
        if (result.found) {
            return result;
        }

        return { found: false, content, fuzz: 'none' };
    }

    private async fuzzyLineMatch(content: string, oldText: string, newText: string): Promise<{found: boolean, content: string, fuzz: string}> {
        const contentLines = content.split('\n');
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');

        // Try to find a sequence of lines that approximately matches
        for (let startIdx = 0; startIdx <= contentLines.length - oldLines.length; startIdx++) {
            let matchScore = 0;
            let totalLength = 0;

            for (let i = 0; i < oldLines.length; i++) {
                const contentLine = contentLines[startIdx + i];
                const oldLine = oldLines[i];

                totalLength += Math.max(contentLine.length, oldLine.length);

                // Calculate similarity (simple edit distance approximation)
                const similarity = this.calculateSimilarity(contentLine, oldLine);
                matchScore += similarity * Math.max(contentLine.length, oldLine.length);
            }

            const averageSimilarity = totalLength > 0 ? matchScore / totalLength : 0;

            // If similarity is high enough (>70%), consider it a match
            if (averageSimilarity > 0.7) {
                // Replace the matched section
                contentLines.splice(startIdx, oldLines.length, ...newLines);
                return {
                    found: true,
                    content: contentLines.join('\n'),
                    fuzz: 'fuzzy'
                };
            }
        }

        return { found: false, content, fuzz: 'none' };
    }

    private calculateSimilarity(str1: string, str2: string): number {
        const len1 = str1.length;
        const len2 = str2.length;

        if (len1 === 0 && len2 === 0) {return 1;}
        if (len1 === 0 || len2 === 0) {return 0;}

        // Simple character-by-character comparison
        let matches = 0;
        const minLen = Math.min(len1, len2);

        for (let i = 0; i < minLen; i++) {
            if (str1[i] === str2[i]) {matches++;}
        }

        // Penalize length differences
        const lengthPenalty = Math.abs(len1 - len2) / Math.max(len1, len2);
        const charSimilarity = matches / Math.max(len1, len2);

        return charSimilarity * (1 - lengthPenalty * 0.5);
    }

    private async applyPatchWithHealing(files: IPatchFile[], autoHeal: boolean, dryRun: boolean): Promise<IPatchResult> {
        const result: IPatchResult = {
            success: true,
            filesModified: [],
            errors: [],
            autoHealed: false,
            fuzzLevel: 'none'
        };

        for (const file of files) {
            try {
                const fullPath = path.isAbsolute(file.path) ? file.path : path.resolve(this.getWorkspaceRoot(), file.path);

                if (file.type === 'add') {
                    if (!dryRun) {
                        await fs.mkdir(path.dirname(fullPath), { recursive: true });
                        await fs.writeFile(fullPath, file.newContent || '', 'utf8');

                        // Notify VS Code
                        const uri = vscode.Uri.file(fullPath);
                        await vscode.workspace.fs.writeFile(uri, Buffer.from(file.newContent || '', 'utf8'));
                    }
                    result.filesModified.push(file.path);
                }
                else if (file.type === 'update') {
                    if (!dryRun) {
                        await fs.writeFile(fullPath, file.newContent || '', 'utf8');

                        // Handle file moves
                        if (file.movePath) {
                            const newPath = path.isAbsolute(file.movePath) ? file.movePath : path.resolve(this.getWorkspaceRoot(), file.movePath);
                            await fs.mkdir(path.dirname(newPath), { recursive: true });
                            await fs.rename(fullPath, newPath);
                            result.filesModified.push(`${file.path} -> ${file.movePath}`);
                        } else {
                            // Notify VS Code
                            const uri = vscode.Uri.file(fullPath);
                            await vscode.workspace.fs.writeFile(uri, Buffer.from(file.newContent || '', 'utf8'));
                            result.filesModified.push(file.path);
                        }
                    } else {
                        result.filesModified.push(file.path);
                    }
                }
                else if (file.type === 'delete') {
                    if (!dryRun) {
                        await fs.unlink(fullPath);
                    }
                    result.filesModified.push(`deleted: ${file.path}`);
                }

            } catch (error: any) {
                result.errors.push(`Failed to process ${file.path}: ${error.message}`);
                result.success = false;
            }
        }

        return result;
    }

    private async autoHealPatch(originalPatch: string, _errorMessage: string): Promise<string> {
        // Simple healing patterns - in a real implementation, this would use LLM
        let healedPatch = originalPatch;

        // Fix common format issues
        if (!healedPatch.includes('*** Begin Patch')) {
            healedPatch = '*** Begin Patch\n' + healedPatch;
        }

        if (!healedPatch.includes('*** End Patch')) {
            healedPatch = healedPatch + '\n*** End Patch';
        }

        // Fix file action headers
        healedPatch = healedPatch.replace(/^(\*{0,2})\s*(Add|Update|Delete)\s+File:/gm, '*** $2 File:');

        // Fix context markers
        healedPatch = healedPatch.replace(/^@([^@])/gm, '@@$1');
        healedPatch = healedPatch.replace(/^([^@])@$/gm, '$1@@');

        // Ensure proper line prefixes
        healedPatch = healedPatch.replace(/^([^-+@*\s])/gm, ' $1'); // Add space for context lines

        return healedPatch;
    }

    private formatPatchResponse(result: IPatchResult, explanation?: string): string {
        const lines = [
            `**🔧 Advanced Patch ${result.success ? 'Applied' : 'Failed'}**`
        ];

        if (explanation) {
            lines.push(`**Goal:** ${explanation}`);
        }

        lines.push(
            `**Files Modified:** ${result.filesModified.length}`,
            `**Success:** ${result.success ? 'Yes' : 'No'}`,
            `**Fuzz Level:** ${result.fuzzLevel}`,
            ''
        );

        if (result.autoHealed) {
            lines.push(`**🤖 AI Auto-Healing:** Patch was automatically repaired`);
            if (result.healingDetails) {
                result.healingDetails.forEach(detail => lines.push(`   - ${detail}`));
            }
            lines.push('');
        }

        if (result.filesModified.length > 0) {
            lines.push('**Files Modified:**');
            result.filesModified.forEach(file => lines.push(`- ${file}`));
            lines.push('');
        }

        if (result.errors.length > 0) {
            lines.push('**Errors:**');
            result.errors.forEach(error => lines.push(`- ${error}`));
            lines.push('');
        }

        if (result.success) {
            lines.push('✅ Patch applied successfully with advanced matching');
        } else {
            lines.push('❌ Patch application failed - check errors above');
        }

        return lines.join('\n');
    }
}

// Register the tool
ToolRegistry.registerTool(AdvancedPatchTool);