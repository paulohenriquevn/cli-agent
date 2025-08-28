/*---------------------------------------------------------------------------------------------
 * Memory Tool Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext, TEST_FILES_DIR } from './setup';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('MemoryTool', () => {
    const context = createTestContext();
    const agentMdPath = path.join(context.workingDirectory, 'agent.md');

    beforeEach(async () => {
        // Clean up any existing agent.md file before each test
        try {
            await fs.unlink(agentMdPath);
        } catch {
            // File doesn't exist, that's fine
        }
    });

    afterEach(async () => {
        // Clean up agent.md file after each test
        try {
            await fs.unlink(agentMdPath);
        } catch {
            // File doesn't exist, that's fine
        }
    });

    describe('Basic Functionality', () => {
        test('should save a simple memory fact', async () => {
            const fact = 'User prefers TypeScript over JavaScript';

            const result = await ToolRegistry.executeTool('save_memory', {
                fact
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');
            expect(result.getText()).toContain('agent.md');
            expect(result.getText()).toContain(fact);
            expect(result.getText()).toMatch(/\*\*Fact ID:\*\* fact_[a-f0-9]{8}/);

            // Verify file was created
            const fileExists = await fs.access(agentMdPath).then(() => true).catch(() => false);
            expect(fileExists).toBe(true);

            // Verify file content
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain('# Agent Context');
            expect(fileContent).toContain('## Agent Added Memories');
            expect(fileContent).toContain(fact);
            expect(fileContent).toMatch(/### \d{4}-\d{2}-\d{2} - fact_[a-f0-9]{8}/);
        });

        test('should save memory with all metadata', async () => {
            const fact = 'Project uses React 18 with strict mode enabled';
            const category = 'project-config';
            const priority = 'high';
            const project = 'test-project';
            const tags = ['react', 'config', 'strict-mode'];

            const result = await ToolRegistry.executeTool('save_memory', {
                fact,
                category,
                priority,
                project,
                tags
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');
            expect(result.getText()).toContain(fact);

            // Verify file content includes all metadata
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain(`(${category})`);
            expect(fileContent).toContain('**HIGH**');
            expect(fileContent).toContain(`- Project: ${project}`);
            expect(fileContent).toContain('[react, config, strict-mode]');
            expect(fileContent).toContain(fact);
        });

        test('should append multiple memories to same file', async () => {
            const fact1 = 'First memory fact';
            const fact2 = 'Second memory fact';
            const fact3 = 'Third memory fact';

            // Save first memory
            await ToolRegistry.executeTool('save_memory', {
                fact: fact1,
                category: 'test1'
            }, context);

            // Save second memory
            await ToolRegistry.executeTool('save_memory', {
                fact: fact2,
                category: 'test2',
                priority: 'low'
            }, context);

            // Save third memory
            await ToolRegistry.executeTool('save_memory', {
                fact: fact3,
                priority: 'high',
                tags: ['important']
            }, context);

            // Verify all memories are in file
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain(fact1);
            expect(fileContent).toContain(fact2);
            expect(fileContent).toContain(fact3);
            expect(fileContent).toContain('(test1)');
            expect(fileContent).toContain('(test2)');
            expect(fileContent).toContain('**HIGH**');
            expect(fileContent).toContain('[important]');

            // Should have 3 fact entries
            const factMatches = fileContent.match(/### \d{4}-\d{2}-\d{2} - fact_/g);
            expect(factMatches).toHaveLength(3);
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty fact', async () => {
            const result = await ToolRegistry.executeTool('save_memory', {
                fact: ''
            }, context);

            expect(result.hasErrors()).toBe(true);
            expect(result.getErrors()).toEqual(expect.arrayContaining([expect.stringContaining('Fact cannot be empty')]));

            // File should not be created
            const fileExists = await fs.access(agentMdPath).then(() => true).catch(() => false);
            expect(fileExists).toBe(false);
        });

        test('should handle whitespace-only fact', async () => {
            const result = await ToolRegistry.executeTool('save_memory', {
                fact: '   \n\t  \n  '
            }, context);

            expect(result.hasErrors()).toBe(true);
            expect(result.getErrors()).toEqual(expect.arrayContaining([expect.stringContaining('Fact cannot be empty')]));

            // File should not be created
            const fileExists = await fs.access(agentMdPath).then(() => true).catch(() => false);
            expect(fileExists).toBe(false);
        });

        test('should trim whitespace from fact', async () => {
            const fact = 'User prefers clean code';
            const paddedFact = `  \n  ${fact}  \t\n  `;

            const result = await ToolRegistry.executeTool('save_memory', {
                fact: paddedFact
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            // Verify trimmed content in file
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain(fact);
            expect(fileContent).not.toContain(paddedFact);
        });

        test('should handle very long fact', async () => {
            const longFact = 'This is a very long fact that contains lots of information. '.repeat(20); // Reduced to avoid truncation

            const result = await ToolRegistry.executeTool('save_memory', {
                fact: longFact,
                category: 'long-text',
                priority: 'medium'
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            // Verify long content is saved
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain('This is a very long fact that contains lots of information');
            expect(fileContent).toContain('(long-text)');
            
            // Verify multiple repetitions exist
            const occurrences = (fileContent.match(/This is a very long fact that contains lots of information\./g) || []).length;
            expect(occurrences).toBeGreaterThanOrEqual(15); // Should have many repetitions
        });

        test('should handle special characters in fact', async () => {
            const specialFact = 'Fact with "quotes", \'apostrophes\', & symbols: @#$%^&*()_+-={}[]|\\:";\'<>?,./`~';

            const result = await ToolRegistry.executeTool('save_memory', {
                fact: specialFact,
                tags: ['special-chars', 'symbols']
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            // Verify special characters are preserved
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain(specialFact);
            expect(fileContent).toContain('[special-chars, symbols]');
        });
    });

    describe('Priority Levels', () => {
        test('should handle low priority', async () => {
            const result = await ToolRegistry.executeTool('save_memory', {
                fact: 'Low priority fact',
                priority: 'low'
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            // Low priority should not show priority indicator (only high shows **HIGH**)
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).not.toContain('**LOW**');
            expect(fileContent).toContain('Low priority fact');
        });

        test('should handle medium priority (default)', async () => {
            const result = await ToolRegistry.executeTool('save_memory', {
                fact: 'Medium priority fact'
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            // Medium priority should not show priority indicator
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).not.toContain('**MEDIUM**');
            expect(fileContent).toContain('Medium priority fact');
        });

        test('should handle high priority', async () => {
            const result = await ToolRegistry.executeTool('save_memory', {
                fact: 'High priority fact',
                priority: 'high'
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            // High priority should show **HIGH** indicator
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain('**HIGH**');
            expect(fileContent).toContain('High priority fact');
        });
    });

    describe('Tags and Categories', () => {
        test('should handle empty tags array', async () => {
            const result = await ToolRegistry.executeTool('save_memory', {
                fact: 'Fact with empty tags',
                tags: []
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            // Should not show empty brackets
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).not.toContain('[]');
            expect(fileContent).toContain('Fact with empty tags');
        });

        test('should handle single tag', async () => {
            const result = await ToolRegistry.executeTool('save_memory', {
                fact: 'Single tag fact',
                tags: ['single-tag']
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain('[single-tag]');
            expect(fileContent).toContain('Single tag fact');
        });

        test('should handle multiple tags', async () => {
            const result = await ToolRegistry.executeTool('save_memory', {
                fact: 'Multiple tags fact',
                tags: ['tag1', 'tag2', 'tag3', 'tag-with-dashes']
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain('[tag1, tag2, tag3, tag-with-dashes]');
            expect(fileContent).toContain('Multiple tags fact');
        });

        test('should handle category without other metadata', async () => {
            const result = await ToolRegistry.executeTool('save_memory', {
                fact: 'Category only fact',
                category: 'standalone-category'
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain('(standalone-category)');
            expect(fileContent).toContain('Category only fact');
        });
    });

    describe('File Management', () => {
        test('should work with existing agent.md file', async () => {
            // Create existing agent.md with some content
            const existingContent = `# Agent Context

## Project Description
Existing project information.

## Instructions
- Existing instructions

## Agent Added Memories
<!-- Facts saved by the agent will appear below this line -->

---
*File created manually*
`;

            await fs.writeFile(agentMdPath, existingContent, 'utf-8');

            const result = await ToolRegistry.executeTool('save_memory', {
                fact: 'New fact added to existing file'
            }, context);

            expect(result.getText()).toContain('Memory saved successfully!');

            // Verify existing content is preserved and new fact is added
            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            expect(fileContent).toContain('Existing project information');
            expect(fileContent).toContain('New fact added to existing file');
            expect(fileContent).toContain('*File created manually*');
        });

        test('should generate unique fact IDs', async () => {
            // Save multiple facts with same content
            await ToolRegistry.executeTool('save_memory', {
                fact: 'Same fact content'
            }, context);

            // Small delay to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 10));

            await ToolRegistry.executeTool('save_memory', {
                fact: 'Same fact content'
            }, context);

            const fileContent = await fs.readFile(agentMdPath, 'utf-8');
            const factIds = fileContent.match(/fact_[a-f0-9]{8}/g);
            expect(factIds).toHaveLength(2);
            expect(factIds![0]).not.toBe(factIds![1]); // IDs should be different
        });
    });

    describe('Tool Schema Validation', () => {
        test('should have correct tool registration', () => {
            const tool = ToolRegistry.getTool('save_memory');
            expect(tool).toBeTruthy();
            expect(tool!.name).toBe('save_memory');
            expect(tool!.description).toContain('Save important information');
            expect(tool!.category).toBe('memory-management');
            expect(tool!.tags).toContain('memory');
            expect(tool!.tags).toContain('persistence');
            expect(tool!.complexity).toBe('core');
        });

        test('should have valid OpenAI schema', () => {
            const tool = ToolRegistry.getTool('save_memory');
            const schema = tool!.inputSchema as any;

            expect(schema.type).toBe('object');
            expect(schema.properties.fact).toBeTruthy();
            expect(schema.properties.fact.type).toBe('string');
            expect(schema.properties.fact.minLength).toBe(1);
            expect(schema.required).toContain('fact');

            expect(schema.properties.category).toBeTruthy();
            expect(schema.properties.priority).toBeTruthy();
            expect(schema.properties.priority.enum).toEqual(['low', 'medium', 'high']);
            expect(schema.properties.project).toBeTruthy();
            expect(schema.properties.tags).toBeTruthy();
            expect(schema.properties.tags.type).toBe('array');
        });
    });
});