/*---------------------------------------------------------------------------------------------
 * Integration Tests - Complete Tool Registry System
 *--------------------------------------------------------------------------------------------*/

import {
    createIntegratedToolSystem,
    IntegratedQuickSetup,
    quickExecute
} from '../index';
import { 
    RegistryIntegratedToolCallingLoop,
    RegistryIntegratedLoopFactory,
    IntegrationUtils
} from '../toolCallingLoopIntegration';
import { ToolRegistry, BaseToolCtor } from '../toolRegistry';
import { BaseTool, IToolParams } from '../../base/baseTool';
import { CliToolInvocationOptions as ToolInvocationOptions, CliCancellationToken, CliToolResult } from '../../types/cliTypes';
import { IntentType } from '../intentLayer';
import { LanguageModelToolResult2 } from '../../execution/types';

// Mock tools for integration testing
class MockIntegrationTool extends BaseTool<{ action: string }> {
    readonly name = 'mockIntegration';
    readonly description = 'Mock tool for integration testing';
    readonly category = 'test' as const;
    readonly tags = ['test', 'integration'];
    readonly complexity = 'core' as const;

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: { type: 'string' }
        },
        required: ['action']
    };

    async invoke(options: ToolInvocationOptions<{ action: string }>, token: CliCancellationToken): Promise<CliToolResult> {
        const { action } = options.input;
        
        if (action === 'fail') {
            return this.createErrorResult('Mock tool failure');
        }
        
        return this.createSuccessResult(`Integration test result: ${action}`);
    }

    async filterEdits() {
        return { title: 'Integration Test', message: 'Integration test allows all edits' };
    }
}

class MockFileTool extends BaseTool<{ path: string }> {
    readonly name = 'mockFile';
    readonly description = 'Mock file operations';
    readonly category = 'file' as const;
    readonly tags = ['file', 'edit'];
    readonly complexity = 'core' as const;

    readonly inputSchema = {
        type: 'object',
        properties: {
            path: { type: 'string' }
        },
        required: ['path']
    };

    async invoke(options: ToolInvocationOptions<{ path: string }>, token: CliCancellationToken): Promise<CliToolResult> {
        return this.createSuccessResult(`File operation on: ${options.input.path}`);
    }
}

class MockSearchTool extends BaseTool<{ query: string }> {
    readonly name = 'mockSearch';
    readonly description = 'Mock search operations';
    readonly category = 'search' as const;
    readonly tags = ['search', 'utility'];
    readonly complexity = 'core' as const;

    readonly inputSchema = {
        type: 'object',
        properties: {
            query: { type: 'string' }
        },
        required: ['query']
    };

    async invoke(options: ToolInvocationOptions<{ query: string }>, token: CliCancellationToken): Promise<CliToolResult> {
        return this.createSuccessResult(`Search results for: ${options.input.query}`);
    }
}

