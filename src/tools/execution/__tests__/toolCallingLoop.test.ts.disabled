/*---------------------------------------------------------------------------------------------
 * Tool Calling Loop Unit Tests
 *--------------------------------------------------------------------------------------------*/

import { 
    ToolCallingLoop, 
    BasicToolCallingLoop, 
    ToolCallingLoopFactory,
    IToolCallingLoopOptions,
    ToolCallingLoopProgress 
} from '../toolCallingLoop';
import { PauseController } from '../pauseController';
import { LanguageModelToolInformation, ChatFetchResponseType, Raw, IToolCall } from '../types';

// Mock implementation for testing
class MockToolCallingLoop extends ToolCallingLoop<IToolCallingLoopOptions> {
    private mockTools: LanguageModelToolInformation[] = [
        {
            name: 'mockTool',
            description: 'A mock tool for testing',
            inputSchema: {
                type: 'object',
                properties: {
                    input: { type: 'string' }
                }
            }
        }
    ];

    protected async getAvailableTools(): Promise<LanguageModelToolInformation[]> {
        return this.mockTools;
    }

    protected async buildPrompt(): Promise<any> {
        return {
            prompt: 'Test prompt',
            messages: [{ role: Raw.ChatRole.User, content: 'Test user message' }],
            contextTokens: 100
        };
    }

    protected async fetch(): Promise<any> {
        return {
            type: ChatFetchResponseType.Success,
            value: {
                role: Raw.ChatRole.Assistant,
                content: 'Test response',
                toolCalls: this.shouldMockToolCall ? [{
                    id: 'test-call-1',
                    name: 'mockTool',
                    arguments: JSON.stringify({ input: 'test input' })
                }] : []
            }
        };
    }

    protected async executeTool(toolCall: IToolCall, _token: PauseController): Promise<any> {
        if (this.shouldMockToolFailure) {
            throw new Error('Mock tool execution failed');
        }
        
        return {
            content: `Mock result for ${toolCall.name}`,
            success: true,
            executionTime: 100
        };
    }

    // Test helpers
    public shouldMockToolCall = false;
    public shouldMockToolFailure = false;
    
    public setMockTools(tools: LanguageModelToolInformation[]): void {
        this.mockTools = tools;
    }
}

describe('ToolCallingLoop', () => {
    let loop: MockToolCallingLoop;
    let options: IToolCallingLoopOptions;

    beforeEach(() => {
        options = {
            toolCallLimit: 5,
            enableStreaming: false,
            enableNestedCalls: false,
            enableTelemetry: true,
            model: {
                family: 'openai',
                name: 'gpt-4'
            }
        };
        
        loop = new MockToolCallingLoop(options);
    });

    afterEach(() => {
        loop.dispose();
    });

    describe('Basic Execution', () => {
        test('should execute simple loop without tool calls', async () => {
            const result = await loop.executeLoop();
            
            expect(result.success).toBe(true);
            expect(result.totalToolCalls).toBe(0);
            expect(result.rounds).toHaveLength(1);
        });

        test('should execute loop with single tool call', async () => {
            loop.shouldMockToolCall = true;
            
            const result = await loop.executeLoop();
            
            expect(result.success).toBe(true);
            expect(result.totalToolCalls).toBe(1);
            expect(result.rounds).toHaveLength(2); // Initial + tool call round
        });

        test('should respect tool call limit', async () => {
            loop.shouldMockToolCall = true;
            const limitedOptions = { ...options, toolCallLimit: 2 };
            loop = new MockToolCallingLoop(limitedOptions);
            loop.shouldMockToolCall = true;
            
            const result = await loop.executeLoop();
            
            expect(result.totalToolCalls).toBeLessThanOrEqual(2);
        });
    });

    describe('Error Handling', () => {
        test('should handle tool execution errors gracefully', async () => {
            loop.shouldMockToolCall = true;
            loop.shouldMockToolFailure = true;
            
            const result = await loop.executeLoop();
            
            expect(result.success).toBe(false);
            expect(result.rounds.some(round => 
                round.toolCalls?.some(call => !call.result?.success)
            )).toBe(true);
        });

        test('should continue after tool failures when configured', async () => {
            const resilientOptions = { ...options, continueOnToolFailure: true };
            loop = new MockToolCallingLoop(resilientOptions);
            loop.shouldMockToolCall = true;
            loop.shouldMockToolFailure = true;
            
            const result = await loop.executeLoop();
            
            // Should complete execution despite tool failure
            expect(result.totalRounds).toBeGreaterThan(0);
        });
    });

    describe('Progress Tracking', () => {
        test('should emit progress events', async () => {
            const progressEvents: ToolCallingLoopProgress[] = [];
            loop.onProgress(progress => progressEvents.push(progress));
            
            loop.shouldMockToolCall = true;
            await loop.executeLoop();
            
            expect(progressEvents.length).toBeGreaterThan(0);
            expect(progressEvents[0].currentRound).toBe(1);
        });

        test('should provide accurate progress metrics', async () => {
            loop.shouldMockToolCall = true;
            
            const result = await loop.executeLoop();
            
            expect(result.executionTime).toBeGreaterThan(0);
            expect(result.averageRoundTime).toBeGreaterThan(0);
        });
    });

    describe('Cancellation', () => {
        test('should handle cancellation during execution', async () => {
            // Create slow executing loop
            loop.shouldMockToolCall = true;
            
            const executionPromise = loop.executeLoop();
            
            // Cancel after short delay
            setTimeout(() => loop.cancel(), 50);
            
            const result = await executionPromise;
            expect(result.cancelled).toBe(true);
        });

        test('should handle pause and resume', async () => {
            loop.shouldMockToolCall = true;
            
            const executionPromise = loop.executeLoop();
            
            // Pause and then resume
            setTimeout(() => {
                loop.pause();
                setTimeout(() => loop.resume(), 100);
            }, 25);
            
            const result = await executionPromise;
            expect(result.success).toBe(true);
        });
    });
});

