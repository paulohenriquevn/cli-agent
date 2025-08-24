/*---------------------------------------------------------------------------------------------
 * Tool Registry Unit Tests
 *--------------------------------------------------------------------------------------------*/

import { 
    ToolRegistry, 
    ToolRegistryUtils,
    BaseToolCtor
} from '../toolRegistry';
import { BaseTool, IToolParams } from '../../base/baseTool';
import { CliToolResult, CliToolInvocationOptions, CliCancellationToken } from '../../types/cliTypes';

// Mock tool implementations for testing
interface MockBasicParams extends IToolParams {
    input: string;
}

class MockBasicTool extends BaseTool<MockBasicParams> {
    readonly name = 'mockBasic';
    readonly description = 'A basic mock tool for testing';
    readonly category = 'utility';
    readonly tags = ['test', 'mock'];
    readonly complexity: 'core' = 'core';

    readonly inputSchema = {
        type: 'object',
        properties: {
            input: { type: 'string' }
        },
        required: ['input']
    };

    async invoke(
        options: CliToolInvocationOptions<MockBasicParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        return this.createSuccessResult(
            `Mock result: ${options.input.input}`
        );
    }
}

interface MockAdvancedParams extends IToolParams {
    data: unknown;
}

class MockAdvancedTool extends BaseTool<MockAdvancedParams> {
    readonly name = 'mockAdvanced';
    readonly description = 'An advanced mock tool with healing';
    readonly category = 'code';
    readonly tags = ['test', 'advanced', 'healing'];
    readonly complexity: 'advanced' = 'advanced';

    readonly inputSchema = {
        type: 'object',
        properties: {
            data: { type: 'object' }
        },
        required: ['data']
    };

    async invoke(
        options: CliToolInvocationOptions<MockAdvancedParams>,
        _token: CliCancellationToken
    ): Promise<CliToolResult> {
        return this.createSuccessResult(
            `Advanced result: ${JSON.stringify(options.input.data)}`
        );
    }

    async filterEdits(_resource: string) {
        return { 
            title: 'Test Filter',
            message: 'Test filter message'
        };
    }

    async provideInput() {
        return { data: { test: true } };
    }
}

class InvalidTool {
    // Missing required properties for BaseTool
    name = 'invalid';
    // Missing: description, inputSchema, tags, category, complexity, invoke
}

