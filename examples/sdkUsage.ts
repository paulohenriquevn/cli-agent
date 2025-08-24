/*---------------------------------------------------------------------------------------------
 * SDK Usage Examples - How to integrate CLI Agent SDK into other systems
 *--------------------------------------------------------------------------------------------*/

import { CliAgentSDK, SDKConfig, SDKPlugin } from '../src/sdk';

// Example 1: Basic usage
async function basicExample() {
    console.log('=== Basic SDK Usage ===');
    
    const sdk = new CliAgentSDK({
        openRouterApiKey: process.env.OPENROUTER_API_KEY,
        enableLogging: true,
        workingDirectory: process.cwd()
    });

    await sdk.initialize();

    // List all available tools
    const tools = sdk.listTools();
    console.log(`Available tools: ${tools.map(t => t.name).join(', ')}`);

    // Execute a simple tool
    const result = await sdk.executeTool('readFile', {
        filePath: 'package.json'
    });

    if (result.success) {
        console.log('File read successfully:', result.output?.substring(0, 100) + '...');
    } else {
        console.error('Failed to read file:', result.error);
    }

    await sdk.dispose();
}

// Example 2: Web application integration
class WebAppService {
    private sdk: CliAgentSDK;

    constructor() {
        this.sdk = new CliAgentSDK({
            openRouterApiKey: process.env.OPENROUTER_API_KEY,
            enableHealing: true,
            enableNormalization: true,
            workingDirectory: '/app/workspace',
            customLogger: (level, message, data) => {
                console.log(`[${level}] ${message}`, data);
            }
        });
    }

    async init() {
        await this.sdk.initialize();
        
        // Set up event listeners
        this.sdk.on('tool.execution.start', (data) => {
            console.log(`Starting tool: ${data.toolName}`);
        });

        this.sdk.on('tool.execution.complete', (result) => {
            console.log(`Tool completed: ${result.toolInfo.name} (${result.executionTime}ms)`);
        });

        this.sdk.on('tool.execution.error', (error) => {
            console.error(`Tool failed: ${error.toolName} - ${error.error}`);
        });
    }

    async analyzeCodebase(projectPath: string) {
        console.log('=== Web App Integration ===');
        
        const results = await this.sdk.executeBatch({
            operations: [
                {
                    id: 'list-files',
                    toolName: 'listDirectory',
                    parameters: { path: projectPath }
                },
                {
                    id: 'find-js-files',
                    toolName: 'glob',
                    parameters: { pattern: '**/*.js', path: projectPath }
                },
                {
                    id: 'search-todos',
                    toolName: 'grep',
                    parameters: { pattern: 'TODO|FIXME', path: projectPath }
                }
            ],
            options: {
                parallel: true,
                stopOnError: false
            }
        });

        return {
            success: results.success,
            files: results.results['list-files']?.data || [],
            jsFiles: results.results['find-js-files']?.data || [],
            todos: results.results['search-todos']?.data || []
        };
    }

    async cleanup() {
        await this.sdk.dispose();
    }
}

// Example 3: Custom tool registration
async function customToolExample() {
    console.log('=== Custom Tool Example ===');
    
    const sdk = new CliAgentSDK({
        customTools: [
            {
                name: 'calculateSum',
                description: 'Calculate sum of two numbers',
                category: 'math',
                tags: ['calculation', 'utility'],
                complexity: 'core',
                inputSchema: {
                    type: 'object',
                    properties: {
                        a: { type: 'number', description: 'First number' },
                        b: { type: 'number', description: 'Second number' }
                    },
                    required: ['a', 'b']
                },
                execute: async (params) => {
                    return {
                        sum: params.a + params.b,
                        operation: `${params.a} + ${params.b} = ${params.a + params.b}`
                    };
                }
            }
        ]
    });

    await sdk.initialize();

    const result = await sdk.executeTool('calculateSum', { a: 10, b: 20 });
    console.log('Calculation result:', result.data);

    await sdk.dispose();
}

// Example 4: Plugin system
const loggingPlugin: SDKPlugin = {
    name: 'enhanced-logging',
    version: '1.0.0',
    description: 'Enhanced logging plugin',

    initialize: async (sdk) => {
        console.log('Logging plugin initialized');
    },

    beforeToolExecution: async (toolName, parameters) => {
        console.log(`🔧 Executing ${toolName} with params:`, parameters);
        return parameters;
    },

    afterToolExecution: async (result) => {
        console.log(`✅ Tool ${result.toolInfo.name} completed in ${result.executionTime}ms`);
        return result;
    },

    onError: async (error, context) => {
        console.error(`❌ Error in ${context.toolName}:`, error.message);
    }
};

