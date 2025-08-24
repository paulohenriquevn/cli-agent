/*---------------------------------------------------------------------------------------------
 * Intent Layer Unit Tests
 *--------------------------------------------------------------------------------------------*/

import {
    IntentType,
    IntentConfig,
    IntentContext,
    BaseIntentInvocation,
    AgentIntentInvocation,
    EditorIntentInvocation,
    SearchIntentInvocation,
    DebugIntentInvocation,
    IntentFactory,
    IntentContextManager
} from '../intentLayer';
import { LanguageModelToolInformation } from '../../execution/types';
import { IToolsService, CliRequest } from '../toolsService';

// Mock tools service
class MockToolsService implements IToolsService {
    private mockTools: LanguageModelToolInformation[] = [
        {
            name: 'editFile',
            description: 'Edit a file',
            tags: ['edit', 'file'],
            inputSchema: {}
        },
        {
            name: 'readFile',
            description: 'Read a file',
            tags: ['read', 'file'],
            inputSchema: {}
        },
        {
            name: 'searchCode',
            description: 'Search code',
            tags: ['search'],
            inputSchema: {}
        },
        {
            name: 'grep',
            description: 'Grep files',
            tags: ['search', 'grep'],
            inputSchema: {}
        },
        {
            name: 'debugAnalyze',
            description: 'Debug analysis',
            tags: ['debug', 'analysis'],
            inputSchema: {}
        },
        {
            name: 'destructiveTool',
            description: 'Destructive operation',
            tags: ['destructive'],
            inputSchema: {}
        }
    ];

    get tools() { return this.mockTools; }
    get copilotTools() { return new Map(); }

    getTool(name: string) {
        return this.mockTools.find(t => t.name === name);
    }

    getCopilotTool() { return undefined; }

    async invokeTool(): Promise<any> {
        return { content: 'mock result', success: true };
    }

    validateToolInput(): any {
        return { valid: true, errors: [] };
    }

    getEnabledTools(request: CliRequest, filter?: any): LanguageModelToolInformation[] {
        let tools = [...this.mockTools];
        
        if (filter) {
            tools = tools.filter(tool => {
                const result = filter(tool);
                return result !== undefined ? result : true;
            });
        }
        
        return tools;
    }

    createToolInstance() { return undefined; }
}

describe('BaseIntentInvocation', () => {
    let toolsService: MockToolsService;
    let request: CliRequest;
    let context: IntentContext;

    beforeEach(() => {
        toolsService = new MockToolsService();
        request = {
            query: 'test query',
            context: { workingDirectory: '/test' }
        };
        context = {
            workspace: { rootPath: '/test', files: [] },
            userPreferences: { safeMode: false }
        };
    });

    test('should create with default configuration', () => {
        class TestIntent extends BaseIntentInvocation {
            constructor() {
                super(toolsService, IntentType.Agent, request);
            }
        }

        const intent = new TestIntent();

        expect(intent.type).toBe(IntentType.Agent);
        expect(intent.config.maxTools).toBe(50);
        expect(intent.config.enableHealing).toBe(true);
    });

    test('should apply custom configuration', () => {
        class TestIntent extends BaseIntentInvocation {
            constructor() {
                super(toolsService, IntentType.Editor, request, {
                    maxTools: 10,
                    enableHealing: false,
                    allowedTools: ['editFile']
                });
            }
        }

        const intent = new TestIntent();

        expect(intent.config.maxTools).toBe(10);
        expect(intent.config.enableHealing).toBe(false);
        expect(intent.config.allowedTools).toEqual(['editFile']);
    });

    test('should filter tools by allowed list', async () => {
        class TestIntent extends BaseIntentInvocation {
            constructor() {
                super(toolsService, IntentType.Agent, request, {
                    allowedTools: ['editFile', 'readFile']
                });
            }
        }

        const intent = new TestIntent();
        const tools = await intent.getAvailableTools();

        expect(tools).toHaveLength(2);
        expect(tools.map(t => t.name)).toEqual(['editFile', 'readFile']);
    });

    test('should filter tools by blocked list', async () => {
        class TestIntent extends BaseIntentInvocation {
            constructor() {
                super(toolsService, IntentType.Agent, request, {
                    blockedTools: ['destructiveTool']
                });
            }
        }

        const intent = new TestIntent();
        const tools = await intent.getAvailableTools();

        expect(tools.map(t => t.name)).not.toContain('destructiveTool');
    });

    test('should filter by required tags', async () => {
        class TestIntent extends BaseIntentInvocation {
            constructor() {
                super(toolsService, IntentType.Agent, request, {
                    requiredTags: ['search']
                });
            }
        }

        const intent = new TestIntent();
        const tools = await intent.getAvailableTools();

        expect(tools.every(t => t.tags?.includes('search'))).toBe(true);
    });

    test('should filter by blocked tags', async () => {
        class TestIntent extends BaseIntentInvocation {
            constructor() {
                super(toolsService, IntentType.Agent, request, {
                    blockedTags: ['destructive']
                });
            }
        }

        const intent = new TestIntent();
        const tools = await intent.getAvailableTools();

        expect(tools.every(t => !t.tags?.includes('destructive'))).toBe(true);
    });

    test('should respect max tools limit', async () => {
        class TestIntent extends BaseIntentInvocation {
            constructor() {
                super(toolsService, IntentType.Agent, request, {
                    maxTools: 2
                });
            }
        }

        const intent = new TestIntent();
        const tools = await intent.getAvailableTools();

        expect(tools).toHaveLength(2);
    });

    test('should validate tool usage', () => {
        class TestIntent extends BaseIntentInvocation {
            constructor() {
                super(toolsService, IntentType.Agent, request, {
                    allowedTools: ['editFile']
                });
            }
        }

        const intent = new TestIntent();

        expect(intent.canUseTool('editFile')).toBe(true);
        expect(intent.canUseTool('readFile')).toBe(false);
    });
});

