/*---------------------------------------------------------------------------------------------
 * Tools Service Unit Tests
 *--------------------------------------------------------------------------------------------*/

import { 
    ToolsServiceImpl, 
    ToolsServiceFactory, 
    ToolsServiceSingleton,
    IToolsService,
    CliRequest,
    ToolFilter
} from '../toolsService';
import { ToolRegistry } from '../toolRegistry';
import { BaseTool, IToolParams } from '../../base/baseTool';
import { CliToolInvocationOptions, CliCancellationToken, CliToolResult } from '../../types/cliTypes';
import { PauseController } from '../../execution/pauseController';
import { LanguageModelToolInformation } from '../../execution/types';

// Mock healing system
const mockHealingSystem = {
    isHealingEnabled: jest.fn().mockReturnValue(true),
    healString: jest.fn().mockResolvedValue({
        content: 'Healed string result',
        success: true,
        executionTime: 150
    }),
    healPatch: jest.fn().mockResolvedValue({
        content: 'Healed patch result',
        success: true,
        executionTime: 200
    }),
    getFlagsSummary: jest.fn().mockReturnValue({
        string: true,
        patch: true,
        gemini: false
    })
};

// Mock tools for testing
class MockSuccessTool extends BaseTool<{ message: string }> {
    readonly name = 'mockSuccess';
    readonly description = 'A tool that always succeeds';
    readonly category = 'test' as const;
    readonly tags = ['test', 'success'];
    readonly complexity = 'core' as const;

    readonly inputSchema = {
        type: 'object',
        properties: {
            message: { type: 'string' }
        },
        required: ['message']
    };

    async invoke(options: CliToolInvocationOptions<{ message: string }>, _token: CliCancellationToken): Promise<CliToolResult> {
        return this.createSuccessResult(`Success: ${options.input.message}`);
    }
}

class MockFailureTool extends BaseTool<{ input: string }> {
    readonly name = 'mockFailure';
    readonly description = 'A tool that always fails';
    readonly category = 'test' as const;
    readonly tags = ['test', 'failure'];
    readonly complexity = 'core' as const;

    readonly inputSchema = {
        type: 'object',
        properties: {
            input: { type: 'string' }
        },
        required: ['input']
    };

    async invoke(_options: CliToolInvocationOptions<{ input: string }>, _token: CliCancellationToken): Promise<CliToolResult> {
        return this.createErrorResult('Mock failure');
    }
}

interface MockEditToolParams extends IToolParams {
    content?: string;
    [key: string]: unknown;
}

class MockEditTool extends BaseTool<MockEditToolParams> {
    readonly name = 'mockEdit';
    readonly description = 'Mock edit tool for healing tests';
    readonly category = 'test' as const;
    readonly tags = ['test', 'edit'];
    readonly complexity = 'core' as const;

    readonly inputSchema = {
        type: 'object'
    };

    async invoke(_options: CliToolInvocationOptions<MockEditToolParams>, _token: CliCancellationToken): Promise<CliToolResult> {
        return this.createErrorResult('Edit failed');
    }
}

