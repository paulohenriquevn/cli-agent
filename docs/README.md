# CLI Agent - Complete Documentation

**Autonomous CLI Agent System with LLM Integration and Tool Healing**

## 📖 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [CLI Usage](#cli-usage)
- [SDK Integration](#sdk-integration)
- [Tools Reference](#tools-reference)
- [Advanced Features](#advanced-features)
- [Development Guide](#development-guide)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

The CLI Agent is a comprehensive system that provides:

- **30 Built-in Tools** for file operations, system commands, web operations, and AI tasks (96.7% functional)
- **LLM-Friendly CLI** for direct tool execution without conversational overhead
- **Complete SDK** for programmatic integration into other systems
- **Automatic Healing** system that fixes failed tool parameters using AI
- **Multi-Model Normalization** for compatibility across different LLMs
- **Batch Processing** with dependency management and parallel execution
- **Plugin System** for extensibility
- **Enterprise-Ready** features including monitoring, logging, and security

### Key Features

✅ **Direct Tool Execution** - Execute any tool with `cli-agent toolName --param=value`  
✅ **Healing System** - Automatic parameter correction when tools fail  
✅ **SDK Integration** - Programmatic access for applications  
✅ **Batch Operations** - Execute multiple tools with dependencies  
✅ **Plugin Architecture** - Extend functionality with custom plugins  
✅ **Enterprise Security** - Audit logging, user context, permissions  
✅ **Performance Monitoring** - Real-time metrics and statistics  
✅ **Multi-Model Support** - Works with GPT-4, Claude, Gemini, etc.  

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Agent System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐     │
│  │ CLI Layer   │    │ SDK Layer   │    │ Web/API Layer   │     │
│  │ (Direct)    │    │ (Program.)  │    │ (Integration)   │     │
│  └─────────────┘    └─────────────┘    └─────────────────┘     │
│         │                   │                     │            │
│         └───────────────────┼─────────────────────┘            │
│                             │                                  │
│  ┌──────────────────────────┼──────────────────────────────┐   │
│  │              Core Engine │                              │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │            Tool Registry                        │   │   │
│  │  │     • 30+ Built-in Tools                       │   │   │
│  │  │     • Dynamic Registration                     │   │   │
│  │  │     • Category Organization                    │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                             │                           │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │         Tool Execution Engine                   │   │   │
│  │  │     • Parameter Validation                      │   │   │
│  │  │     • Cancellation Support                     │   │   │
│  │  │     • Result Processing                        │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                             │                           │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │            Healing System                       │   │   │
│  │  │     • NoMatchError Detection                    │   │   │
│  │  │     • LLM-based Correction                     │   │   │
│  │  │     • Multiple Strategies                      │   │   │
│  │  │     • Transparent Re-execution                 │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                             │                           │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │       Normalization System                      │   │   │
│  │  │     • Multi-Model Support                      │   │   │
│  │  │     • Schema Transformation                    │   │   │
│  │  │     • Cache Optimization                       │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │          Advanced Features                      │   │   │
│  │  │                                                 │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐ ┌──────────┐ │   │   │
│  │  │  │ Batch Proc. │  │Plugin System│ │Monitoring│ │   │   │
│  │  │  │• Parallel   │  │• Extensible │ │• Metrics │ │   │   │
│  │  │  │• Sequential │  │• Lifecycle  │ │• Events  │ │   │   │
│  │  │  │• Dependencies│  │• Hooks     │ │• Logging │ │   │   │
│  │  │  └─────────────┘  └─────────────┘ └──────────┘ │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Input**: CLI command or SDK call with tool name and parameters
2. **Registry**: Look up tool in ToolRegistry 
3. **Normalization**: Adapt parameters for target model (if needed)
4. **Execution**: Execute tool with validated parameters
5. **Healing**: If execution fails with NoMatchError, apply healing
6. **Result**: Return processed result with metadata

---

## Getting Started

### Prerequisites

- Node.js 18+ 
- OpenRouter API key (for healing and AI features)
- TypeScript 5.0+ (for development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd cli-agent

# Install dependencies
npm install

# Build the project  
npm run build

# Configure environment
export OPENROUTER_API_KEY="your-openrouter-api-key"
```

### Quick Test

```bash
# List all available tools
npm start list-tools

# Test basic file operations
npm start read_file --filePath="package.json"

# Test with healing (intentionally use escaped string)
npm start edit_file --filePath="test.txt" --oldText="line\\nwith\\nescapes" --newText="corrected line"
```

---

## CLI Usage

### Basic Command Structure

```bash
cli-agent <toolName> [options]
cli-agent <command> [options]
```

### Essential Commands

```bash
# List all available tools
cli-agent list-tools

# Get detailed info about a tool
cli-agent tool-info <toolName>

# Show system status
cli-agent status

# Execute any tool directly
cli-agent <toolName> --param1="value1" --param2="value2"
```

### File Operations Examples

```bash
# Read a file
cli-agent read_file --filePath="src/app.js"

# Write content to file  
cli-agent write_file --filePath="output.txt" --content="Hello World"

# Edit file with healing
cli-agent edit_file --filePath="src/app.js" \
  --oldText="var apiUrl = 'localhost'" \
  --newText="const apiUrl = process.env.API_URL"

# Multiple edits in one operation
cli-agent multi_edit --file_path="src/app.js" --edits='[
  {"old_string": "var x = 1", "new_string": "const x = 1"},
  {"old_string": "var y = 2", "new_string": "const y = 2"}
]'

# List directory contents
cli-agent ls --path="src"
```

### Search Operations Examples

```bash
# Find files by pattern
cli-agent glob --pattern="**/*.ts" --path="src"

# Search for content in files
cli-agent grep --pattern="TODO|FIXME" --path="." --outputMode="content"

# Intelligent code search
cli-agent search_code --query="authentication" --path="src" --fileTypes='["js","ts"]'
```

### System Operations Examples

```bash
# Execute system commands
cli-agent execute_command --command="npm test"

# Run bash scripts (Linux/Mac)
cli-agent bash --command="echo 'Hello' && pwd && date"

# Advanced system operations
cli-agent computer_use --action="left_click" --coordinate="[100,100]"
```

### Web Operations Examples

```bash
# Search the web
cli-agent web_search --query="Node.js best practices 2024" \
  --blockedDomains='["example.com"]'

# Fetch web content
cli-agent web_fetch --url="https://api.github.com/repos/microsoft/vscode" \
  --method="GET"

# Get documentation
cli-agent fetch_documentation --url="https://nodejs.org/api/fs.html" \
  --format="markdown" --maxLength=1000
```

### AI-Powered Operations Examples

```bash
# Execute specialized AI tasks
cli-agent task --description="Code security audit" \
  --prompt="Analyze the codebase for security vulnerabilities" \
  --subagent_type="security-analyst"

# Manage project todos
cli-agent todo_write --todos='[
  {"content": "Implement authentication", "status": "pending", "activeForm": "Implementing authentication"},
  {"content": "Add tests", "status": "in_progress", "activeForm": "Adding tests"}
]'

# Create execution plan
cli-agent create_execution_plan --description="Refactor API endpoints" \
  --tasks='[
    {"content": "Update routes", "status": "pending", "priority": "high", "id": "1"},
    {"content": "Add validation", "status": "pending", "priority": "medium", "id": "2"}
  ]'
```

### Advanced Operations Examples

```bash
# Advanced file diffs
cli-agent advanced_diff --action="compare_files" --file_path_1="src/app.js" --file_path_2="src/app.backup.js" --diffType="unified"

# Apply patches
cli-agent advanced_patch --patch="..." --targetFile="src/app.js" --dryRun=true

# Notebook operations
cli-agent notebook_read --notebook_path="analysis.ipynb" --format="json"
cli-agent notebook_edit --notebook_path="analysis.ipynb" --edit_mode="replace" --cell_id="1" --new_source="print('hello')" --cell_type="code"

# Advanced system operations
cli-agent advanced_notebook --action="analyze" --notebook_path="analysis.ipynb" --operation="analyze"
```

### Batch Execution

```bash
# Execute with JSON parameters  
cli-agent execute readFile --params='{"filePath": "package.json"}'

# Load parameters from file
cli-agent execute readFile --file="params.json"

# Multiple tools in sequence (via SDK or scripting)
```

---

## SDK Integration

### Installation

```typescript
import { CliAgentSDK } from './src/sdk';
```

### Basic Usage

```typescript
import { CliAgentSDK } from 'cli-agent-sdk';

const sdk = new CliAgentSDK({
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    enableHealing: true,
    enableNormalization: true,
    workingDirectory: '/project/workspace'
});

await sdk.initialize();

// Execute single tool
const result = await sdk.executeTool('read_file', {
    filePath: 'package.json'
});

if (result.success) {
    console.log('Content:', result.output);
} else {
    console.error('Error:', result.error);
}

// Execute multiple tools in batch
const batchResult = await sdk.executeBatch({
    operations: [
        {
            id: 'read-config',
            toolName: 'read_file',
            parameters: { filePath: 'config.json' }
        },
        {
            id: 'list-files',
            toolName: 'glob',
            parameters: { pattern: '*.js', path: 'src' }
        }
    ],
    options: { parallel: true }
});
```

### Configuration Options

```typescript
interface SDKConfig {
    // LLM Configuration
    openRouterApiKey?: string;
    defaultModel?: string;           // 'gpt-4o-mini', 'claude-3-sonnet', etc.
    temperature?: number;            // 0.0 - 1.0
    maxTokens?: number;             // Max tokens per request
    
    // Tool Features
    enableHealing?: boolean;         // Auto-fix failed parameters
    enableNormalization?: boolean;   // Multi-model compatibility  
    healingTimeout?: number;         // Healing operation timeout
    toolCallLimit?: number;          // Max tool calls per operation
    
    // Execution Context
    workingDirectory?: string;       // Working directory for operations
    sessionId?: string;             // Unique session identifier
    environment?: Record<string, string>; // Environment variables
    
    // Logging & Monitoring
    enableLogging?: boolean;        // Enable logging
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    customLogger?: (level: string, message: string, data?: any) => void;
    
    // Extensions
    customTools?: CustomToolDefinition[];  // Your custom tools
    pluginPaths?: string[];                // Plugin loading paths
    cacheEnabled?: boolean;                // Enable caching
}
```

### Event System

```typescript
sdk.on('tool.execution.start', (data) => {
    console.log(`Starting tool: ${data.toolName}`);
});

sdk.on('tool.execution.complete', (result) => {
    console.log(`Tool completed: ${result.toolInfo.name} in ${result.executionTime}ms`);
});

sdk.on('healing.applied', (healing) => {
    console.log(`Healing applied: ${healing.strategy} (confidence: ${healing.confidence})`);
});

sdk.on('sdk.error', (error) => {
    console.error('SDK Error:', error.message);
});
```

### Custom Tools

```typescript
const customTool: CustomToolDefinition = {
    name: 'calculateMetrics',
    description: 'Calculate project metrics',
    category: 'analysis',
    tags: ['metrics', 'quality'],
    complexity: 'advanced',
    inputSchema: {
        type: 'object',
        properties: {
            projectPath: { type: 'string', description: 'Path to project' },
            metrics: { type: 'array', items: { type: 'string' }}
        },
        required: ['projectPath']
    },
    execute: async (params, context) => {
        // Your implementation
        return {
            linesOfCode: 1500,
            complexity: 'medium',
            coverage: '85%'
        };
    }
};

const sdk = new CliAgentSDK({
    customTools: [customTool]
});
```

### Plugin System

```typescript
const myPlugin: SDKPlugin = {
    name: 'custom-logger',
    version: '1.0.0',
    description: 'Custom logging plugin',
    
    initialize: async (sdk) => {
        console.log('Plugin initialized');
    },
    
    beforeToolExecution: async (toolName, parameters) => {
        console.log(`Executing ${toolName}:`, parameters);
        return parameters; // Can modify parameters
    },
    
    afterToolExecution: async (result) => {
        console.log(`Completed ${result.toolInfo.name}`);
        return result; // Can modify result
    }
};

await sdk.installPlugin(myPlugin);
```

---

## Tools Reference

### Categories

| Category | Tools | Status | Description |
|----------|-------|--------|-------------|
| **file_operations** | read_file, write_file, edit_file, multi_edit, ls | 5/5 ✅ | Core file operations |
| **file-operations** | advanced_patch, text_editor | 2/2 ✅ | Advanced file operations |
| **command-execution** | bash, execute_command | 2/2 ✅ | System commands |
| **search** | glob, grep | 2/2 ✅ | Pattern matching |
| **search-analysis** | search_code | 1/1 ✅ | Intelligent code search |
| **web** | web_search, web_fetch | 2/2 ✅ | Web operations |
| **web-documentation** | enhanced_web_search, fetch_documentation | 2/2 ✅ | Documentation fetching |
| **planning** | todo_write, exit_plan_mode | 2/2 ✅ | Planning tools |
| **delegation** | task | 1/1 ✅ | AI task delegation |
| **project-management** | create_execution_plan | 1/1 ✅ | Project management |
| **analysis** | advanced_diff | 1/1 ✅ | File analysis |
| **code-analysis** | symbol_analysis | 1/1 ✅ | Code analysis |
| **testing_quality** | test_analyzer | 1/1 ✅ | Test analysis |
| **integrations** | mcp_integration | 1/1 ✅ | MCP integration |
| **ai_assistance** | sub_agents | 1/1 ✅ | AI sub-agents |
| **system-customization** | hooks_management | 1/1 ✅ | Git hooks |
| **notebook-operations** | advanced_notebook, notebook_edit, notebook_read | 3/3 ✅ | Jupyter notebooks |
| **advanced-tools** | computer_use | 0/1 ❌ | GUI automation (requires xdotool) |

### File Operations

#### read_file
```bash
cli-agent read_file --filePath="path/to/file.txt"
```
- **Purpose**: Read file contents
- **Parameters**: `filePath` (required)
- **Returns**: File content as string
- **Features**: Encoding detection, large file handling

#### write_file  
```bash
cli-agent write_file --filePath="path/to/file.txt" --content="Hello World"
```
- **Purpose**: Write content to file
- **Parameters**: `filePath` (required), `content` (required)
- **Returns**: Write confirmation
- **Features**: Directory creation, encoding options

#### edit_file
```bash
cli-agent edit_file --filePath="file.txt" --oldText="search" --newText="replace"
```
- **Purpose**: Edit file with string replacement
- **Parameters**: `filePath`, `oldText`, `newText`, `replaceAll` (optional)
- **Returns**: Edit confirmation with changes made
- **Features**: **Automatic healing** if oldText doesn't match exactly

#### multi_edit
```bash
cli-agent multi_edit --file_path="file.txt" --edits='[{"old_string":"a","new_string":"b"}]'
```
- **Purpose**: Multiple edits in single operation
- **Parameters**: `file_path`, `edits` (array of edit operations)
- **Returns**: Summary of all edits applied
- **Features**: Atomic operations, healing for each edit

### Search Operations

#### glob
```bash
cli-agent glob --pattern="**/*.js" --path="src"
```
- **Purpose**: Find files matching pattern
- **Parameters**: `pattern` (required), `path` (optional)
- **Returns**: Array of matching file paths
- **Features**: Recursive search, multiple patterns

#### grep
```bash  
cli-agent grep --pattern="TODO|FIXME" --path="." --outputMode="content"
```
- **Purpose**: Search for content in files
- **Parameters**: `pattern`, `path`, `outputMode` (content/files_with_matches/count)
- **Returns**: Matching lines or files
- **Features**: Regex support, context lines, case-insensitive

#### search_code
```bash
cli-agent search_code --query="function authenticate" --path="src" --fileTypes='["js","ts"]'
```
- **Purpose**: Intelligent code search
- **Parameters**: `query`, `path`, `fileTypes` (optional)
- **Returns**: Relevant code matches with context
- **Features**: Language-aware, semantic matching

### Web Operations

#### web_search
```bash
cli-agent web_search --query="Node.js tutorial" --allowedDomains='["nodejs.org"]'
```
- **Purpose**: Search the web
- **Parameters**: `query`, `allowedDomains` (optional), `blockedDomains` (optional)
- **Returns**: Search results with URLs and snippets
- **Features**: Domain filtering, result ranking

#### web_fetch
```bash
cli-agent web_fetch --url="https://api.example.com/data" --method="GET"
```
- **Purpose**: HTTP requests
- **Parameters**: `url`, `method` (optional), `headers` (optional), `body` (optional)
- **Returns**: Response data
- **Features**: All HTTP methods, header management

### AI Operations

#### task
```bash
cli-agent task --description="Code review" --prompt="Review this code for issues" --subagent_type="code-reviewer"
```
- **Purpose**: Execute specialized AI tasks
- **Parameters**: `description`, `prompt`, `subagent_type`
- **Returns**: AI analysis results
- **Features**: Multiple agent types, specialized prompts

### System Operations

#### execute_command
```bash
cli-agent execute_command --command="npm test" --workingDirectory="/project"
```
- **Purpose**: Execute system commands
- **Parameters**: `command`, `workingDirectory` (optional), `timeout` (optional)
- **Returns**: Command output and exit code
- **Features**: Cross-platform, timeout handling

---

## Advanced Features

### Healing System

The healing system automatically fixes failed tool parameters using AI.

#### How It Works

1. **Detection**: Tool fails with `NoMatchError` 
2. **Analysis**: LLM analyzes the error and file content
3. **Correction**: AI generates corrected parameters
4. **Re-execution**: Tool runs again with fixed parameters
5. **Transparency**: User sees successful result

#### Healing Strategies

- **`unescape`**: Fixes over-escaped strings (\\n → \n, \\t → \t)
- **`llm_correction`**: AI rewrites parameters to match content
- **`newstring_correction`**: Adjusts replacement strings
- **`trim_optimization`**: Removes unnecessary whitespace

#### Example

```bash
# This might fail due to over-escaping:
cli-agent editFile --filePath="app.js" --oldString="const x = 1;\\n" --newString="const x = 2;"

# Healing automatically fixes to:
# oldString: "const x = 1;\n" (unescaped)
# Tool succeeds transparently
```

### Normalization System

Adapts tool schemas for different LLM models.

#### Model Support

- **GPT-4 Family**: Native support, no normalization needed
- **Claude Family**: Schema adjustments for Anthropic's format
- **Gemini**: Fixes for Google's specific requirements  
- **DeepSeek**: Optimizations for DeepSeek models

#### Features

- **Schema Transformation**: Converts between formats
- **Cache Optimization**: Reuses normalized schemas
- **Automatic Detection**: Model family detection from name

### Batch Processing

Execute multiple tools with dependency management.

#### Sequential Execution
```typescript
const result = await sdk.executeBatch({
    operations: [
        { id: 'step1', toolName: 'readFile', parameters: {...} },
        { id: 'step2', toolName: 'editFile', parameters: {...}, dependsOn: ['step1'] },
        { id: 'step3', toolName: 'writeFile', parameters: {...}, dependsOn: ['step2'] }
    ],
    options: { parallel: false }
});
```

#### Parallel Execution
```typescript
const result = await sdk.executeBatch({
    operations: [
        { id: 'task1', toolName: 'grep', parameters: {...} },
        { id: 'task2', toolName: 'glob', parameters: {...} },
        { id: 'task3', toolName: 'webSearch', parameters: {...} }
    ],
    options: { parallel: true }
});
```

#### Dependency Management
```typescript
const result = await sdk.executeBatch({
    operations: [
        { id: 'fetch-data', toolName: 'webFetch', parameters: {...} },
        { id: 'process-data', toolName: 'task', parameters: {...}, dependsOn: ['fetch-data'] },
        { id: 'save-results', toolName: 'writeFile', parameters: {...}, dependsOn: ['process-data'] }
    ]
});
```

---

## Development Guide

### Project Structure

```
cli-agent/
├── src/
│   ├── agent/              # Conversational agent (optional)
│   ├── cli.ts             # CLI entry point
│   ├── directCli.ts       # Direct tool execution CLI  
│   ├── sdk/               # SDK for programmatic access
│   │   ├── index.ts       # Main SDK exports
│   │   ├── cliAgentSDK.ts # Core SDK class
│   │   ├── types/         # TypeScript interfaces
│   │   └── utils/         # SDK utilities
│   └── tools/             # Tool system
│       ├── base/          # Base tool class
│       ├── implementations/ # All 30+ tools
│       ├── registry/      # Tool registration system
│       ├── execution/     # Execution engine
│       ├── healing/       # Healing system  
│       ├── normalization/ # Multi-model normalization
│       └── types/         # Type definitions
├── examples/              # Usage examples
├── samples/               # Demo scripts
├── docs/                  # Documentation
└── tests/                 # Test suites
```

### Creating Custom Tools

#### 1. Extend BaseTool

```typescript
import { BaseTool } from '../base/baseTool';
import { CliToolInvocationOptions, CliCancellationToken, CliToolResult } from '../types/cliTypes';

interface IMyToolParams {
    input: string;
    options?: string[];
}

export class MyCustomTool extends BaseTool<IMyToolParams> {
    readonly name = 'myTool';
    readonly description = 'Description of what my tool does';
    readonly category = 'custom';
    readonly tags = ['utility', 'custom'];
    readonly complexity: 'core' = 'core';
    
    readonly inputSchema = {
        type: 'object',
        properties: {
            input: {
                type: 'string',
                description: 'Input parameter description',
                examples: ['example1', 'example2']
            },
            options: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional parameters'
            }
        },
        required: ['input']
    };

    async invoke(
        options: CliToolInvocationOptions<IMyToolParams>,
        token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { input, options: opts } = options.input;

        try {
            // Check for cancellation
            if (token.isCancellationRequested) {
                return this.createErrorResult('Operation was cancelled');
            }

            // Your tool logic here
            const result = await this.processInput(input, opts);
            
            return this.createSuccessResult(result, `Processed: ${input}`);
            
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error');
        }
    }

    private async processInput(input: string, options?: string[]): Promise<any> {
        // Implementation
        return { processed: input, options };
    }
}

// Auto-register the tool
ToolRegistry.registerTool(MyCustomTool);
```

#### 2. Add to Imports

Add your tool to the imports in `src/cli.ts` and `src/sdk/cliAgentSDK.ts`:

```typescript
import './tools/implementations/myCustomTool';
```

### Testing Tools

```typescript
// Create test file: src/tools/tests/myCustomTool.test.ts
import { MyCustomTool } from '../implementations/myCustomTool';
import { CliCancellationToken } from '../types/cliTypes';

describe('MyCustomTool', () => {
    let tool: MyCustomTool;
    let cancellationToken: CliCancellationToken;

    beforeEach(() => {
        tool = new MyCustomTool();
        cancellationToken = new CliCancellationToken();
    });

    test('should process input correctly', async () => {
        const result = await tool.invoke({
            input: { input: 'test', options: ['opt1'] },
            toolName: 'myTool',
            context: {}
        }, cancellationToken);

        expect(result.isSuccess).toBe(true);
        expect(result.data).toEqual({
            processed: 'test',
            options: ['opt1']
        });
    });
});
```

### Building and Testing

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run typecheck

# Run all checks
npm run validate
```

---

## API Reference

### CliAgentSDK Class

#### Constructor
```typescript
constructor(config: Partial<SDKConfig> = {})
```

#### Methods

##### initialize()
```typescript
async initialize(): Promise<void>
```
Initialize the SDK and all subsystems.

##### executeTool()
```typescript
async executeTool(
    toolName: string,
    parameters: any,
    context?: Partial<SDKExecutionContext>
): Promise<ToolExecutionResult>
```
Execute a single tool with parameters.

##### executeBatch()
```typescript
async executeBatch(request: BatchExecutionRequest): Promise<BatchExecutionResult>
```
Execute multiple tools with dependency management.

##### listTools()
```typescript
listTools(): SDKToolInfo[]
```
Get information about all available tools.

##### getToolInfo()
```typescript
getToolInfo(toolName: string): SDKToolInfo | null
```
Get detailed information about a specific tool.

##### getStats()
```typescript
getStats(): SDKStats
```
Get SDK usage statistics and metrics.

##### installPlugin()
```typescript
async installPlugin(plugin: SDKPlugin): Promise<void>
```
Install a plugin to extend SDK functionality.

##### dispose()
```typescript
async dispose(): Promise<void>
```
Clean up and dispose of SDK resources.

### Types

#### SDKConfig
```typescript
interface SDKConfig {
    openRouterApiKey?: string;
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
    enableHealing?: boolean;
    enableNormalization?: boolean;
    workingDirectory?: string;
    sessionId?: string;
    enableLogging?: boolean;
    customTools?: CustomToolDefinition[];
    // ... more options
}
```

#### ToolExecutionResult
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
}
```

#### BatchExecutionRequest
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

---

## Examples

### Web Application Integration

```typescript
// Express.js API endpoint
import express from 'express';
import { CliAgentSDK } from 'cli-agent-sdk';