describe('AgentIntentInvocation', () => {
    let toolsService: MockToolsService;
    let request: CliRequest;

    beforeEach(() => {
        toolsService = new MockToolsService();
        request = { query: 'test query' };
    });

    test('should allow most tools by default', async () => {
        const intent = new AgentIntentInvocation(toolsService, request);
        const tools = await intent.getAvailableTools();

        expect(tools.length).toBeGreaterThan(0);
        expect(tools.map(t => t.name)).toContain('editFile');
        expect(tools.map(t => t.name)).toContain('searchCode');
    });

    test('should filter destructive tools in safe mode', async () => {
        const context: IntentContext = {
            userPreferences: { safeMode: true }
        };

        const intent = new AgentIntentInvocation(toolsService, request, context);
        const tools = await intent.getAvailableTools();

        expect(tools.map(t => t.name)).not.toContain('destructiveTool');
    });

    test('should prioritize edit tools when current file exists', async () => {
        const context: IntentContext = {
            currentFile: { path: '/test/file.ts' }
        };

        const intent = new AgentIntentInvocation(toolsService, request, context);
        const tools = await intent.getAvailableTools();

        // editFile should come before non-edit tools
        const editIndex = tools.findIndex(t => t.name === 'editFile');
        const searchIndex = tools.findIndex(t => t.name === 'searchCode');

        expect(editIndex).toBeLessThan(searchIndex);
    });

    test('should prioritize git tools in git repository', async () => {
        // Add a mock git tool
        toolsService.tools.push({
            name: 'gitStatus',
            description: 'Git status',
            tags: ['git'],
            inputSchema: {}
        });

        const context: IntentContext = {
            workspace: { rootPath: '/test', files: [], gitRepository: true }
        };

        const intent = new AgentIntentInvocation(toolsService, request, context);
        const tools = await intent.getAvailableTools();

        const gitIndex = tools.findIndex(t => t.name === 'gitStatus');
        const editIndex = tools.findIndex(t => t.name === 'editFile');

        expect(gitIndex).toBeLessThan(editIndex);
    });
});

describe('EditorIntentInvocation', () => {
    let toolsService: MockToolsService;
    let request: CliRequest;

    beforeEach(() => {
        toolsService = new MockToolsService();
        request = { query: 'edit this file' };
    });

    test('should only allow file and code tools', async () => {
        const intent = new EditorIntentInvocation(toolsService, request);
        const tools = await intent.getAvailableTools();

        const allowedNames = ['editFile', 'readFile', 'search'];
        expect(tools.every(t => allowedNames.includes(t.name))).toBe(true);
    });

    test('should filter to editing-related tools', async () => {
        const intent = new EditorIntentInvocation(toolsService, request);
        const tools = await intent.getAvailableTools();

        expect(tools.map(t => t.name)).toContain('editFile');
        expect(tools.map(t => t.name)).toContain('readFile');
        expect(tools.map(t => t.name)).not.toContain('debugAnalyze');
    });
});

