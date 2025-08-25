# CLI Agent - System Architecture

## Overview

The CLI Agent system is built with a modular, extensible architecture that supports both direct CLI usage and programmatic integration via SDK. The system is designed for robustness, scalability, and ease of integration.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Agent System                         │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐     │
│  │   CLI Layer │    │  SDK Layer  │    │  Integration    │     │
│  │   (Direct)  │    │(Programmatic)│    │    Layer        │     │
│  └─────────────┘    └─────────────┘    └─────────────────┘     │
│         │                   │                     │            │
│         └───────────────────┼─────────────────────┘            │
│                             │                                  │
│  ┌──────────────────────────┼──────────────────────────────┐   │
│  │              Core System │                              │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │            Tool Registry System                 │   │   │
│  │  │  • Dynamic Tool Registration                   │   │   │
│  │  │  • Category-based Organization                 │   │   │
│  │  │  • Schema Validation                           │   │   │
│  │  │  • Tool Discovery                              │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                             │                           │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │         Execution Engine                        │   │   │
│  │  │  • Parameter Processing                         │   │   │
│  │  │  • Cancellation Support                        │   │   │
│  │  │  • Result Formatting                           │   │   │
│  │  │  • Error Handling                              │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                             │                           │   │
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

## Layer Breakdown

### 1. Interface Layers

#### CLI Layer (`src/cli.ts`)
- **Purpose**: Direct command-line tool execution
- **Features**: 
  - Dynamic command generation from tool registry
  - Parameter mapping from CLI flags to tool schemas
  - Help system with tool discovery
  - Status reporting
- **Usage**: `cli-agent toolName --param1=value1 --param2=value2`

#### SDK Layer (`src/sdk/`)
- **Purpose**: Programmatic integration for applications
- **Features**:
  - Event-driven architecture
  - Batch processing with dependencies
  - Plugin system
  - Custom tool registration
  - Performance monitoring
- **Usage**: `const result = await sdk.executeTool('toolName', params)`

#### Integration Layer
- **Purpose**: Web APIs, enterprise systems, CI/CD pipelines
- **Features**:
  - RESTful API wrappers
  - Webhook integrations
  - Enterprise authentication
  - Audit logging

### 2. Core System

#### Tool Registry System (`src/tools/registry/`)

**Components:**
- `toolRegistry.ts` - Central tool registration and discovery
- `toolsService.ts` - Service layer for tool management
- `intentLayer.ts` - Intent-based tool routing
- `toolCallingLoopIntegration.ts` - Integration with execution loops

**Responsibilities:**
- Register tools at startup
- Provide tool discovery and introspection
- Validate tool schemas
- Manage tool categories and tags
- Handle tool lifecycle

**Key Features:**
```typescript
// Auto-registration pattern
export class MyTool extends BaseTool<IParams> {
    readonly name = 'myTool';
    // ... implementation
}
ToolRegistry.registerTool(MyTool); // Auto-registered
```

#### Execution Engine (`src/tools/execution/`)

**Components:**
- `toolCallingLoop.ts` - Abstract execution orchestrator
- `pauseController.ts` - Cancellation and pause support
- `streamingSystem.ts` - Real-time output streaming
- `validation.ts` - Parameter validation
- `monitoring.ts` - Performance tracking
- `nestedCalls.ts` - Support for tool-calling-tools

**Data Flow:**
1. **Input Validation** - Check parameters against tool schema
2. **Context Creation** - Build execution context with session info
3. **Tool Invocation** - Execute tool with validated parameters
4. **Result Processing** - Format output and handle errors
5. **Monitoring** - Track metrics and emit events

### 3. Tool Implementation

#### Base Tool Architecture (`src/tools/base/baseTool.ts`)

All tools extend the `BaseTool` abstract class:

```typescript
export abstract class BaseTool<T extends IToolParams> {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly inputSchema: any;
    
    // Optional metadata
    readonly category: string = 'other';
    readonly tags: string[] = [];
    readonly complexity: 'core' | 'advanced' | 'essential' = 'core';
    
    // Implementation
    abstract invoke(
        options: CliToolInvocationOptions<T>,
        token: CliCancellationToken
    ): Promise<CliToolResult>;
}
```