describe('BasicToolCallingLoop', () => {
    test('should create with minimal configuration', () => {
        const loop = new BasicToolCallingLoop({
            model: { family: 'openai', name: 'gpt-4' }
        });
        
        expect(loop).toBeInstanceOf(BasicToolCallingLoop);
        loop.dispose();
    });
});

describe('ToolCallingLoopFactory', () => {
    describe('createBasic', () => {
        test('should create basic loop with default options', () => {
            const loop = ToolCallingLoopFactory.createBasic();
            
            expect(loop).toBeInstanceOf(BasicToolCallingLoop);
            loop.dispose();
        });

        test('should create basic loop with custom options', () => {
            const loop = ToolCallingLoopFactory.createBasic({
                toolCallLimit: 10,
                enableStreaming: true
            });
            
            expect(loop).toBeInstanceOf(BasicToolCallingLoop);
            loop.dispose();
        });
    });

    describe('createAdvanced', () => {
        test('should create advanced loop with full features', () => {
            const loop = ToolCallingLoopFactory.createAdvanced({
                model: { family: 'anthropic', name: 'claude-3' },
                enableNestedCalls: true,
                enableTelemetry: true
            });
            
            expect(loop).toBeInstanceOf(BasicToolCallingLoop);
            loop.dispose();
        });
    });

    describe('createDebug', () => {
        test('should create debug-enabled loop', () => {
            const loop = ToolCallingLoopFactory.createDebug();
            
            expect(loop).toBeInstanceOf(BasicToolCallingLoop);
            loop.dispose();
        });
    });

    describe('createProduction', () => {
        test('should create production-optimized loop', () => {
            const loop = ToolCallingLoopFactory.createProduction({
                model: { family: 'openai', name: 'gpt-4' }
            });
            
            expect(loop).toBeInstanceOf(BasicToolCallingLoop);
            loop.dispose();
        });
    });
});

describe('Integration Tests', () => {
    test('should handle complex execution flow', async () => {
        const loop = new MockToolCallingLoop({
            toolCallLimit: 3,
            enableStreaming: false,
            enableTelemetry: true,
            model: { family: 'openai', name: 'gpt-4' }
        });

        // Set up multiple tool calls scenario
        loop.shouldMockToolCall = true;

        const progressEvents: ToolCallingLoopProgress[] = [];
        loop.onProgress(progress => progressEvents.push(progress));

        const result = await loop.executeLoop();

        expect(result.success).toBe(true);
        expect(result.totalToolCalls).toBeGreaterThan(0);
        expect(progressEvents.length).toBeGreaterThan(0);
        expect(result.telemetry).toBeDefined();

        loop.dispose();
    });

    test('should handle nested tool calls when enabled', async () => {
        const loop = new MockToolCallingLoop({
            toolCallLimit: 5,
            enableNestedCalls: true,
            model: { family: 'openai', name: 'gpt-4' }
        });

        loop.shouldMockToolCall = true;

        const result = await loop.executeLoop();

        expect(result.success).toBe(true);
        // Verify nested calls handling
        expect(result.rounds).toBeDefined();

        loop.dispose();
    });
});