describe('ToolRegistry', () => {
    beforeEach(() => {
        ToolRegistry.clear();
    });

    describe('Tool Registration', () => {
        test('should register valid tool successfully', () => {
            ToolRegistry.registerTool(MockBasicTool);
            
            const tools = ToolRegistry.getTools();
            expect(tools).toHaveLength(1);
            
            const instance = tools[0];
            expect(instance.name).toBe('mockBasic');
        });

        test('should prevent duplicate registrations', () => {
            ToolRegistry.registerTool(MockBasicTool);
            ToolRegistry.registerTool(MockBasicTool); // Duplicate
            
            const tools = ToolRegistry.getTools();
            expect(tools).toHaveLength(1);
        });

        test('should organize tools by category', () => {
            ToolRegistry.registerTool(MockBasicTool);
            ToolRegistry.registerTool(MockAdvancedTool);
            
            const utilityTools = ToolRegistry.getToolsByCategory('utility');
            const codeTools = ToolRegistry.getToolsByCategory('code');
            
            expect(utilityTools).toHaveLength(1);
            expect(codeTools).toHaveLength(1);
            
            const utilityInstance = utilityTools[0];
            expect(utilityInstance.name).toBe('mockBasic');
        });

        test('should organize tools by tags', () => {
            ToolRegistry.registerTool(MockBasicTool);
            ToolRegistry.registerTool(MockAdvancedTool);
            
            const testTools = ToolRegistry.getToolsByTag('test');
            const healingTools = ToolRegistry.getToolsByTag('healing');
            
            expect(testTools).toHaveLength(2);
            expect(healingTools).toHaveLength(1);
            
            const healingInstance = healingTools[0];
            expect(healingInstance.name).toBe('mockAdvanced');
        });
    });

    describe('Tool Retrieval', () => {
        beforeEach(() => {
            ToolRegistry.registerTool(MockBasicTool);
            ToolRegistry.registerTool(MockAdvancedTool);
        });

        test('should retrieve tool by name', () => {
            const tool = ToolRegistry.getTool('mockBasic');
            expect(tool).toBeDefined();
            
            if (tool) {
                const instance = tool;
                expect(instance.name).toBe('mockBasic');
            }
        });

        test('should return undefined for non-existent tool', () => {
            const tool = ToolRegistry.getTool('nonExistent');
            expect(tool).toBeUndefined();
        });

        test('should list all categories', () => {
            const categories = ToolRegistry.getCategories();
            expect(categories).toContain('utility');
            expect(categories).toContain('code');
        });

        test('should list all tags', () => {
            const tags = ToolRegistry.getTags();
            expect(tags).toContain('test');
            expect(tags).toContain('mock');
            expect(tags).toContain('advanced');
            expect(tags).toContain('healing');
        });
    });

    describe('Statistics and Filtering', () => {
        beforeEach(() => {
            ToolRegistry.registerTool(MockBasicTool);
            ToolRegistry.registerTool(MockAdvancedTool);
        });

        test('should provide accurate statistics', () => {
            const stats = ToolRegistry.getStats();
            
            expect(stats.totalTools).toBe(2);
            expect(stats.categoriesCount).toBe(2);
            expect(stats.toolsByComplexity.advanced).toBe(1);
            expect(stats.toolsByComplexity.core).toBe(1);
            expect(stats.toolsByCategory.utility).toBe(1);
            expect(stats.toolsByCategory.code).toBe(1);
        });

        test('should filter tools by criteria', () => {
            const advancedTools = ToolRegistry.filterTools({ complexity: 'advanced' });
            const utilityTools = ToolRegistry.filterTools({ category: 'utility' });
            const testTagTools = ToolRegistry.filterTools({ tags: ['test'] });
            
            expect(advancedTools).toHaveLength(1);
            expect(utilityTools).toHaveLength(1);
            expect(testTagTools).toHaveLength(2);
        });

        test('should filter tools by name pattern', () => {
            const mockTools = ToolRegistry.filterTools({ name: /^mock/ });
            const basicTools = ToolRegistry.filterTools({ name: /Basic$/ });
            
            expect(mockTools).toHaveLength(2);
            expect(basicTools).toHaveLength(1);
        });
    });

    describe('Tool Validation', () => {
        test('should validate correct tool structure', () => {
            const validation = ToolRegistry.validateTool(MockBasicTool);
            
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should detect missing required properties', () => {
            const validation = ToolRegistry.validateTool(InvalidTool as unknown as BaseToolCtor);
            
            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            // Should have errors for missing description, invoke method, and inputSchema
            expect(validation.errors.some(e => e.includes('description'))).toBe(true);
        });

        test('should provide helpful warnings', () => {
            class MinimalTool extends BaseTool {
                readonly name = 'minimal';
                readonly description = 'Minimal tool';
                readonly inputSchema = {};
                readonly tags: string[] = [];
                readonly category = '';
                readonly complexity: 'core' = 'core';
                
                async invoke(): Promise<CliToolResult> {
                    return this.createSuccessResult('result');
                }
            }

            const validation = ToolRegistry.validateTool(MinimalTool);
            
            expect(validation.valid).toBe(true);
            expect(validation.warnings.length).toBeGreaterThan(0);
            expect(validation.warnings.some(w => w.includes('tags'))).toBe(true);
        });
    });

    describe('Tool Unregistration', () => {
        beforeEach(() => {
            ToolRegistry.registerTool(MockBasicTool);
            ToolRegistry.registerTool(MockAdvancedTool);
        });

        test('should unregister tool successfully', () => {
            const result = ToolRegistry.unregisterTool('mockBasic');
            
            expect(result).toBe(true);
            expect(ToolRegistry.getTools()).toHaveLength(1);
            expect(ToolRegistry.getTool('mockBasic')).toBeUndefined();
        });

        test('should clean up categories and tags', () => {
            ToolRegistry.unregisterTool('mockBasic');
            
            const categories = ToolRegistry.getCategories();
            const tags = ToolRegistry.getTags();
            
            expect(categories).not.toContain('utility');
            expect(tags).not.toContain('mock');
        });

        test('should return false for non-existent tool', () => {
            const result = ToolRegistry.unregisterTool('nonExistent');
            expect(result).toBe(false);
        });
    });

    describe('Tools Summary', () => {
        test('should provide comprehensive summary', () => {
            ToolRegistry.registerTool(MockBasicTool);
            ToolRegistry.registerTool(MockAdvancedTool);
            
            const summary = ToolRegistry.getToolsSummary();
            
            expect(summary).toHaveLength(2);
            
            const basicSummary = summary.find(s => s.name === 'mockBasic');
            expect(basicSummary).toEqual({
                name: 'mockBasic',
                description: 'A basic mock tool for testing',
                category: 'utility',
                tags: ['test', 'mock'],
                complexity: 'core'
            });
            
            const advancedSummary = summary.find(s => s.name === 'mockAdvanced');
            expect(advancedSummary).toEqual({
                name: 'mockAdvanced',
                description: 'An advanced mock tool with healing',
                category: 'code',
                tags: ['test', 'advanced', 'healing'],
                complexity: 'advanced'
            });
        });
    });
});