describe('Integrated Tool System', () => {
    beforeEach(() => {
        ToolRegistry.clear();
    });

    afterEach(() => {
        ToolRegistry.clear();
    });

    describe('System Creation', () => {
        test('should create integrated system with default options', () => {
            const system = createIntegratedToolSystem();

            expect(system).toBeDefined();
            expect(system.sessionId).toBeDefined();
            expect(system.registry).toBe(ToolRegistry);
            expect(system.toolsService).toBeDefined();
            expect(system.healingSystem).toBeDefined();
            expect(typeof system.registerTool).toBe('function');
            expect(typeof system.execute).toBe('function');
        });

        test('should create system with custom options', () => {
            const options = {
                sessionId: 'test-session-123',
                enableHealing: false,
                autoRegisterTools: false,
                persistContext: false,
                enableStreaming: false,
                enableMonitoring: false
            };

            const system = createIntegratedToolSystem(options);

            expect(system.sessionId).toBe('test-session-123');
            expect(system.healingSystem).toBeUndefined();
        });

        test('should handle tool registration', () => {
            const system = createIntegratedToolSystem();
            
            const result = system.registerTool(MockIntegrationTool);
            expect(result).toBe(true);

            const tools = system.listTools();
            expect(tools).toHaveLength(1);
            expect(tools[0].name).toBe('mockIntegration');
        });

        test('should handle tool unregistration', () => {
            const system = createIntegratedToolSystem();
            
            system.registerTool(MockIntegrationTool);
            const removed = system.unregisterTool('mockIntegration');
            
            expect(removed).toBe(true);
            expect(system.listTools()).toHaveLength(0);
        });
    });

    describe('Factory Methods', () => {
        test('should create agent with proper configuration', () => {
            const system = createIntegratedToolSystem();
            system.registerTool(MockIntegrationTool);

            const agent = system.createAgent('Test query for agent');
            
            expect(agent).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        });

        test('should create editor with file context', () => {
            const system = createIntegratedToolSystem();
            system.registerTool(MockFileTool);

            const editor = system.createEditor('/test/file.js', 'Edit this file');
            
            expect(editor).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        });

        test('should create search with workspace context', () => {
            const system = createIntegratedToolSystem();
            system.registerTool(MockSearchTool);

            const search = system.createSearch('Find all references', '/workspace');
            
            expect(search).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        });

        test('should create custom loop with specific intent', () => {
            const system = createIntegratedToolSystem();
            
            const custom = system.createCustom(IntentType.Debug, 'Debug this issue');
            
            expect(custom).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        });
    });

    describe('Context Management', () => {
        test('should save and retrieve context', () => {
            const system = createIntegratedToolSystem({ sessionId: 'test-session' });
            
            const testContext = {
                workspace: { rootPath: '/test', files: ['file1.js'] },
                userPreferences: { safeMode: true }
            };

            system.saveContext(testContext);
            const retrieved = system.getContext();

            expect(retrieved?.workspace?.rootPath).toBe('/test');
            expect(retrieved?.userPreferences?.safeMode).toBe(true);
        });

        test('should handle missing session context', () => {
            const system = createIntegratedToolSystem({ persistContext: false });
            
            const context = system.getContext();
            expect(context).toBeUndefined();
        });
    });

    describe('System Status', () => {
        test('should provide comprehensive system status', () => {
            const system = createIntegratedToolSystem({ sessionId: 'status-test' });
            system.registerTool(MockIntegrationTool);
            system.registerTool(MockFileTool);

            const status = system.getSystemStatus();

            expect(status.session.id).toBe('status-test');
            expect(status.registry.totalTools).toBe(2);
            expect(status.service.totalTools).toBe(2);
            expect(status.healing.enabled).toBe(true);
            expect(status.features.streaming).toBe(true);
        });

        test('should reflect disabled features in status', () => {
            const system = createIntegratedToolSystem({
                enableHealing: false,
                enableStreaming: false,
                enableMonitoring: false
            });

            const status = system.getSystemStatus();

            expect(status.healing.enabled).toBe(false);
            expect(status.features.streaming).toBe(false);
            expect(status.features.monitoring).toBe(false);
        });
    });

    describe('Intent Detection', () => {
        test('should detect intent from query', () => {
            const system = createIntegratedToolSystem();
            
            const editIntent = system.detectIntent('edit the main function');
            const searchIntent = system.detectIntent('search for references');
            const debugIntent = system.detectIntent('debug this error');

            expect(editIntent.type).toBe(IntentType.Editor);
            expect(searchIntent.type).toBe(IntentType.Search);
            expect(debugIntent.type).toBe(IntentType.Debug);
        });
    });

    describe('Execution', () => {
        // Note: These tests would require mocking the LLM calls
        // For now, we test the setup and structure

        test('should prepare execution with proper intent', async () => {
            const system = createIntegratedToolSystem();
            system.registerTool(MockIntegrationTool);

            // This would normally execute but we're testing structure
            expect(() => {
                system.execute('Test query');
            }).not.toThrow();
        });

        test('should handle different execution modes', async () => {
            const system = createIntegratedToolSystem();
            system.registerTool(MockFileTool);

            const options = [
                { intentType: IntentType.Editor },
                { filePath: '/test/file.js' },
                { workspace: '/workspace' },
                { intentType: IntentType.Search }
            ];

            for (const option of options) {
                expect(() => {
                    system.execute('Test query', option);
                }).not.toThrow();
            }
        });
    });

    describe('Disposal', () => {
        test('should dispose system cleanly', () => {
            const system = createIntegratedToolSystem({ 
                sessionId: 'dispose-test',
                persistContext: true 
            });

            expect(() => system.dispose()).not.toThrow();
            
            // Context should be marked as disposed
            const context = system.getContext();
            expect(context?.sessionData?.preferences.disposed).toBe(true);
        });
    });
});