describe('SearchIntentInvocation', () => {
    let toolsService: MockToolsService;
    let request: CliRequest;

    beforeEach(() => {
        toolsService = new MockToolsService();
        request = { query: 'find all references' };
    });

    test('should only allow search tools', async () => {
        const intent = new SearchIntentInvocation(toolsService, request);
        const tools = await intent.getAvailableTools();

        expect(tools.every(t => 
            t.name.includes('search') || 
            t.name.includes('grep') || 
            t.name.includes('find') ||
            t.tags?.includes('search')
        )).toBe(true);
    });

    test('should not enable healing', () => {
        const intent = new SearchIntentInvocation(toolsService, request);
        expect(intent.config.enableHealing).toBe(false);
    });
});

describe('DebugIntentInvocation', () => {
    let toolsService: MockToolsService;
    let request: CliRequest;

    beforeEach(() => {
        toolsService = new MockToolsService();
        request = { query: 'debug this issue' };
    });

    test('should allow debug and analysis tools', async () => {
        const intent = new DebugIntentInvocation(toolsService, request);
        const tools = await intent.getAvailableTools();

        expect(tools.map(t => t.name)).toContain('debugAnalyze');
        expect(tools.every(t => 
            t.tags?.includes('debug') || 
            t.tags?.includes('analysis') ||
            t.name.includes('test') ||
            t.name.includes('analyze')
        )).toBe(true);
    });

    test('should enable healing', () => {
        const intent = new DebugIntentInvocation(toolsService, request);
        expect(intent.config.enableHealing).toBe(true);
    });
});

describe('IntentFactory', () => {
    let toolsService: MockToolsService;
    let request: CliRequest;

    beforeEach(() => {
        toolsService = new MockToolsService();
        request = { query: 'test query' };
    });

    test('should create Agent intent', () => {
        const intent = IntentFactory.createIntent(IntentType.Agent, toolsService, request);
        
        expect(intent).toBeInstanceOf(AgentIntentInvocation);
        expect(intent.type).toBe(IntentType.Agent);
    });

    test('should create Editor intent', () => {
        const intent = IntentFactory.createIntent(IntentType.Editor, toolsService, request);
        
        expect(intent).toBeInstanceOf(EditorIntentInvocation);
        expect(intent.type).toBe(IntentType.Editor);
    });

    test('should create Search intent', () => {
        const intent = IntentFactory.createIntent(IntentType.Search, toolsService, request);
        
        expect(intent).toBeInstanceOf(SearchIntentInvocation);
        expect(intent.type).toBe(IntentType.Search);
    });

    test('should create Debug intent', () => {
        const intent = IntentFactory.createIntent(IntentType.Debug, toolsService, request);
        
        expect(intent).toBeInstanceOf(DebugIntentInvocation);
        expect(intent.type).toBe(IntentType.Debug);
    });

    test('should create generic intent for unknown types', () => {
        const intent = IntentFactory.createIntent(IntentType.Git, toolsService, request);
        
        expect(intent.type).toBe(IntentType.Git);
        expect(intent).toBeInstanceOf(BaseIntentInvocation);
    });

    describe('Intent Detection', () => {
        test('should detect edit intent', () => {
            const queries = [
                'edit this file',
                'change the function',
                'modify the component',
                'update the code'
            ];

            queries.forEach(query => {
                const intent = IntentFactory.detectIntent(query, toolsService, { query });
                expect(intent.type).toBe(IntentType.Editor);
            });
        });

        test('should detect search intent', () => {
            const queries = [
                'search for references',
                'find all usages',
                'grep for pattern',
                'look for implementations'
            ];

            queries.forEach(query => {
                const intent = IntentFactory.detectIntent(query, toolsService, { query });
                expect(intent.type).toBe(IntentType.Search);
            });
        });

        test('should detect debug intent', () => {
            const queries = [
                'debug this error',
                'test the function',
                'analyze the performance',
                'check for issues'
            ];

            queries.forEach(query => {
                const intent = IntentFactory.detectIntent(query, toolsService, { query });
                expect(intent.type).toBe(IntentType.Debug);
            });
        });

        test('should default to agent intent', () => {
            const query = 'help me with this project';
            const intent = IntentFactory.detectIntent(query, toolsService, { query });
            
            expect(intent.type).toBe(IntentType.Agent);
        });
    });

    test('should create custom intent', () => {
        const config: IntentConfig = {
            type: IntentType.File,
            allowedTools: ['readFile', 'writeFile'],
            maxTools: 5
        };

        const intent = IntentFactory.createCustomIntent(config, toolsService, request);

        expect(intent.type).toBe(IntentType.File);
        expect(intent.config.allowedTools).toEqual(['readFile', 'writeFile']);
        expect(intent.config.maxTools).toBe(5);
    });
});