#### Tool Categories

**File Operations** (`src/tools/implementations/`)
- `readFileTool.ts` - Read file contents
- `writeFileTool.ts` - Write content to files
- `editFileTool.ts` - String-based file editing
- `multiEditTool.ts` - Multiple edits in one operation
- `textEditorTool.ts` - Advanced text manipulation

**System Operations**
- `executeCommandTool.ts` - Execute system commands
- `bashCommandTool.ts` - Bash script execution
- `listDirectoryTool.ts` - File system browsing

**Search & Analysis**
- `globTool.ts` - Pattern-based file finding
- `grepTool.ts` - Content search with regex
- `searchCodeTool.ts` - Intelligent code search
- `symbolAnalysisTool.ts` - Code structure analysis

**Web Operations**
- `webSearchTool.ts` - Web search capabilities
- `webFetchTool.ts` - HTTP client functionality
- `fetchDocumentationTool.ts` - Documentation retrieval

**Development Tools**
- `todoWriteTool.ts` - Task management
- `createExecutionPlanTool.ts` - Project planning
- `intelligentTestAnalyzerTool.ts` - Test analysis
- `advancedDiffTool.ts` - File comparison
- `advancedPatchTool.ts` - Patch application

**Integration Tools**
- `taskTool.ts` - AI task delegation
- `subAgentsTool.ts` - Sub-agent orchestration
- `mcpIntegrationTool.ts` - Model Context Protocol
- `hooksManagementTool.ts` - Git hooks management

### 4. Advanced Features

#### Batch Processing System

**Sequential Processing:**
```typescript
const result = await sdk.executeBatch({
    operations: [
        { id: 'step1', toolName: 'read_file', parameters: {...} },
        { id: 'step2', toolName: 'edit_file', parameters: {...}, dependsOn: ['step1'] },
        { id: 'step3', toolName: 'write_file', parameters: {...}, dependsOn: ['step2'] }
    ],
    options: { parallel: false }
});
```

**Parallel Processing:**
```typescript
const result = await sdk.executeBatch({
    operations: [
        { id: 'task1', toolName: 'grep', parameters: {...} },
        { id: 'task2', toolName: 'glob', parameters: {...} },
        { id: 'task3', toolName: 'web_search', parameters: {...} }
    ],
    options: { parallel: true }
});
```

**Dependency Management:**
- Directed Acyclic Graph (DAG) execution
- Automatic dependency resolution
- Failure propagation with configurable stop-on-error
- Result passing between dependent operations

#### Plugin System

**Plugin Interface:**
```typescript
interface SDKPlugin {
    name: string;
    version: string;
    description: string;
    
    initialize(sdk: CliAgentSDK): Promise<void> | void;
    cleanup?(): Promise<void> | void;
    
    // Lifecycle hooks
    beforeToolExecution?(toolName: string, parameters: any): Promise<any> | any;
    afterToolExecution?(result: ToolExecutionResult): Promise<ToolExecutionResult> | ToolExecutionResult;
    onError?(error: Error, context: any): Promise<void> | void;
}
```

**Plugin Capabilities:**
- **Parameter Transformation** - Modify inputs before execution
- **Result Enhancement** - Post-process outputs
- **Monitoring & Logging** - Track usage patterns
- **Custom Validation** - Add business rules
- **Integration** - Connect to external systems

#### Event System

**Event Types:**
- `tool.execution.start` - Tool execution begins
- `tool.execution.complete` - Tool execution successful
- `tool.execution.error` - Tool execution failed
- `sdk.initialized` - SDK ready for use
- `sdk.error` - SDK-level errors

**Event Usage:**
```typescript
sdk.on('tool.execution.complete', (result) => {
    console.log(`Tool ${result.toolInfo.name} completed in ${result.executionTime}ms`);
    
    // Send metrics to monitoring system
    metrics.recordExecution(result.toolInfo.name, result.executionTime, result.success);
});
```