describe('Quick Setup Presets', () => {
    beforeEach(() => {
        ToolRegistry.clear();
    });

    afterEach(() => {
        ToolRegistry.clear();
    });

    test('should create development setup', () => {
        const system = IntegratedQuickSetup.development();
        const status = system.getSystemStatus();

        expect(status.healing.enabled).toBe(true);
        expect(status.features.streaming).toBe(true);
        expect(status.features.monitoring).toBe(true);
        expect(status.session.persistent).toBe(true);
    });

    test('should create production setup', () => {
        const system = IntegratedQuickSetup.production();
        const status = system.getSystemStatus();

        expect(status.healing.enabled).toBe(true);
        expect(status.features.nesting).toBe(true);
        expect(status.features.monitoring).toBe(true);
    });

    test('should create editor setup', () => {
        const system = IntegratedQuickSetup.editor('/test/file.js');
        
        expect(system.edit).toBeDefined();
        expect(typeof system.edit).toBe('function');
    });

    test('should create search setup', () => {
        const system = IntegratedQuickSetup.search('/workspace');
        
        expect(system.search).toBeDefined();
        expect(typeof system.search).toBe('function');
    });

    test('should create testing setup', () => {
        const system = IntegratedQuickSetup.testing();
        const status = system.getSystemStatus();

        expect(status.healing.enabled).toBe(false);
        expect(status.features.streaming).toBe(false);
        expect(status.features.monitoring).toBe(false);
        expect(status.session.persistent).toBe(false);
    });

    test('should create complete setup', () => {
        const system = IntegratedQuickSetup.complete();
        const status = system.getSystemStatus();

        expect(status.healing.enabled).toBe(true);
        expect(status.features.streaming).toBe(true);
        expect(status.features.nesting).toBe(true);
        expect(status.features.monitoring).toBe(true);
        expect(status.session.persistent).toBe(true);
        expect(status.features.autoRegister).toBe(true);
    });
});

describe('Quick Execute', () => {
    beforeEach(() => {
        ToolRegistry.clear();
    });

    afterEach(() => {
        ToolRegistry.clear();
    });

    test('should create system for quick execution', async () => {
        ToolRegistry.registerTool(MockIntegrationTool);

        const result = quickExecute('Test quick execution', {
            healing: true,
            streaming: false,
            sessionId: 'quick-test'
        });

        // This would normally execute - we're testing structure
        expect(result).toBeDefined();
    });

    test('should handle different quick execution options', async () => {
        const options = [
            { intent: IntentType.Editor, filePath: '/test.js' },
            { intent: IntentType.Search, workspace: '/workspace' },
            { healing: false, streaming: true },
            { sessionId: 'custom-session' }
        ];

        for (const option of options) {
            expect(() => {
                quickExecute('Test query', option);
            }).not.toThrow();
        }
    });
});