const app = express();
const sdk = new CliAgentSDK({
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    enableHealing: true
});

await sdk.initialize();

app.post('/api/analyze-code', async (req, res) => {
    const { files } = req.body;
    
    const results = await sdk.executeBatch({
        operations: files.map(file => ({
            id: `analyze-${file}`,
            toolName: 'symbolAnalysis',
            parameters: { filePath: file, analysisType: 'functions' }
        })),
        options: { parallel: true }
    });
    
    res.json({
        success: results.success,
        analyses: results.results,
        executionTime: results.totalExecutionTime
    });
});
```

### CI/CD Pipeline

```typescript
// GitHub Actions integration
import { CliAgentSDK } from 'cli-agent-sdk';

const sdk = new CliAgentSDK({
    workingDirectory: process.env.GITHUB_WORKSPACE,
    sessionId: `ci-${process.env.GITHUB_RUN_ID}`
});

await sdk.initialize();

// Run quality checks
const qualityPipeline = await sdk.executeBatch({
    operations: [
        { id: 'lint', toolName: 'executeCommand', parameters: { command: 'npm run lint' }},
        { id: 'test', toolName: 'executeCommand', parameters: { command: 'npm test' }},
        { id: 'build', toolName: 'executeCommand', parameters: { command: 'npm run build' }, dependsOn: ['lint', 'test']}
    ]
});

