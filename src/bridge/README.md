# LangGraph Bridge - Use CLI Agent Tools in LangGraph Projects

Export your 30+ CLI Agent tools for use in external LangGraph projects without adding LangGraph as a dependency to this codebase.

## 🎯 **What This Bridge Does**

- ✅ **Converts** your CLI Agent tools to LangChain tool format
- ✅ **Exports** 30+ tools for use in any LangGraph project
- ✅ **No Dependencies** - doesn't add LangGraph to this project
- ✅ **Flexible Filtering** - choose which tools to export
- ✅ **Monitoring** - track tool usage and performance

## 🚀 **Quick Start**

### **In Your External LangGraph Project:**

```typescript
// 1. Import the bridge
import { CLIAgentTools } from 'path/to/cli-agent/src/bridge/langGraphBridge';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from '@langchain/langgraph';

// 2. Get all CLI Agent tools
const tools = CLIAgentTools.getAllTools({
    workingDirectory: '/path/to/your/project',
    enableLogging: true
});

// 3. Create your LangGraph agent
const model = new ChatOpenAI({ temperature: 0 });
const agent = createReactAgent({
    llm: model,
    tools: tools,  // Your 30+ tools ready to use!
    checkpointer: new MemorySaver()
});

// 4. Use the agent
const result = await agent.invoke({
    messages: [{ 
        role: 'user', 
        content: 'Read package.json and analyze the project structure' 
    }]
}, { configurable: { thread_id: '1' } });
```

## 🛠️ **Available Tool Categories**

### **File Operations**
- `read_file` - Read files with line ranges
- `write_file` - Write files with backup
- `edit_file` - Precise text replacement
- `multi_edit` - Multiple edits in one file
- `ls` - List directories with metadata

### **Search & Analysis** 
- `grep` - Pattern search with fallback
- `glob` - File pattern matching
- `search_code` - Intelligent code search
- `symbol_analysis` - Code refactoring analysis

### **System & Commands**
- `bash` - Execute bash commands
- `execute_command` - Advanced command execution

### **Web & Network**
- `web_search` - Web search with filters
- `web_fetch` - HTTP requests
- `fetch_documentation` - Documentation fetcher

### **Development Tools**
- `test_analyzer` - Intelligent test analysis
- `advanced_diff` - File comparison
- `todo_write` - Task management
- `create_execution_plan` - Execution planning

### **Notebooks**
- `notebook_read` - Read Jupyter notebooks
- `notebook_edit` - Edit notebook cells
- `advanced_notebook` - Advanced notebook operations

### **Integrations**
- `task` - Sub-agent execution
- `mcp_integration` - MCP protocol support
- `computer_use` - Desktop automation

## 📋 **Usage Patterns**

### **1. Get All Tools**
```typescript
const tools = CLIAgentTools.getAllTools();
// Returns all 30+ tools
```

### **2. Get Tools by Category**
```typescript
const fileTools = CLIAgentTools.getFileTools();
const searchTools = CLIAgentTools.getSearchTools(); 
const webTools = CLIAgentTools.getWebTools();
const devTools = CLIAgentTools.getDevTools();
```

### **3. Get Essential Tools Only**
```typescript
const essentialTools = CLIAgentTools.getEssentialTools();
// Returns only core and essential complexity tools
```

### **4. Custom Filtering**
```typescript
const bridge = CLIAgentTools.createBridge({
    workingDirectory: './project',
    includeCategories: ['file_operations', 'search-analysis'],
    excludeTags: ['experimental'],
    includeComplexity: ['core', 'essential'],
    enableLogging: true,
    timeout: 10000
});

const customTools = bridge.getAllTools();
```

### **5. Specific Tools by Name**
```typescript
const specificTools = bridge.getToolsByName([
    'read_file',
    'search_code', 
    'bash',
    'write_file'
]);
```

## 🔧 **Configuration Options**

```typescript
interface BridgeConfig {
    workingDirectory?: string;        // Working directory for tools
    sessionId?: string;              // Session identifier
    environment?: Record<string, string>; // Environment variables
    
    // Filtering options
    includeCategories?: string[];    // Categories to include
    excludeCategories?: string[];    // Categories to exclude
    includeTags?: string[];          // Tags to include
    excludeTags?: string[];          // Tags to exclude
    includeComplexity?: Array<'core' | 'advanced' | 'essential'>;
    
    // Execution options
    enableLogging?: boolean;         // Enable execution logging
    timeout?: number;               // Tool execution timeout (ms)
}
```

## 📊 **Monitoring & Stats**

```typescript
const bridge = new LangGraphBridge({ enableLogging: true });

// After some tool executions
const stats = bridge.getExecutionStats();
console.log('Tool usage stats:', stats);
// Output: { 'read_file': 5, 'search_code': 3, 'bash': 2 }

// Get tool metadata
const metadata = bridge.getToolsMetadata();
console.log('Available tools:', metadata);
```