describe('Registry Integration Layer', () => {
    beforeEach(() => {
        ToolRegistry.clear();
    });

    afterEach(() => {
        ToolRegistry.clear();
    });

    describe('RegistryIntegratedLoopFactory', () => {
        test('should create basic integrated loop', () => {
            const loop = RegistryIntegratedLoopFactory.createBasic();
            
            expect(loop).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        });

        test('should create agent loop with session', () => {
            const loop = RegistryIntegratedLoopFactory.createAgent(
                'Test agent query',
                'agent-session'
            );
            
            expect(loop).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        });

        test('should create editor loop with context', () => {
            const loop = RegistryIntegratedLoopFactory.createEditor(
                '/test/file.js',
                'Edit query',
                'editor-session'
            );
            
            expect(loop).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        });

        test('should create search loop', () => {
            const loop = RegistryIntegratedLoopFactory.createSearch(
                'Search query',
                '/workspace'
            );
            
            expect(loop).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        });

        test('should create custom loop', () => {
            const loop = RegistryIntegratedLoopFactory.createCustom({
                toolCallLimit: 10,
                enableStreaming: true,
                model: { family: 'anthropic', name: 'claude-3' },
                intentType: IntentType.Debug,
                request: { query: 'Debug query' },
                sessionId: 'custom-session'
            });
            
            expect(loop).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        });
    });

    describe('IntegrationUtils', () => {
        test('should register implementation tools', async () => {
            const result = await IntegrationUtils.registerImplementationTools();
            expect(typeof result).toBe('number');
        });

        test('should create integrated system via utils', () => {
            const system = IntegrationUtils.createIntegratedSystem({
                sessionId: 'utils-test',
                enableHealing: true,
                autoRegisterTools: false,
                persistContext: true
            });

            expect(system.toolsService).toBeDefined();
            expect(system.healingSystem).toBeDefined();
            expect(system.registry).toBe(ToolRegistry);
            expect(typeof system.createAgent).toBe('function');
        });
    });
});

describe('End-to-End Integration', () => {
    beforeEach(() => {
        ToolRegistry.clear();
    });

    afterEach(() => {
        ToolRegistry.clear();
    });

    test('should handle complete workflow', () => {
        // 1. Create system
        const system = createIntegratedToolSystem({
            sessionId: 'e2e-test',
            enableHealing: true,
            enableStreaming: true,
            persistContext: true
        });

        // 2. Register tools
        system.registerTool(MockIntegrationTool);
        system.registerTool(MockFileTool);
        system.registerTool(MockSearchTool);

        // 3. Check system status
        const status = system.getSystemStatus();
        expect(status.registry.totalTools).toBe(3);

        // 4. Create different types of loops
        const agent = system.createAgent('Analyze this codebase');
        const editor = system.createEditor('/test.js', 'Fix the bug');
        const search = system.createSearch('Find all TODO comments');

        expect(agent).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        expect(editor).toBeInstanceOf(RegistryIntegratedToolCallingLoop);
        expect(search).toBeInstanceOf(RegistryIntegratedToolCallingLoop);

        // 5. Get integration stats (would require actual execution)
        expect(() => agent.getIntegrationStats()).not.toThrow();

        // 6. Clean up
        system.dispose();
    });

    test('should maintain consistency across operations', () => {
        const system = createIntegratedToolSystem();

        // Register tools
        system.registerTool(MockIntegrationTool);
        system.registerTool(MockFileTool);

        // Check initial state
        let stats = system.getToolStats();
        expect(stats.totalTools).toBe(2);

        // Add more tools
        system.registerTool(MockSearchTool);
        stats = system.getToolStats();
        expect(stats.totalTools).toBe(3);

        // Remove tool
        system.unregisterTool('mockFile');
        stats = system.getToolStats();
        expect(stats.totalTools).toBe(2);

        // Verify service is in sync
        const serviceStats = system.getSystemStatus().service;
        expect(serviceStats.totalTools).toBe(2);
    });

    test('should handle errors gracefully', () => {
        const system = createIntegratedToolSystem();

        // Try to remove non-existent tool
        expect(() => system.unregisterTool('nonExistent')).not.toThrow();

        // Try to get stats with empty registry
        expect(() => system.getToolStats()).not.toThrow();
        expect(() => system.getSystemStatus()).not.toThrow();

        // Try to create loops with no tools
        expect(() => system.createAgent('test')).not.toThrow();
        expect(() => system.createEditor('/test.js', 'test')).not.toThrow();
    });
});