## Data Flow Patterns

### 1. Direct CLI Execution

```
User Input → CLI Parser → Tool Registry → Tool Execution → Result Output
     ↓             ↓              ↓              ↓              ↓
cli-agent    Parse flags    Find tool    Invoke method    Format output
read_file    Extract        Get read_file Execute with    Display content
--filePath   parameters     instance     parameters      or error
```

### 2. SDK Programmatic Access

```
SDK Call → Parameter Processing → Tool Registry → Execution → Event Emission → Result
    ↓              ↓                     ↓             ↓           ↓             ↓
executeTool   Validate params      Find & validate  Execute   Emit events   Return result
('read_file', Check schema        Check tool        tool.     'complete'    ToolExecutionResult
{filePath})   Apply transforms    exists & ready    invoke()  event         with metadata
```

### 3. Batch Processing

```
Batch Request → Dependency Analysis → Execution Plan → Parallel/Sequential → Result Aggregation
      ↓               ↓                      ↓               ↓                    ↓
Multiple ops    Build DAG             Create schedule  Execute according   Collect all results
with deps       Check cycles          Determine order  to plan             Handle failures
                Validate deps         Optimize plan    Monitor progress    Return batch result
```

## Extensibility Points

### 1. Custom Tools

**Creating New Tools:**
1. Extend `BaseTool<TParams>`
2. Implement required methods
3. Define input schema
4. Add to tool imports
5. Auto-registration handles the rest

### 2. Custom Plugins

**Plugin Development:**
1. Implement `SDKPlugin` interface
2. Handle initialization and cleanup
3. Add lifecycle hooks as needed
4. Install via `sdk.installPlugin()`

### 3. Custom Integrations

**Integration Patterns:**
- **Web API Wrapper** - Expose tools as REST endpoints
- **Message Queue Consumer** - Process tool requests from queues
- **Webhook Handler** - React to external events with tool execution
- **CLI Extension** - Add new commands to the CLI interface

## Performance Considerations

### 1. Tool Registry Optimization

- **Lazy Loading** - Tools loaded only when first accessed
- **Schema Caching** - Compiled schemas cached for reuse
- **Category Indexing** - Fast lookups by category and tags

### 2. Execution Optimization

- **Parameter Validation Caching** - Avoid re-validating identical parameters
- **Result Streaming** - Stream large outputs instead of buffering
- **Cancellation Support** - Early termination for long-running operations

### 3. Batch Processing Optimization

- **Dependency Caching** - Reuse results across dependent operations
- **Parallel Limits** - Configurable concurrency to prevent resource exhaustion
- **Memory Management** - Streaming results for large batch operations

## Security Architecture

### 1. Input Validation

- **Schema-based Validation** - All inputs validated against JSON schemas
- **Parameter Sanitization** - Dangerous patterns filtered out
- **Path Traversal Protection** - File paths validated and sandboxed

### 2. Execution Sandboxing

- **Working Directory Isolation** - Operations contained within specified directories
- **Environment Variable Control** - Limited access to environment
- **Resource Limits** - Timeouts and memory limits on operations

### 3. Audit and Monitoring

- **Execution Logging** - All tool executions logged with context
- **User Attribution** - Operations tied to user/session identifiers
- **Performance Monitoring** - Resource usage tracking

## Error Handling Strategy

### 1. Error Categories

- **Validation Errors** - Parameter schema violations
- **Execution Errors** - Tool-specific failures
- **System Errors** - File system, network, or resource errors
- **Timeout Errors** - Operations exceeding time limits

### 2. Error Recovery

- **Graceful Degradation** - Partial results when possible
- **Retry Logic** - Automatic retries for transient failures
- **Fallback Strategies** - Alternative approaches when primary fails

### 3. Error Reporting

- **Structured Errors** - Consistent error format with context
- **Error Aggregation** - Batch operation error collection
- **Debug Information** - Detailed context for troubleshooting

This architecture provides a solid foundation for building robust, scalable tool automation systems while maintaining flexibility for customization and extension.