describe('IntentContextManager', () => {
    beforeEach(() => {
        // Clear any existing contexts
        IntentContextManager['contexts'].clear();
    });

    test('should save and retrieve context', () => {
        const sessionId = 'test-session';
        const context: IntentContext = {
            workspace: { rootPath: '/test', files: ['file1.ts'] },
            userPreferences: { safeMode: true }
        };

        IntentContextManager.saveContext(sessionId, context);
        const retrieved = IntentContextManager.getContext(sessionId);

        expect(retrieved).toEqual(context);
    });

    test('should update existing context', () => {
        const sessionId = 'test-session';
        const initialContext: IntentContext = {
            workspace: { rootPath: '/test', files: [] }
        };

        IntentContextManager.saveContext(sessionId, initialContext);
        IntentContextManager.updateContext(sessionId, {
            userPreferences: { safeMode: true }
        });

        const updated = IntentContextManager.getContext(sessionId);
        expect(updated?.userPreferences?.safeMode).toBe(true);
        expect(updated?.workspace?.rootPath).toBe('/test');
    });

    test('should create context from request', () => {
        const request: CliRequest = {
            query: 'test',
            context: { workingDirectory: '/project', files: ['file1.ts'] },
            options: { verbose: true, dryRun: true }
        };

        const context = IntentContextManager.createFromRequest(request);

        expect(context.workspace?.rootPath).toBe('/project');
        expect(context.userPreferences?.verboseMode).toBe(true);
        expect(context.userPreferences?.safeMode).toBe(true);
        expect(context.sessionData?.previousTools).toEqual([]);
    });

    test('should handle missing session', () => {
        const context = IntentContextManager.getContext('non-existent');
        expect(context).toBeUndefined();
    });

    test('should handle update of non-existent session', () => {
        IntentContextManager.updateContext('non-existent', {
            userPreferences: { safeMode: true }
        });

        const context = IntentContextManager.getContext('non-existent');
        expect(context?.userPreferences?.safeMode).toBe(true);
    });
});

describe('Integration Tests', () => {
    let toolsService: MockToolsService;

    beforeEach(() => {
        toolsService = new MockToolsService();
    });

    test('should handle complete intent workflow', async () => {
        // Create request and context
        const request: CliRequest = {
            query: 'edit the main function in app.ts',
            context: { workingDirectory: '/project' }
        };

        const context = IntentContextManager.createFromRequest(request);
        context.currentFile = { path: '/project/app.ts' };

        // Detect intent
        const intent = IntentFactory.detectIntent(request.query, toolsService, request, context);
        expect(intent.type).toBe(IntentType.Editor);

        // Get available tools
        const tools = await intent.getAvailableTools();
        expect(tools.length).toBeGreaterThan(0);
        expect(tools.every(t => 
            t.name.includes('edit') || 
            t.name.includes('read') || 
            t.name.includes('search')
        )).toBe(true);

        // Validate tool usage
        expect(intent.canUseTool('editFile')).toBe(true);
        expect(intent.canUseTool('debugAnalyze')).toBe(false);
    });

    test('should handle different intent types appropriately', async () => {
        const scenarios = [
            {
                query: 'search for all TODO comments',
                expectedType: IntentType.Search,
                shouldContain: 'searchCode',
                shouldNotContain: 'editFile'
            },
            {
                query: 'debug the performance issue',
                expectedType: IntentType.Debug,
                shouldContain: 'debugAnalyze',
                shouldNotContain: 'searchCode'
            },
            {
                query: 'help me understand this codebase',
                expectedType: IntentType.Agent,
                shouldContain: 'editFile',
                shouldContain2: 'searchCode'
            }
        ];

        for (const scenario of scenarios) {
            const intent = IntentFactory.detectIntent(
                scenario.query, 
                toolsService, 
                { query: scenario.query }
            );

            expect(intent.type).toBe(scenario.expectedType);

            const tools = await intent.getAvailableTools();
            if (scenario.shouldContain) {
                expect(tools.map(t => t.name)).toContain(scenario.shouldContain);
            }
            if (scenario.shouldNotContain) {
                expect(tools.map(t => t.name)).not.toContain(scenario.shouldNotContain);
            }
        }
    });
});