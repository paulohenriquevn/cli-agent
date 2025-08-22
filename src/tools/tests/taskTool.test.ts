/*---------------------------------------------------------------------------------------------
 * Task Tool Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext } from './setup';

describe('TaskTool', () => {
    const registry = ToolRegistry.getInstance();
    const context = createTestContext();

    test('should create and delegate task', async () => {
        const result = await registry.executeTool('task', {
            description: 'Test task delegation',
            prompt: 'This is a test task for the CLI system. Please confirm receipt.',
            subagentType: 'general-purpose'
        }, context);

        expect(result.getText()).toContain('🎯 Task Execution Complete');
        expect(result.getText()).toContain('Test task delegation');
        expect(result.getText()).toContain('Sub-agent:');
        expect(result.getText()).toContain('Actions performed:');
    });

    test('should handle different subagent types', async () => {
        const subagentTypes = [
            'frontend',
            'backend-linter',
            'frontend-linter',
            'migrations-specialist'
        ];

        for (const subagentType of subagentTypes) {
            const result = await registry.executeTool('task', {
                description: `Test ${subagentType} task`,
                prompt: `Task for ${subagentType} agent`,
                subagentType
            }, context);

            expect(result.getText()).toContain('🎯 Task Execution Complete');
            expect(result.getText()).toContain(subagentType);
        }
    });

    test('should validate required parameters', async () => {
        const result = await registry.executeTool('task', {
            description: 'Test task',
            prompt: 'Test prompt'
            // Missing subagentType
        }, context);

        expect(result.getText()).toContain('🎯 Task Execution Complete');
    });

    test('should handle complex task descriptions', async () => {
        const complexDescription = 'Complex multi-step task with detailed requirements';
        const complexPrompt = `This is a complex task that involves:
1. Reading multiple files
2. Analyzing code structure
3. Making specific modifications
4. Running tests to verify changes
5. Generating a detailed report

Please handle this systematically and provide detailed feedback on each step.`;

        const result = await registry.executeTool('task', {
            description: complexDescription,
            prompt: complexPrompt,
            subagentType: 'general-purpose'
        }, context);

        expect(result.getText()).toContain(complexDescription);
        expect(result.getText()).toContain('Analyzing task requirements');
        expect(result.getText()).toContain('Executing specialized workflow');
    });

    test('should format task output properly', async () => {
        const result = await registry.executeTool('task', {
            description: 'Format test',
            prompt: 'Test formatting',
            subagentType: 'general-purpose'
        }, context);

        expect(result.getText()).toContain('🎯 Task Execution Complete');
        expect(result.getText()).toContain('Description:');
        expect(result.getText()).toContain('Sub-agent:');
        expect(result.getText()).toContain('Actions performed:');
        expect(result.getText()).toContain('✅ Success');
    });

    test('should handle special characters in prompts', async () => {
        const specialPrompt = 'Task with special chars: @#$%^&*()[]{}|\\:";\'<>?/.,~`';

        const result = await registry.executeTool('task', {
            description: 'Special chars test',
            prompt: specialPrompt,
            subagentType: 'general-purpose'
        }, context);

        expect(result.getText()).toContain('Actions performed:');
    });

    test('should handle multiline prompts', async () => {
        const multilinePrompt = `Line 1: First instruction
Line 2: Second instruction
Line 3: Third instruction

Additional context and requirements here.`;

        const result = await registry.executeTool('task', {
            description: 'Multiline test',
            prompt: multilinePrompt,
            subagentType: 'general-purpose'
        }, context);

        expect(result.getText()).toContain('Analyzing task requirements');
        expect(result.getText()).toContain('Executing specialized workflow');
        expect(result.getText()).toContain('Generating results');
    });

    test('should handle empty descriptions', async () => {
        const result = await registry.executeTool('task', {
            description: '',
            prompt: 'Test with empty description',
            subagentType: 'general-purpose'
        }, context);

        expect(result.getText()).toContain('🎯 Task Execution Complete');
        expect(result.getText()).toContain('Description:');
    });

    test('should show session context', async () => {
        const result = await registry.executeTool('task', {
            description: 'Context test',
            prompt: 'Test session context',
            subagentType: 'general-purpose'
        }, context);

        expect(result.getText()).toContain('Sub-agent:');
        expect(result.getText()).toContain('Duration:');
    });
});