if (!qualityPipeline.success) {
    process.exit(1);
}
```

### Desktop Application

```typescript
// Electron main process
import { CliAgentSDK } from 'cli-agent-sdk';
import { ipcMain } from 'electron';

const sdk = new CliAgentSDK({
    enableLogging: true,
    customLogger: (level, message, data) => {
        // Send to renderer process
        mainWindow.webContents.send('log', { level, message, data });
    }
});

// Handle tool execution requests from renderer
ipcMain.handle('execute-tool', async (event, toolName, parameters) => {
    try {
        const result = await sdk.executeTool(toolName, parameters);
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

### CLI Tool

```typescript
#!/usr/bin/env node
import { CliAgentSDK } from 'cli-agent-sdk';
import { Command } from 'commander';

const program = new Command();
const sdk = new CliAgentSDK();

program
    .command('analyze <path>')
    .description('Analyze code in directory')
    .action(async (path) => {
        await sdk.initialize();
        
        const analysis = await sdk.executeBatch({
            operations: [
                { id: 'files', toolName: 'glob', parameters: { pattern: '**/*.{js,ts}', path }},
                { id: 'todos', toolName: 'grep', parameters: { pattern: 'TODO|FIXME', path }},
                { id: 'complexity', toolName: 'symbolAnalysis', parameters: { filePath: path }}
            ],
            options: { parallel: true }
        });
        
        console.log('Analysis Results:', analysis.results);
    });

program.parse();
```

---

## Troubleshooting

### Common Issues

#### 1. Tool Not Found
```
Error: Tool 'toolName' not found in registry
```
**Solution**: Ensure the tool is imported in your CLI/SDK imports.

#### 2. Healing Not Working
```
Tool failed but healing was not applied
```
**Causes**:
- OpenRouter API key not configured
- Error is not a `NoMatchError`
- Healing disabled in configuration

**Solution**:
```bash
export OPENROUTER_API_KEY="your-key"
```

#### 3. Permission Denied
```
Error: EACCES: permission denied
```
**Solution**: Check file permissions and working directory access.

#### 4. Timeout Errors
```
Error: Operation timed out
```
**Solution**: Increase timeout in configuration:
```typescript
const sdk = new CliAgentSDK({
    healingTimeout: 60000, // 60 seconds
    toolCallLimit: 20
});
```

#### 5. Memory Issues
```
JavaScript heap out of memory
```
**Solution**: Increase Node.js memory limit:
```bash
node --max-old-space-size=4096 your-script.js
```

### Debugging

#### Enable Debug Logging
```typescript
const sdk = new CliAgentSDK({
    enableLogging: true,
    logLevel: 'debug',
    customLogger: (level, message, data) => {
        console.log(`[${level}] ${message}`, data);
    }
});
```

#### Monitor Events
```typescript
sdk.on('tool.execution.start', (data) => console.log('Started:', data.toolName));
sdk.on('tool.execution.error', (error) => console.error('Error:', error));
sdk.on('healing.applied', (healing) => console.log('Healing:', healing.strategy));
```

#### Check Tool Schemas
```typescript
const tool = sdk.getToolInfo('problemTool');
console.log('Tool schema:', tool?.parameters);
```

### Performance Optimization

#### 1. Enable Caching
```typescript
const sdk = new CliAgentSDK({
    cacheEnabled: true,
    enableNormalization: true // Uses cache
});
```

#### 2. Use Batch Operations
```typescript
// Instead of sequential calls
const results = await sdk.executeBatch({
    operations: [...],
    options: { parallel: true }
});
```

#### 3. Limit Tool Calls
```typescript
const sdk = new CliAgentSDK({
    toolCallLimit: 10 // Prevent runaway operations
});
```

### Error Handling Best Practices

```typescript
try {
    const result = await sdk.executeTool('readFile', { filePath: 'nonexistent.txt' });
    
    if (!result.success) {
        console.error('Tool failed:', result.error);
        
        // Check if healing was attempted
        if (result.metadata?.healingApplied) {
            console.log('Healing was applied but still failed');
        }
        
        return;
    }
    
    console.log('Success:', result.output);
    
} catch (error) {
    console.error('SDK error:', error.message);
}
```

---

## Support and Community

### Getting Help

1. **Documentation**: Check this complete documentation first
2. **Examples**: Review the `samples/` and `examples/` directories
3. **Issues**: Open an issue on GitHub with:
   - SDK version
   - Node.js version
   - Complete error messages
   - Minimal reproduction code

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Run `npm run validate` to ensure quality
5. Submit a pull request

### License

This project is licensed under the MIT License. See LICENSE file for details.

---

**🎉 You now have complete documentation for the CLI Agent system! This covers everything from basic usage to advanced integration patterns.**