## 💼 **Real-World Example**

Here's a complete workflow that analyzes a codebase and generates documentation:

```typescript
import { StateGraph, MessagesAnnotation, START } from '@langchain/langgraph';
import { CLIAgentTools } from 'path/to/cli-agent/src/bridge/langGraphBridge';

const tools = CLIAgentTools.getAllTools({
    workingDirectory: './target-project'
});

// Helper to execute tools
async function executeTool(toolName: string, params: Record<string, unknown>) {
    const tool = tools.find(t => t.name === toolName);
    return await tool!.func(params);
}

// Workflow nodes
const workflow = new StateGraph(MessagesAnnotation)
    .addNode('analyze', async (state) => {
        // Find project structure
        const structure = await executeTool('ls', { path: '.' });
        
        // Find code files  
        const codeFiles = await executeTool('glob', { 
            pattern: '**/*.{ts,js}' 
        });
        
        // Search for functions
        const functions = await executeTool('search_code', {
            query: 'function',
            search_type: 'function'
        });
        
        return {
            messages: [...state.messages, {
                role: 'assistant',
                content: `Analysis complete:\n\nStructure: ${structure}\n\nFiles: ${codeFiles}\n\nFunctions: ${functions}`
            }]
        };
    })
    .addNode('document', async (state) => {
        // Generate documentation
        const docs = `# Project Documentation\n\n${state.messages[state.messages.length - 1].content}`;
        
        await executeTool('write_file', {
            filePath: 'GENERATED_DOCS.md',
            content: docs
        });
        
        return {
            messages: [...state.messages, {
                role: 'assistant',
                content: 'Documentation generated successfully!'
            }]
        };
    })
    .addEdge(START, 'analyze')
    .addEdge('analyze', 'document');

const app = workflow.compile();
```

## 🏗️ **Integration Examples**

### **With ReAct Agent**
```typescript
const tools = CLIAgentTools.getAllTools();
const agent = createReactAgent({ llm: model, tools });
```

### **With Custom StateGraph**
```typescript
const tools = CLIAgentTools.getFileTools();
const workflow = new StateGraph(MessagesAnnotation)
    .addNode('process', async (state) => {
        const readTool = tools.find(t => t.name === 'read_file');
        const content = await readTool!.func({ filePath: 'config.json' });
        // Process content...
    });
```

### **With Human-in-the-Loop**
```typescript
import { interrupt } from '@langchain/langgraph';

const workflow = new StateGraph(MessagesAnnotation)
    .addNode('read', async (state) => {
        const tool = tools.find(t => t.name === 'read_file');
        const content = await tool!.func({ filePath: 'sensitive.txt' });
        
        const approved = interrupt({
            question: 'Should I proceed with this sensitive file?',
            content: content
        });
        
        return { approved, content };
    });
```

## 📁 **Project Structure**

```
src/bridge/
├── langGraphBridge.ts      # Main bridge implementation
├── examples/
│   ├── basicUsage.ts       # Basic usage examples
│   └── realWorldExample.ts # Complete workflow example
└── README.md               # This documentation
```

## 🔑 **Key Features**

### **✅ Zero Dependencies**
- No LangGraph dependency added to CLI Agent project
- Clean separation of concerns
- Works with any LangGraph version

### **✅ Full Tool Compatibility** 
- All 30+ CLI Agent tools supported
- Preserves original tool functionality
- Maintains input/output formats

### **✅ Flexible Filtering**
- Filter by category, tags, complexity
- Include/exclude specific tools
- Custom tool selection

### **✅ Production Ready**
- Error handling and timeouts
- Execution monitoring
- Performance statistics
- Logging support

### **✅ Type Safety**
- Full TypeScript support
- Proper tool schemas
- Type-safe parameters

## 🎯 **Use Cases**

1. **Code Analysis Workflows** - Analyze codebases using search and file tools
2. **Documentation Generation** - Read code and generate docs automatically  
3. **Project Automation** - Automate development tasks with bash/command tools
4. **File Management** - Process and organize files in workflows
5. **Web Integration** - Fetch data and integrate with web APIs
6. **Testing Pipelines** - Analyze tests and generate reports
7. **Notebook Processing** - Work with Jupyter notebooks in workflows

## 🚀 **Get Started**

1. **Copy** the bridge files to your CLI Agent project
2. **Import** CLIAgentTools in your LangGraph project  
3. **Get tools** using the convenience methods
4. **Create** your LangGraph agent with the tools
5. **Build** amazing workflows!

**Your 30+ CLI Agent tools are now ready to power any LangGraph workflow! 🎉**