describe('ToolRegistryUtils', () => {
    beforeEach(() => {
        ToolRegistry.clear();
    });

    describe('Auto Registration', () => {
        test('should auto-register tools from module', () => {
            const mockModule = {
                MockBasicTool,
                MockAdvancedTool,
                NotATool: 'not a tool',
                AnotherNonTool: 42
            };

            const registered = ToolRegistryUtils.autoRegisterFromModule(mockModule);
            
            expect(registered).toBe(2);
            expect(ToolRegistry.getTools()).toHaveLength(2);
        });

        test('should handle module with invalid tools', () => {
            const mockModule = {
                InvalidTool,
                AnotherInvalid: class { static toolName = 'invalid2'; }
            };

            const registered = ToolRegistryUtils.autoRegisterFromModule(mockModule);
            expect(registered).toBe(0);
        });
    });

    describe('Validation Registration', () => {
        test('should register valid tool with validation', () => {
            const result = ToolRegistryUtils.registerWithValidation(MockBasicTool);
            
            expect(result).toBe(true);
            expect(ToolRegistry.getTools()).toHaveLength(1);
        });

        test('should reject invalid tool with validation', () => {
            const result = ToolRegistryUtils.registerWithValidation(InvalidTool as unknown as BaseToolCtor);
            
            expect(result).toBe(false);
            expect(ToolRegistry.getTools()).toHaveLength(0);
        });
    });

    describe('Snapshot', () => {
        test('should create registry snapshot', () => {
            ToolRegistry.registerTool(MockBasicTool);
            ToolRegistry.registerTool(MockAdvancedTool);
            
            const snapshot = ToolRegistryUtils.createSnapshot();
            
            expect(snapshot.tools).toHaveLength(2);
            expect(snapshot.stats.totalTools).toBe(2);
            expect(snapshot.timestamp).toBeCloseTo(Date.now(), -2); // Within 100ms
        });
    });

    describe('Config Loading', () => {
        test('should handle empty config', async () => {
            const result = await ToolRegistryUtils.loadFromConfig({ tools: [] });
            expect(result).toBe(0);
        });

        test('should return zero for mock implementation', async () => {
            const mockConfig = {
                tools: [
                    { module: 'mock-module', export: 'MockTool', enabled: true }
                ]
            };
            
            const result = await ToolRegistryUtils.loadFromConfig(mockConfig);
            expect(result).toBe(0); // Mock implementation
        });
    });
});

describe('Integration Tests', () => {
    beforeEach(() => {
        ToolRegistry.clear();
    });

    test('should handle complete workflow', () => {
        // Register tools
        ToolRegistry.registerTool(MockBasicTool);
        ToolRegistry.registerTool(MockAdvancedTool);
        
        // Validate state
        expect(ToolRegistry.getStats().totalTools).toBe(2);
        
        // Filter and retrieve
        const advancedTools = ToolRegistry.filterTools({ complexity: 'advanced' });
        expect(advancedTools).toHaveLength(1);
        
        // Get summary
        const summary = ToolRegistry.getToolsSummary();
        expect(summary).toHaveLength(2);
        
        // Unregister
        ToolRegistry.unregisterTool('mockBasic');
        expect(ToolRegistry.getTools()).toHaveLength(1);
        
        // Clear all
        ToolRegistry.clear();
        expect(ToolRegistry.getTools()).toHaveLength(0);
    });

    test('should maintain consistency across operations', () => {
        // Start with clean state
        expect(ToolRegistry.getStats().totalTools).toBe(0);
        
        // Register multiple tools
        ToolRegistry.registerTool(MockBasicTool);
        ToolRegistry.registerTool(MockAdvancedTool);
        
        // Verify categories and tags are consistent
        const stats = ToolRegistry.getStats();
        const categories = ToolRegistry.getCategories();
        const tags = ToolRegistry.getTags();
        
        expect(stats.categoriesCount).toBe(categories.length);
        expect(stats.tagsCount).toBe(tags.length);
        
        // Verify tool counts match
        let totalByCategory = 0;
        for (const count of Object.values(stats.toolsByCategory)) {
            totalByCategory += count;
        }
        expect(totalByCategory).toBe(stats.totalTools);
    });
});