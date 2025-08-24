/*---------------------------------------------------------------------------------------------
 * Exit Plan Mode Tool Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext } from './setup';

describe('ExitPlanModeTool', () => {
    // const registry = ToolRegistry;
    const context = createTestContext();

    test('should create exit plan mode request', async () => {
        const plan = `Implementation Plan:
1. Set up project structure
2. Create CLI interface
3. Implement core tools
4. Add testing framework
5. Deploy and test`;

        const result = await ToolRegistry.executeTool('exit_plan_mode', {
            plan
        }, context);

        expect(result.getText()).toContain('🎯 Implementation Plan Ready');
        expect(result.getText()).toContain('Set up project structure');
        expect(result.getText()).toContain('Create CLI interface');
        expect(result.getText()).toContain('Implement core tools');
    });

    test('should handle simple plans', async () => {
        const simplePlan = 'Simple task: Update the configuration file';

        const result = await ToolRegistry.executeTool('exit_plan_mode', {
            plan: simplePlan
        }, context);

        expect(result.getText()).toContain(simplePlan);
        expect(result.getText()).toContain('Ready to proceed');
    });

    test('should handle complex multi-step plans', async () => {
        const complexPlan = `Comprehensive Refactoring Plan:

Phase 1: Analysis
- Analyze current codebase structure
- Identify VSCode dependencies
- Map tool relationships
- Document current functionality

Phase 2: Design
- Design CLI architecture
- Define new interfaces
- Plan migration strategy
- Create testing approach

Phase 3: Implementation
- Refactor base classes
- Update tool implementations
- Migrate registry system
- Implement CLI entry point

Phase 4: Testing & Validation
- Create comprehensive test suite
- Validate all tool functionality
- Performance testing
- Documentation updates`;

        const result = await ToolRegistry.executeTool('exit_plan_mode', {
            plan: complexPlan
        }, context);

        expect(result.getText()).toContain('Phase 1: Analysis');
        expect(result.getText()).toContain('Phase 2: Design');
        expect(result.getText()).toContain('Phase 3: Implementation');
        expect(result.getText()).toContain('Phase 4: Testing');
    });

    test('should handle markdown formatting in plans', async () => {
        const markdownPlan = `# Project Setup Plan

## Prerequisites
- Node.js 18+
- TypeScript
- Jest testing framework

## Steps
1. **Initialize project**
   - Create package.json
   - Install dependencies
   
2. **Configure TypeScript**
   - Set up tsconfig.json
   - Configure build scripts
   
3. **Set up testing**
   - Configure Jest
   - Create test structure

## Expected Outcome
Fully functional CLI tool system`;

        const result = await ToolRegistry.executeTool('exit_plan_mode', {
            plan: markdownPlan
        }, context);

        expect(result.getText()).toContain('# Project Setup Plan');
        expect(result.getText()).toContain('## Prerequisites');
        expect(result.getText()).toContain('**Initialize project**');
    });

    test('should handle plans with code examples', async () => {
        const planWithCode = `Implementation plan with code:

1. Create interface:
\`\`\`typescript
interface CliTool {
    name: string;
    execute(params: any): Promise<Result>;
}
\`\`\`

2. Implement base class:
\`\`\`typescript
export abstract class BaseTool implements CliTool {
    abstract execute(params: any): Promise<Result>;
}
\`\`\``;

        const result = await ToolRegistry.executeTool('exit_plan_mode', {
            plan: planWithCode
        }, context);

        expect(result.getText()).toContain('interface CliTool');
        expect(result.getText()).toContain('export abstract class BaseTool');
    });

    test('should handle empty plans', async () => {
        const result = await ToolRegistry.executeTool('exit_plan_mode', {
            plan: ''
        }, context);

        expect(result.getText()).toContain('Plan Details');
    });

    test('should show plan approval request', async () => {
        const plan = 'Test plan for approval';

        const result = await ToolRegistry.executeTool('exit_plan_mode', {
            plan
        }, context);

        expect(result.getText()).toContain('Ready to proceed');
        expect(result.getText()).toContain('Ready to proceed with implementation');
    });

    test('should handle special characters in plans', async () => {
        const specialPlan = 'Plan with special chars: @#$%^&*()[]{}|\\:";\'<>?/.,~` and émojis 🚀';

        const result = await ToolRegistry.executeTool('exit_plan_mode', {
            plan: specialPlan
        }, context);

        expect(result.getText()).toContain('@#$%^&*()[]{}');
        expect(result.getText()).toContain('émojis 🚀');
    });

    test('should format plan output properly', async () => {
        const plan = 'Simple test plan';

        const result = await ToolRegistry.executeTool('exit_plan_mode', {
            plan
        }, context);

        expect(result.getText()).toContain('🎯 Implementation Plan Ready');
        expect(result.getText()).toContain('📋 Plan Details');
        expect(result.getText()).toContain('✅ Ready to proceed');
    });

    test('should handle long plans', async () => {
        const longPlan = 'Step '.repeat(100) + 'Final step';

        const result = await ToolRegistry.executeTool('exit_plan_mode', {
            plan: longPlan
        }, context);

        expect(result.getText()).toContain('Step Step Step');
        expect(result.getText()).toContain('Final step');
        expect(result.getText()).toContain('🎯 Implementation Plan Ready');
    });
});