async function pluginExample() {
    console.log('=== Plugin Example ===');
    
    const sdk = new CliAgentSDK({
        enableLogging: true
    });

    await sdk.initialize();
    await sdk.installPlugin(loggingPlugin);

    // Now all tool executions will use the plugin
    await sdk.executeTool('listDirectory', { path: '.' });

    await sdk.uninstallPlugin('enhanced-logging');
    await sdk.dispose();
}

// Example 5: Enterprise integration with authentication
class EnterpriseService {
    private sdk: CliAgentSDK;
    private userContext: any;

    constructor(userContext: any) {
        this.userContext = userContext;
        this.sdk = new CliAgentSDK({
            openRouterApiKey: process.env.OPENROUTER_API_KEY,
            workingDirectory: `/workspaces/${userContext.organizationId}`,
            sessionId: `enterprise-${userContext.userId}-${Date.now()}`,
            enableHealing: true,
            customLogger: this.createAuditLogger()
        });
    }

    private createAuditLogger() {
        return (level: string, message: string, data?: any) => {
            const auditLog = {
                timestamp: new Date().toISOString(),
                userId: this.userContext.userId,
                organizationId: this.userContext.organizationId,
                level,
                message,
                data: data ? JSON.stringify(data) : undefined
            };
            
            // Send to audit system
            console.log('[AUDIT]', auditLog);
        };
    }

    async executeSecureOperation(operation: string, params: any) {
        console.log('=== Enterprise Integration ===');
        
        // Add security context
        const secureContext = {
            userId: this.userContext.userId,
            organizationId: this.userContext.organizationId,
            permissions: this.userContext.permissions
        };

        await this.sdk.initialize();

        const result = await this.sdk.executeTool(operation, params, secureContext);
        
        // Log result for compliance
        console.log(`Operation ${operation} completed for user ${this.userContext.userId}`);
        
        return result;
    }
}

// Example 6: Batch processing system
async function batchProcessingExample() {
    console.log('=== Batch Processing Example ===');
    
    const sdk = new CliAgentSDK({
        toolCallLimit: 50, // Higher limit for batch operations
        enableLogging: true
    });

    await sdk.initialize();

    // Process multiple files in parallel
    const filesToProcess = ['file1.txt', 'file2.txt', 'file3.txt'];
    
    const batchResult = await sdk.executeBatch({
        operations: filesToProcess.map(file => ({
            id: `process-${file}`,
            toolName: 'readFile',
            parameters: { filePath: file }
        })),
        options: {
            parallel: true,
            stopOnError: false,
            timeout: 30000
        }
    });

    console.log(`Batch processing: ${batchResult.metadata.successfulOperations}/${batchResult.metadata.totalOperations} successful`);

    // Process results
    for (const [id, result] of Object.entries(batchResult.results)) {
        if (result.success) {
            console.log(`✅ ${id}: ${result.output?.length} characters`);
        }
    }

    // Handle errors
    for (const [id, error] of Object.entries(batchResult.errors)) {
        console.error(`❌ ${id}: ${error}`);
    }

    await sdk.dispose();
}

// Run examples
async function runAllExamples() {
    try {
        await basicExample();
        console.log('\n');
        
        await customToolExample();
        console.log('\n');
        
        await pluginExample();
        console.log('\n');
        
        await batchProcessingExample();
        console.log('\n');

        // Web app example
        const webApp = new WebAppService();
        await webApp.init();
        const analysis = await webApp.analyzeCodebase('.');
        console.log('Codebase analysis:', analysis);
        await webApp.cleanup();
        console.log('\n');

        // Enterprise example
        const userContext = {
            userId: 'user123',
            organizationId: 'org456',
            permissions: ['read', 'execute']
        };
        const enterprise = new EnterpriseService(userContext);
        await enterprise.executeSecureOperation('listDirectory', { path: '.' });

    } catch (error) {
        console.error('Example failed:', error);
    }
}

// Export for use in other files
export {
    WebAppService,
    EnterpriseService,
    loggingPlugin
};

// Run examples if this file is executed directly
if (require.main === module) {
    runAllExamples().catch(console.error);
}