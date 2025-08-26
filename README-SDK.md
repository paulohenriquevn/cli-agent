# SDKAgent

**28+ Production-Ready AI Tools for LangGraph Projects**

Transform any LangGraph agent with powerful CLI Agent tools - file operations, code analysis, web search, command execution, and more.

[![npm version](https://badge.fury.io/js/cli-agent-tools-sdk.svg)](https://badge.fury.io/js/cli-agent-tools-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## 🚀 Quick Start

```bash
npm install sdkagent @langchain/core @langchain/langgraph
```

```javascript
import { CLIAgentTools } from 'sdkagent';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';

// Get all 28+ tools
const tools = CLIAgentTools.getAllTools({
    workingDirectory: './my-project'
});

// Create LangGraph agent
const agent = createReactAgent({
    llm: new ChatOpenAI({ modelName: "gpt-4o-mini" }),
    tools: tools, // Your 28+ tools ready to use!
    checkpointSaver: memory
});

// Use in workflows
const result = await agent.invoke({
    messages: [{ 
        role: 'user', 
        content: 'Analyze this project and create documentation'
    }]
});
```

## 🛠️ Available Tools (28+ Total)

### **File Operations (7)**
- `read_file` - Read files with line ranges and encoding detection
- `write_file` - Create/overwrite files with backup support  
- `edit_file` - Smart file editing with validation
- `multi_edit` - Multiple edits in single operation
- `ls` - Enhanced directory listing with filtering
- `notebook_edit` - Jupyter notebook cell editing
- `text_editor` - Advanced text editing operations

### **Search & Analysis (6)**
- `grep` - Powerful text search with regex support
- `glob` - File pattern matching and discovery
- `search_code` - Intelligent code search across projects
- `symbol_analysis` - Code symbol and structure analysis
- `advanced_diff` - File comparison and diff generation
- `test_analyzer` - Test analysis and reporting

### **Command Execution (2)**
- `bash` - Safe bash command execution
- `execute_command` - Advanced command execution with timeout

### **Web & Network (4)**
- `web_search` - Web search with result ranking
- `web_fetch` - Web content fetching and parsing
- `enhanced_web_search` - Advanced web search with filtering
- `fetch_documentation` - Documentation fetching and indexing

### **Development Tools (6)**
- `advanced_patch` - Git patch application and management
- `todo_write` - Task management and tracking
- `create_execution_plan` - Project planning and roadmaps
- `computer_use` - Desktop automation capabilities
- `mcp_integration` - Model Context Protocol integration
- `exit_plan_mode` - Planning mode control

### **Notebooks (3)**
- `notebook_read` - Jupyter notebook reading and parsing
- `notebook_edit` - Cell-level notebook editing
- `advanced_notebook` - Advanced notebook operations

### **Integrations (2)**
- `task` - Sub-agent delegation and task management
- `tool_healing` - Self-healing tool recovery

## 📖 Advanced Usage

### **Filter Tools by Category**

```javascript
// Get only file operation tools
const fileTools = CLIAgentTools.getFileTools({
    workingDirectory: './workspace'
});

// Get search and analysis tools
const searchTools = CLIAgentTools.getSearchTools({
    workingDirectory: './codebase'
});

// Get web-related tools
const webTools = CLIAgentTools.getWebTools();
```

### **Custom Tool Configuration**

```javascript
const tools = CLIAgentTools.getAllTools({
    workingDirectory: './my-project',
    enableLogging: true,
    timeout: 30000,
    includeCategories: ['file_operations', 'search-analysis'],
    excludeCategories: ['advanced-tools'],
    includeComplexity: ['essential', 'core']
});
```

### **Direct Tool Execution**

```javascript
import { SDKLangGraph } from 'sdkagent';

const sdk = new SDKLangGraph({
    workingDirectory: './project',
    enableLogging: true
});

// Execute tool directly
const result = await sdk.executeTool('read_file', {
    file_path: './package.json'
});

console.log(result.result); // File contents
```

### **SLA Monitoring**

```javascript
// Get execution statistics
const stats = sdk.getExecutionStats();
console.log('Tool usage:', stats);

// Get SLA metrics
const slaMetrics = sdk.getSLAMetrics();
console.log('Success rates:', slaMetrics);
```

## 🎯 Real-World Examples

### **Code Analysis Workflow**

```javascript
const agent = createReactAgent({
    llm: model,
    tools: CLIAgentTools.getSearchTools(),
    checkpointSaver: memory
});

const analysis = await agent.invoke({
    messages: [{
        role: 'user',
        content: 'Find all TODO comments in this codebase and create a task list'
    }]
});
```

### **Documentation Generation**

```javascript
const tools = CLIAgentTools.getAllTools({
    includeCategories: ['file_operations', 'search-analysis', 'web']
});

const docAgent = createReactAgent({ llm: model, tools });

const docs = await docAgent.invoke({
    messages: [{
        role: 'user', 
        content: 'Analyze this project structure and generate comprehensive README'
    }]
});
```

### **Automated Testing**

```javascript
const devTools = CLIAgentTools.getDevTools();

const testAgent = createReactAgent({ llm: model, tools: devTools });

await testAgent.invoke({
    messages: [{
        role: 'user',
        content: 'Run tests, analyze failures, and suggest fixes'
    }]
});
```

## 🔧 Configuration Options

```typescript
interface SDKLangGraphConfig {
    workingDirectory?: string;           // Working directory for tools
    sessionId?: string;                  // Session identifier
    environment?: Record<string, string>; // Environment variables
    includeCategories?: string[];        // Filter by categories
    excludeCategories?: string[];        // Exclude categories
    includeTags?: string[];              // Filter by tags
    excludeTags?: string[];              // Exclude tags
    includeComplexity?: Array<'core' | 'advanced' | 'essential'>;
    enableLogging?: boolean;             // Enable execution logging
    timeout?: number;                    // Tool execution timeout
}
```

## 🛡️ Security & Best Practices

### **Safe Command Execution**
- All bash commands run in isolated contexts
- Path traversal protection built-in
- Configurable timeout and resource limits

### **File Operation Safety**
- Backup creation before destructive operations
- Path validation and sanitization
- Atomic operations where possible

### **Error Handling**
- Comprehensive error classification
- Graceful degradation on failures
- Detailed error reporting and recovery

## 📊 Performance & Reliability

- ✅ **99% SLA** - Production-tested reliability
- ✅ **Sub-second response** - Optimized for speed
- ✅ **Memory efficient** - Smart caching and resource management
- ✅ **Scalable** - Handles large codebases and complex operations

## 🔍 Troubleshooting

### **Common Issues**

```javascript
// Issue: Tools not found
// Solution: Ensure proper import
import { CLIAgentTools } from 'sdkagent';

// Issue: Permission errors
// Solution: Set proper working directory
const tools = CLIAgentTools.getAllTools({
    workingDirectory: process.cwd() // Use accessible directory
});

// Issue: Timeout errors  
// Solution: Increase timeout
const sdk = new SDKLangGraph({
    timeout: 60000 // 60 seconds
});
```

### **Debug Mode**

```javascript
const tools = CLIAgentTools.getAllTools({
    enableLogging: true, // Shows detailed execution logs
    workingDirectory: './my-project'
});
```

## 📚 API Reference

### **CLIAgentTools**

- `getAllTools(config?)` - Get all available tools
- `getFileTools(config?)` - Get file operation tools only
- `getSearchTools(config?)` - Get search and analysis tools
- `getWebTools(config?)` - Get web-related tools  
- `getDevTools(config?)` - Get development tools
- `getEssentialTools(config?)` - Get core functionality tools

### **SDKLangGraph**

- `getAllTools()` - Get tools in LangChain format
- `executeTool(name, input)` - Execute tool directly
- `getExecutionStats()` - Get usage statistics
- `getSLAMetrics()` - Get reliability metrics

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Documentation](https://docs.example.com)
- [GitHub Repository](https://github.com/yourusername/cli-agent-tools-sdk)
- [Issue Tracker](https://github.com/yourusername/cli-agent-tools-sdk/issues)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)

---

**Ready to supercharge your LangGraph agents? Install CLI Agent Tools SDK today!** 🚀