describe('ToolsServiceImpl', () => {
    let service: ToolsServiceImpl;

    beforeEach(() => {
        ToolRegistry.clear();
        service = new ToolsServiceImpl();
    });

    afterEach(() => {
        ToolRegistry.clear();
    });

    describe('Initialization', () => {
        test('should initialize with empty registry', () => {
            expect(service.tools).toHaveLength(0);
            expect(service.baseTools.size).toBe(0);
        });

        test('should initialize with registered tools', () => {
            ToolRegistry.registerTool(MockSuccessTool);
            service = new ToolsServiceImpl();

            expect(service.tools).toHaveLength(1);
            expect(service.baseTools.size).toBe(1);
        });

        test('should handle tool initialization errors', () => {
            interface BrokenToolParams extends IToolParams {
                [key: string]: unknown;
            }
            
            class BrokenTool extends BaseTool<BrokenToolParams> {
                readonly category = 'test' as const;
                readonly tags = ['test', 'broken'];
                readonly complexity = 'core' as const;
                readonly inputSchema = { type: 'object' };
                static readonly toolName = 'broken';
                
                readonly name = 'broken';
                readonly description = 'Broken tool';
                
                constructor() {
                    super();
                    throw new Error('Constructor fails');
                }
                
                async invoke(_options: CliToolInvocationOptions<BrokenToolParams>, _token: CliCancellationToken): Promise<CliToolResult> {
                    return this.createErrorResult('Broken tool error');
                }
            }

            ToolRegistry.registerTool(BrokenTool);
            
            expect(() => new ToolsServiceImpl()).not.toThrow();
            // Broken tool should not be initialized
        });
    });

    describe('Tool Access', () => {
        beforeEach(() => {
            ToolRegistry.registerTool(MockSuccessTool);
            ToolRegistry.registerTool(MockFailureTool);
            service = new ToolsServiceImpl();
        });

        test('should get tool by name', () => {
            const tool = service.getTool('mockSuccess');
            
            expect(tool).toBeDefined();
            expect(tool?.name).toBe('mockSuccess');
        });

        test('should return undefined for non-existent tool', () => {
            const tool = service.getTool('nonExistent');
            expect(tool).toBeUndefined();
        });

        test('should get copilot tool by name', () => {
            const tool = service.getBaseTool('mockSuccess');
            
            expect(tool).toBeDefined();
            expect(tool?.name).toBe('mockSuccess');
        });

        test('should list all tools', () => {
            const tools = service.tools;
            
            expect(tools).toHaveLength(2);
            expect(tools.map(t => t.name)).toContain('mockSuccess');
            expect(tools.map(t => t.name)).toContain('mockFailure');
        });
    });

    describe('Tool Execution', () => {
        beforeEach(() => {
            ToolRegistry.registerTool(MockSuccessTool);
            ToolRegistry.registerTool(MockFailureTool);
            service = new ToolsServiceImpl();
        });

        test('should execute successful tool', async () => {
            const result = await service.invokeTool('mockSuccess', {
                input: { message: 'test message' },
                toolName: 'mockSuccess'
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('Success: test message');
        });

        test('should handle tool execution failure', async () => {
            await expect(
                service.invokeTool('mockFailure', {
                    input: { input: 'test' },
                    toolName: 'mockFailure'
                })
            ).rejects.toThrow('Mock failure');
        });

        test('should handle non-existent tool', async () => {
            await expect(
                service.invokeTool('nonExistent', {
                    input: {},
                    toolName: 'nonExistent'
                })
            ).rejects.toThrow("Tool 'nonExistent' not found");
        });

        test('should handle cancellation', async () => {
            const token = new PauseController();
            
            const executionPromise = service.invokeTool('mockSuccess', {
                input: { message: 'test' },
                toolName: 'mockSuccess'
            }, token);

            token.cancel();

            // Note: This would depend on tool implementation respecting cancellation
            await expect(executionPromise).resolves.toBeDefined();
            
            token.dispose();
        });
    });

    describe('Healing Integration', () => {
        beforeEach(() => {
            ToolRegistry.registerTool(MockEditTool);
            service = new ToolsServiceImpl(mockHealingSystem);
        });

        test('should attempt healing on edit tool failure', async () => {
            const result = await service.invokeTool('mockEdit', {
                input: {
                    uri: '/test/file.txt',
                    oldString: 'old',
                    newString: 'new',
                    fileContent: 'old content'
                },
                toolName: 'mockEdit'
            });

            expect(mockHealingSystem.healString).toHaveBeenCalled();
            expect(result.content).toBe('Healed string result');
            expect(result.success).toBe(true);
        });

        test('should handle healing failure', async () => {
            mockHealingSystem.healString.mockRejectedValueOnce(new Error('Healing failed'));

            await expect(
                service.invokeTool('mockEdit', {
                    input: {
                        uri: '/test/file.txt',
                        oldString: 'old',
                        newString: 'new',
                        fileContent: 'old content'
                    },
                    toolName: 'mockEdit'
                })
            ).rejects.toThrow('Mock failure'); // Original error
        });
    });

    describe('Input Validation', () => {
        beforeEach(() => {
            ToolRegistry.registerTool(MockSuccessTool);
            service = new ToolsServiceImpl();
        });

        test('should validate valid input', () => {
            const validation = service.validateToolInput('mockSuccess', JSON.stringify({
                message: 'test message'
            }));

            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should detect missing required fields', () => {
            const validation = service.validateToolInput('mockSuccess', JSON.stringify({}));

            expect(validation.valid).toBe(false);
            expect(validation.errors.some(e => e.field === 'message')).toBe(true);
        });

        test('should handle invalid JSON', () => {
            const validation = service.validateToolInput('mockSuccess', 'invalid json');

            expect(validation.valid).toBe(false);
            expect(validation.errors.some(e => e.field === 'input')).toBe(true);
        });

        test('should handle non-existent tool', () => {
            const validation = service.validateToolInput('nonExistent', '{}');

            expect(validation.valid).toBe(false);
            expect(validation.errors.some(e => e.field === 'tool')).toBe(true);
        });
    });

    describe('Tool Filtering', () => {
        beforeEach(() => {
            ToolRegistry.registerTool(MockSuccessTool);
            ToolRegistry.registerTool(MockFailureTool);
            service = new ToolsServiceImpl();
        });

        test('should return all tools by default', () => {
            const request: CliRequest = { query: 'test' };
            const tools = service.getEnabledTools(request);

            expect(tools).toHaveLength(2);
        });

        test('should apply custom filter', () => {
            const request: CliRequest = { query: 'test' };
            const filter: ToolFilter = (tool: LanguageModelToolInformation) => tool.name === 'mockSuccess';

            const tools = service.getEnabledTools(request, filter);

            expect(tools).toHaveLength(1);
            expect(tools[0].name).toBe('mockSuccess');
        });

        test('should respect dry-run mode', () => {
            const request: CliRequest = { 
                query: 'test',
                options: { dryRun: true }
            };

            // Mock a destructive tool
            interface DestructiveToolParams extends IToolParams {
                [key: string]: unknown;
            }
            
            class DestructiveTool extends BaseTool<DestructiveToolParams> {
                readonly name = 'destructive';
                readonly description = 'Destructive tool';
                readonly category = 'test' as const;
                readonly tags = ['destructive'];
                readonly complexity = 'core' as const;
                readonly inputSchema = { type: 'object' };

                async invoke(_options: CliToolInvocationOptions<DestructiveToolParams>, _token: CliCancellationToken): Promise<CliToolResult> {
                    return this.createSuccessResult('Destructive operation completed');
                }
            }

            ToolRegistry.registerTool(DestructiveTool);
            service = new ToolsServiceImpl();

            const tools = service.getEnabledTools(request);
            
            // Should not include destructive tools in dry-run
            expect(tools.every(t => !t.tags?.includes('destructive'))).toBe(true);
        });
    });

    describe('Statistics', () => {
        beforeEach(() => {
            ToolRegistry.registerTool(MockSuccessTool);
            ToolRegistry.registerTool(MockFailureTool);
            service = new ToolsServiceImpl();
        });

        test('should provide accurate statistics', () => {
            const stats = service.getStats();

            expect(stats.totalTools).toBe(2);
            expect(stats.enabledTools).toBe(2);
            expect(stats.toolsWithHealing).toBe(1);
            expect(stats.categoriesCovered).toContain('test');
        });
    });

    describe('Dynamic Tool Management', () => {
        test('should add tool dynamically', () => {
            const success = service.addTool(MockSuccessTool);

            expect(success).toBe(true);
            expect(service.getTool('mockSuccess')).toBeDefined();
        });

        test('should remove tool', () => {
            service.addTool(MockSuccessTool);
            const removed = service.removeTool('mockSuccess');

            expect(removed).toBe(true);
            expect(service.getTool('mockSuccess')).toBeUndefined();
        });

        test('should reload tools', () => {
            ToolRegistry.registerTool(MockSuccessTool);
            
            expect(() => service.reloadTools()).not.toThrow();
            expect(service.getTool('mockSuccess')).toBeDefined();
        });

        test('should create tool instance', () => {
            service.addTool(MockSuccessTool);
            const instance = service.createToolInstance('mockSuccess');

            expect(instance).toBeInstanceOf(MockSuccessTool);
        });
    });
});

describe('ToolsServiceFactory', () => {
    afterEach(() => {
        ToolRegistry.clear();
    });

    test('should create basic service', () => {
        const service = ToolsServiceFactory.createBasic();
        
        expect(service).toBeInstanceOf(ToolsServiceImpl);
    });

    test('should create service with healing', () => {
        const service = ToolsServiceFactory.createWithHealing(mockHealingSystem);
        
        expect(service).toBeInstanceOf(ToolsServiceImpl);
    });

    test('should create service with pre-registered tools', () => {
        const tools = [MockSuccessTool, MockFailureTool];
        const service = ToolsServiceFactory.createWithTools(tools);
        
        expect(service.tools).toHaveLength(2);
    });
});

describe('ToolsServiceSingleton', () => {
    afterEach(() => {
        ToolsServiceSingleton.reset();
        ToolRegistry.clear();
    });

    test('should create singleton instance', () => {
        const instance1 = ToolsServiceSingleton.getInstance();
        const instance2 = ToolsServiceSingleton.getInstance();
        
        expect(instance1).toBe(instance2);
    });

    test('should initialize with healing system', () => {
        const instance = ToolsServiceSingleton.initialize(mockHealingSystem);
        
        expect(instance).toBeInstanceOf(ToolsServiceImpl);
    });

    test('should reset singleton', () => {
        const instance1 = ToolsServiceSingleton.getInstance();
        ToolsServiceSingleton.reset();
        const instance2 = ToolsServiceSingleton.getInstance();
        
        expect(instance1).not.toBe(instance2);
    });
});

describe('Integration Tests', () => {
    let service: IToolsService;

    beforeEach(() => {
        ToolRegistry.clear();
        service = new ToolsServiceImpl(mockHealingSystem);
    });

    afterEach(() => {
        ToolRegistry.clear();
    });

    test('should handle complete tool lifecycle', async () => {
        // Register tools
        ToolRegistry.registerTool(MockSuccessTool);
        service = new ToolsServiceImpl();

        // Validate tool
        const validation = service.validateToolInput('mockSuccess', JSON.stringify({
            message: 'integration test'
        }));
        expect(validation.valid).toBe(true);

        // Execute tool
        const result = await service.invokeTool('mockSuccess', {
            input: { message: 'integration test' },
            toolName: 'mockSuccess'
        });
        expect(result.success).toBe(true);

        // Check statistics
        const stats = service.getStats();
        expect(stats.totalTools).toBe(1);

        // Remove tool
        const removed = service.removeTool('mockSuccess');
        expect(removed).toBe(true);
        expect(service.getTool('mockSuccess')).toBeUndefined();
    });

    test('should integrate healing properly', async () => {
        ToolRegistry.registerTool(MockEditTool);
        service = new ToolsServiceImpl(mockHealingSystem);

        const result = await service.invokeTool('mockEdit', {
            input: {
                uri: '/test.txt',
                oldString: 'old',
                newString: 'new',
                fileContent: 'content'
            },
            toolName: 'mockEdit'
        });

        expect(result.success).toBe(true);
        expect(mockHealingSystem.healString).toHaveBeenCalled();
    });
});