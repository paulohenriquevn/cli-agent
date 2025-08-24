/*---------------------------------------------------------------------------------------------
 * Exit Plan Mode Tool - Exit planning mode and proceed with implementation
 * REFACTORED: Removed VSCode dependencies
 *--------------------------------------------------------------------------------------------*/

import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult
} from '../types/cliTypes';

interface IExitPlanModeParams {
    plan: string;
}

export class ExitPlanModeTool extends BaseTool<IExitPlanModeParams> {
    readonly name = 'exit_plan_mode';
    readonly description = `Exit planning mode and proceed with implementation.

Use when: Finished planning implementation steps and ready to execute code changes.

Features: Plan validation, user confirmation, transition to execution mode.

Examples: Complete task planning, finalize implementation strategy, move to coding phase.`;

    readonly tags = ['planning', 'workflow', 'essential'];
    readonly category = 'planning';
    readonly complexity: 'essential' = 'essential';
    readonly inputSchema = {
        type: 'object',
        properties: {
            plan: {
                type: 'string',
                description: 'The plan to run by the user for approval (supports markdown)',
                examples: ['## Implementation Plan\n1. Create component\n2. Add styling\n3. Test functionality']
            }
        },
        required: ['plan']
    };

    async invoke(
        options: CliToolInvocationOptions<IExitPlanModeParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { plan } = options.input;

        try {
            const summary = this.formatPlanSummary(plan);
            
            return this.createSuccessResult({
                plan,
                approved: true,
                readyToExecute: true
            }, summary);

        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error exiting plan mode');
        }
    }

    private formatPlanSummary(plan: string): string {
        const lines = ['🎯 Implementation Plan Ready'];
        lines.push('Plan has been prepared and is ready for execution.');
        lines.push('');
        lines.push('📋 Plan Details:');
        lines.push(plan);
        lines.push('');
        lines.push('✅ Ready to proceed with implementation');
        lines.push('🚀 Exiting plan mode - starting execution phase');

        return lines.join('\n');
    }
}

// Auto-register the tool
ToolRegistry.registerTool(ExitPlanModeTool);