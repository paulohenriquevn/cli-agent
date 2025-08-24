# CLI Agent - API Reference

Complete API documentation for all components and interfaces.

## Table of Contents

- [CLI Agent SDK](#cli-agent-sdk)
- [Tool Registry](#tool-registry)
- [Base Tool](#base-tool)
- [Types and Interfaces](#types-and-interfaces)
- [Utilities](#utilities)
- [Configuration](#configuration)

---

## CLI Agent SDK

### CliAgentSDK Class

The main SDK class for programmatic integration.

#### Constructor

```typescript
constructor(config: Partial<SDKConfig> = {})
```

Creates a new SDK instance with the provided configuration.

**Parameters:**
- `config` - Partial SDK configuration (see [SDKConfig](#sdkconfig))

**Example:**
```typescript
const sdk = new CliAgentSDK({
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    enableHealing: true,
    workingDirectory: '/project/workspace'
});
```

#### Methods

##### initialize()

```typescript
async initialize(): Promise<void>
```

Initializes the SDK and all subsystems. Must be called before using the SDK.

**Throws:**
- `Error` - If initialization fails

**Example:**
```typescript
await sdk.initialize();
```

##### executeTool()

```typescript
async executeTool(
    toolName: string,
    parameters: any,
    context?: Partial<SDKExecutionContext>
): Promise<ToolExecutionResult>
```

Executes a single tool with the provided parameters.

**Parameters:**
- `toolName` - Name of the tool to execute
- `parameters` - Tool-specific parameters
- `context` - Optional execution context override

**Returns:**
- `Promise<ToolExecutionResult>` - Execution result with metadata

**Example:**
```typescript
const result = await sdk.executeTool('readFile', {
    filePath: './package.json'
});

if (result.success) {
    console.log('File content:', result.output);
} else {
    console.error('Error:', result.error);
}
```

##### executeBatch()

```typescript
async executeBatch(request: BatchExecutionRequest): Promise<BatchExecutionResult>
```

Executes multiple tools with dependency management.

**Parameters:**
- `request` - Batch execution configuration

**Returns:**
- `Promise<BatchExecutionResult>` - Aggregated results from all operations

**Example:**
```typescript
const batchResult = await sdk.executeBatch({
    operations: [
        {
            id: 'read-config',
            toolName: 'readFile',
            parameters: { filePath: 'config.json' }
        },
        {
            id: 'process-config',
            toolName: 'task',
            parameters: {
                description: 'Process configuration',
                prompt: 'Validate the configuration file',
                subagent_type: 'validator'
            },
            dependsOn: ['read-config']
        }
    ],
    options: {
        parallel: false,
        stopOnError: true
    }
});
```

##### listTools()

```typescript
listTools(): SDKToolInfo[]
```

Returns information about all available tools.

**Returns:**
- `SDKToolInfo[]` - Array of tool information objects

**Example:**
```typescript
const tools = sdk.listTools();
console.log(`Available tools: ${tools.length}`);

tools.forEach(tool => {
    console.log(`- ${tool.name}: ${tool.description}`);
});
```

##### getToolInfo()

```typescript
getToolInfo(toolName: string): SDKToolInfo | null
```

Gets detailed information about a specific tool.

**Parameters:**
- `toolName` - Name of the tool

**Returns:**
- `SDKToolInfo | null` - Tool information or null if not found

**Example:**
```typescript
const toolInfo = sdk.getToolInfo('readFile');
if (toolInfo) {
    console.log(`Tool: ${toolInfo.name}`);
    console.log(`Description: ${toolInfo.description}`);
    console.log(`Parameters: ${toolInfo.parameters.length}`);
}
```

##### getStats()

```typescript
getStats(): SDKStats
```

Returns SDK usage statistics and metrics.

**Returns:**
- `SDKStats` - Statistics object with execution metrics

**Example:**
```typescript
const stats = sdk.getStats();
console.log(`Total executions: ${stats.executionStats.totalExecutions}`);
console.log(`Success rate: ${(stats.executionStats.successfulExecutions / stats.executionStats.totalExecutions * 100).toFixed(1)}%`);
```

##### installPlugin()

```typescript
async installPlugin(plugin: SDKPlugin): Promise<void>
```

Installs a plugin to extend SDK functionality.

**Parameters:**
- `plugin` - Plugin implementation

**Throws:**
- `Error` - If plugin with same name already exists

**Example:**
```typescript
const customPlugin: SDKPlugin = {
    name: 'logger',
    version: '1.0.0',
    description: 'Custom logging plugin',
    
    initialize: async (sdk) => {
        console.log('Logger plugin initialized');
    },
    
    beforeToolExecution: async (toolName, parameters) => {
        console.log(`Executing: ${toolName}`);
        return parameters;
    }
};

await sdk.installPlugin(customPlugin);
```

##### uninstallPlugin()

```typescript
async uninstallPlugin(pluginName: string): Promise<void>
```

Uninstalls a previously installed plugin.

**Parameters:**
- `pluginName` - Name of the plugin to uninstall

**Throws:**
- `Error` - If plugin is not installed

##### dispose()

```typescript
async dispose(): Promise<void>
```

Cleans up and disposes of all SDK resources. Should be called when done using the SDK.

**Example:**
```typescript
try {
    // Use SDK...
} finally {
    await sdk.dispose();
}
```

#### Events

The SDK extends `EventEmitter` and emits the following events:

##### tool.execution.start

Emitted when tool execution begins.

```typescript
sdk.on('tool.execution.start', (data: {
    toolName: string;
    parameters: any;
    context: SDKExecutionContext;
}) => {
    console.log(`Starting tool: ${data.toolName}`);
});
```

##### tool.execution.complete

Emitted when tool execution completes successfully.

```typescript
sdk.on('tool.execution.complete', (result: ToolExecutionResult) => {
    console.log(`Tool completed: ${result.toolInfo.name} (${result.executionTime}ms)`);
});
```

##### tool.execution.error

Emitted when tool execution fails.

```typescript
sdk.on('tool.execution.error', (error: {
    toolName: string;
    error: string;
    parameters: any;
    context: SDKExecutionContext;
}) => {
    console.error(`Tool failed: ${error.toolName} - ${error.error}`);
});
```

##### sdk.initialized

Emitted when SDK initialization is complete.

```typescript
sdk.on('sdk.initialized', (data: {
    config: SDKConfig;
    toolsLoaded: number;
}) => {
    console.log(`SDK initialized with ${data.toolsLoaded} tools`);
});
```

##### sdk.error

Emitted when SDK-level errors occur.

```typescript
sdk.on('sdk.error', (error: {
    message: string;
    stack?: string;
    context?: any;
}) => {
    console.error('SDK Error:', error.message);
});
```

---

## Tool Registry

### ToolRegistry Object

Singleton object that manages tool registration and discovery.

#### Methods

##### registerTool()

```typescript
registerTool(ToolCtor: BaseToolCtor): void
```

Registers a tool class for use in the system.

**Parameters:**
- `ToolCtor` - Tool constructor class

**Example:**
```typescript
export class MyTool extends BaseTool<IMyToolParams> {
    // Implementation...
}

ToolRegistry.registerTool(MyTool);
```

##### getTools()

```typescript
getTools(): readonly BaseTool[]
```

Returns all registered tools.

##### getTool()

```typescript
getTool(name: string): BaseTool | undefined
```

Gets a specific tool by name.

##### executeTool()

```typescript
async executeTool<T extends IToolParams = IToolParams>(
    toolName: string,
    input: T,
    context?: CliExecutionContext,
    cancellationToken?: CliCancellationToken
): Promise<CliToolResult>
```

Executes a tool directly through the registry.

##### getStats()

```typescript
getStats(): {
    totalTools: number;
    categoriesCount: number;
    tagsCount: number;
    toolsByCategory: Record<string, number>;
    toolsByTag: Record<string, number>;
    toolsByComplexity: Record<string, number>;
}
```

Returns registry statistics.

---

## Base Tool

### BaseTool Abstract Class

Base class that all tools must extend.

```typescript
export abstract class BaseTool<T extends IToolParams> {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly inputSchema: any;
    
    readonly category: string = 'other';
    readonly tags: string[] = [];
    readonly complexity: 'core' | 'advanced' | 'essential' = 'core';
    
    abstract invoke(
        options: CliToolInvocationOptions<T>,
        token: CliCancellationToken
    ): Promise<CliToolResult>;
    
    // Helper methods
    protected createSuccessResult(data: any, output?: string): CliToolResult;
    protected createErrorResult(error: string): CliToolResult;
    protected validateWorkspace(): string | null;
}
```

#### Abstract Properties

##### name

```typescript
abstract readonly name: string;
```

Unique identifier for the tool. Used in CLI commands and SDK calls.

##### description

```typescript
abstract readonly description: string;
```

Human-readable description of what the tool does.

##### inputSchema

```typescript
abstract readonly inputSchema: any;
```

JSON Schema defining the tool's input parameters.

#### Optional Properties

##### category

```typescript
readonly category: string = 'other';
```

Tool category for organization. Common categories:
- `files` - File operations
- `system` - System commands
- `search` - Search and analysis
- `web` - Web operations
- `development` - Development tools
- `advanced` - Advanced features
- `integration` - Third-party integrations

##### tags

```typescript
readonly tags: string[] = [];
```

Tags for tool discovery and filtering.

##### complexity

```typescript
readonly complexity: 'core' | 'advanced' | 'essential' = 'core';
```

Complexity level:
- `essential` - Basic, frequently used tools
- `core` - Standard tools for common tasks
- `advanced` - Specialized or complex tools

#### Abstract Methods

##### invoke()

```typescript
abstract invoke(
    options: CliToolInvocationOptions<T>,
    token: CliCancellationToken
): Promise<CliToolResult>
```

Main tool execution method. Must be implemented by all tools.

**Parameters:**
- `options` - Execution options with input parameters and context
- `token` - Cancellation token for operation control

**Returns:**
- `Promise<CliToolResult>` - Execution result

#### Helper Methods

##### createSuccessResult()

```typescript
protected createSuccessResult(data: any, output?: string): CliToolResult
```

Creates a successful result object.

##### createErrorResult()

```typescript
protected createErrorResult(error: string): CliToolResult
```

Creates an error result object.

##### validateWorkspace()

```typescript
protected validateWorkspace(): string | null
```

Validates the current workspace. Returns error message or null if valid.

---

## Types and Interfaces

### SDKConfig

Configuration interface for the CLI Agent SDK.

```typescript
interface SDKConfig {
    // LLM Configuration
    openRouterApiKey?: string;
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
    
    // Tool Configuration
    enableHealing?: boolean;
    enableNormalization?: boolean;
    healingTimeout?: number;
    toolCallLimit?: number;
    
    // Execution Context
    workingDirectory?: string;
    sessionId?: string;
    environment?: Record<string, string>;
    
    // Logging
    enableLogging?: boolean;
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    customLogger?: (level: string, message: string, data?: any) => void;
    
    // Advanced
    customTools?: CustomToolDefinition[];
    pluginPaths?: string[];
    cacheEnabled?: boolean;
}
```

### ToolExecutionResult

Result of tool execution with comprehensive metadata.

```typescript
interface ToolExecutionResult {
    success: boolean;
    data?: any;
    output?: string;
    error?: string;
    executionTime: number;
    metadata: {
        toolName: string;
        healingApplied: boolean;
        normalizationApplied: boolean;
        retryCount: number;
    };
    toolInfo: SDKToolInfo;
    context: SDKExecutionContext;
    logs?: Array<{
        level: string;
        message: string;
        timestamp: number;
        data?: any;
    }>;
}
```

### BatchExecutionRequest

Configuration for batch tool execution.

```typescript
interface BatchExecutionRequest {
    operations: Array<{
        toolName: string;
        parameters: any;
        id?: string;
        dependsOn?: string[];
    }>;
    options?: {
        parallel?: boolean;
        stopOnError?: boolean;
        timeout?: number;
    };
}
```

### BatchExecutionResult

Result of batch tool execution.

```typescript
interface BatchExecutionResult {
    success: boolean;
    results: Record<string, SDKToolResult>;
    errors: Record<string, string>;
    executionOrder: string[];
    totalExecutionTime: number;
    metadata: {
        totalOperations: number;
        successfulOperations: number;
        failedOperations: number;
        parallelExecution: boolean;
    };
}
```

### SDKPlugin

Interface for SDK plugins.

```typescript
interface SDKPlugin {
    name: string;
    version: string;
    description: string;
    
    initialize(sdk: CliAgentSDK): Promise<void> | void;
    cleanup?(): Promise<void> | void;
    
    // Optional hooks
    beforeToolExecution?(toolName: string, parameters: any): Promise<any> | any;
    afterToolExecution?(result: ToolExecutionResult): Promise<ToolExecutionResult> | ToolExecutionResult;
    onError?(error: Error, context: any): Promise<void> | void;
}
```

### CustomToolDefinition

Definition for custom tools added via SDK configuration.

```typescript
interface CustomToolDefinition {
    name: string;
    description: string;
    category?: string;
    tags?: string[];
    complexity?: 'core' | 'advanced' | 'essential';
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    execute: (params: any, context: SDKExecutionContext) => Promise<any>;
}
```

### CliToolResult

Core result interface for tool execution.

```typescript
interface CliToolResult {
    isSuccess: boolean;
    output?: string;
    data?: any;
    error?: string;
    hasErrors(): boolean;
    getText(): string;
    getErrors(): string[];
}
```

### CliExecutionContext

Execution context for tool operations.

```typescript
interface CliExecutionContext {
    workingDirectory?: string;
    sessionId?: string;
    environment?: Record<string, string>;
    user?: any;
}
```

### CliCancellationToken

Token for cancelling long-running operations.

```typescript
interface CliCancellationToken {
    isCancellationRequested: boolean;
    cancel(): void;
}
```

---

## Utilities

### SDK Utils

Collection of utility functions for SDK operations.

#### createDefaultSDKConfig()

```typescript
function createDefaultSDKConfig(): SDKConfig
```

Creates a default SDK configuration with sensible defaults.

#### validateSDKConfig()

```typescript
function validateSDKConfig(config: SDKConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
```

Validates an SDK configuration and returns validation results.

#### createExecutionContext()

```typescript
function createExecutionContext(
    partial?: Partial<SDKExecutionContext>,
    config?: SDKConfig
): SDKExecutionContext
```

Creates an execution context from partial context and configuration.

#### parseToolInput()

```typescript
function parseToolInput(input: string | { tool: string; params: any }): {
    toolName: string;
    parameters: any;
}
```

Parses tool input from various formats (command-line style or object).

#### retryWithBackoff()

```typescript
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 10000
): Promise<T>
```

Executes a function with exponential backoff retry logic.

---

## Configuration

### Default Values

Default configuration values used when not specified:

```typescript
const DEFAULT_CONFIG = {
    defaultModel: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 4000,
    enableHealing: true,
    enableNormalization: true,
    healingTimeout: 30000,
    toolCallLimit: 10,
    workingDirectory: process.cwd(),
    enableLogging: true,
    logLevel: 'info',
    cacheEnabled: true
};
```

### Environment Variables

Environment variables that affect SDK behavior:

- `OPENROUTER_API_KEY` - OpenRouter API key for LLM services
- `CLI_AGENT_LOG_LEVEL` - Override default log level
- `CLI_AGENT_WORKING_DIR` - Default working directory
- `CLI_AGENT_TIMEOUT` - Default operation timeout

### Model Support

Supported LLM models:

- **OpenAI**: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`
- **Anthropic**: `claude-3-sonnet`, `claude-3-opus`, `claude-3-haiku`
- **Google**: `gemini-pro`, `gemini-pro-vision`
- **DeepSeek**: `deepseek-coder`, `deepseek-chat`

---

This API reference provides comprehensive documentation for all public interfaces and methods in the CLI Agent system. For usage examples, see the [examples](../samples/) directory.