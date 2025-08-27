# CLI Agent Tools SDK

**30+ Production-Ready Tools for Direct Use**

Pure CLI tools with no framework dependencies. Use them directly in any context - CLI applications, AI agents, automation scripts, or any TypeScript/JavaScript project.

[![npm version](https://badge.fury.io/js/@paulohenriquevn%2Fsdkagent.svg)](https://badge.fury.io/js/@paulohenriquevn%2Fsdkagent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Quick Start

```bash
npm install @paulohenriquevn/sdkagent
```

```javascript
import { CLIAgentTools, ToolRegistry } from '@paulohenriquevn/sdkagent';

// Get all tools
const tools = CLIAgentTools.getAllTools();
console.log(`Found ${tools.length} tools`);

// Get specific tool
const readTool = CLIAgentTools.getTool('read_file');

// Execute tool directly
const result = await CLIAgentTools.executeTool('read_file', { 
    filePath: './package.json' 
});

console.log(result.getText());
```

## Direct Tool Usage

```javascript
// Use ToolRegistry directly for maximum control
import { ToolRegistry } from '@paulohenriquevn/sdkagent';

// Get tool and execute
const tool = ToolRegistry.getTool('bash');
const result = await tool.invoke({
    input: { command: 'ls -la', description: 'List files' },
    toolName: 'bash',
    context: { workingDirectory: process.cwd() }
}, cancellationToken);

// Handle result
if (result.hasErrors()) {
    console.error('Errors:', result.getErrors());
} else {
    console.log('Output:', result.getText());
}
```

## Available Tools (30+ Total)

### **File Operations**
- `read_file` - Read files with line ranges and encoding detection
- `write_file` - Create/overwrite files with backup support  
- `edit_file` - Smart file editing with validation
- `multi_edit` - Multiple edits in single operation
- `ls` - Enhanced directory listing with filtering
- `text_editor` - Advanced text editing operations

### **Search & Analysis**
- `grep` - Powerful text search with regex support
- `glob` - File pattern matching and discovery
- `search_code` - Intelligent code search across projects
- `symbol_analysis` - Code symbol and structure analysis
- `advanced_diff` - File comparison and diff generation

### **Command Execution**
- `bash` - Safe bash command execution
- `execute_command` - Advanced command execution with timeout

### **Web & Network**
- `web_search` - Web search with result ranking
- `web_fetch` - Web content fetching and parsing
- `enhanced_web_search` - Advanced web search with filtering
- `fetch_documentation` - Documentation fetching and indexing

### **Development Tools**
- `todo_write` - Task management and tracking
- `create_execution_plan` - Project planning and roadmaps
- `exit_plan_mode` - Planning mode control
- `advanced_patch` - Git patch application and management
- `test_analyzer` - Intelligent test analysis

### **Notebooks**
- `notebook_read` - Jupyter notebook reading and parsing
- `notebook_edit` - Cell-level notebook editing
- `advanced_notebook` - Advanced notebook operations

### **Integration**
- `task` - Sub-agent delegation and task management
- `mcp_integration` - Model Context Protocol integration
- `computer_use` - Desktop automation capabilities

## Tool Discovery

```javascript
// Browse tools by category
const fileTools = CLIAgentTools.getFileTools();
const webTools = CLIAgentTools.getWebTools();
const devTools = CLIAgentTools.getDevTools();

// Filter by complexity
const essentialTools = CLIAgentTools.getEssentialTools();
const coreTools = CLIAgentTools.getCoreTools();

// Get statistics
const stats = CLIAgentTools.getStats();
console.log(`Total tools: ${stats.totalTools}`);
console.log(`Categories: ${stats.categoriesCount}`);
```

## Advanced Usage

### **Error Handling**
```javascript
const result = await CLIAgentTools.executeTool('read_file', { 
    filePath: './nonexistent.txt' 
});

if (result.hasErrors()) {
    console.error('Tool failed:', result.getErrors().join(', '));
} else {
    console.log('Success:', result.getText());
}
```

### **Custom Context**
```javascript
import { ToolRegistry } from '@paulohenriquevn/sdkagent';

const customContext = {
    workingDirectory: '/path/to/project',
    sessionId: 'my-session',
    environment: { NODE_ENV: 'production' }
};

const result = await ToolRegistry.executeTool('bash', {
    command: 'npm run build',
    description: 'Build project'
}, customContext);
```

### **Tool Filtering**
```javascript
// Filter tools by multiple criteria
const filtered = ToolRegistry.filterTools({
    category: 'file_operations',
    tags: ['core'],
    complexity: 'essential'
});

console.log(`Found ${filtered.length} matching tools`);
```

## Use Cases

### **CLI Applications**
```javascript
#!/usr/bin/env node
import { CLIAgentTools } from '@paulohenriquevn/sdkagent';

const command = process.argv[2];
const file = process.argv[3];

if (command === 'read') {
    const result = await CLIAgentTools.executeTool('read_file', { 
        filePath: file 
    });
    console.log(result.getText());
}
```

### **Automation Scripts**
```javascript
import { CLIAgentTools } from '@paulohenriquevn/sdkagent';

// Automated project analysis
async function analyzeProject(projectPath) {
    // List files
    const files = await CLIAgentTools.executeTool('ls', { 
        path: projectPath 
    });
    
    // Search for TODOs
    const todos = await CLIAgentTools.executeTool('grep', {
        pattern: 'TODO|FIXME',
        path: projectPath
    });
    
    // Generate report
    const report = await CLIAgentTools.executeTool('write_file', {
        filePath: './analysis-report.txt',
        content: `Files: ${files.getText()}\n\nTODOs: ${todos.getText()}`
    });
    
    return report;
}
```

### **AI Agent Integration**
```javascript
// Use with any AI framework
import { CLIAgentTools } from '@paulohenriquevn/sdkagent';

const tools = CLIAgentTools.getAllTools();

// Convert to OpenAI format
const openaiTools = tools.map(tool => ({
    type: "function",
    function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
    }
}));

// Or use directly in custom agents
async function executeAgentAction(toolName, params) {
    return await CLIAgentTools.executeTool(toolName, params);
}
```

## API Reference

### **CLIAgentTools**
- `getAllTools()` - Get all available tools
- `getTool(name)` - Get specific tool by name
- `getFileTools()` - Get file operation tools
- `getWebTools()` - Get web-related tools
- `getDevTools()` - Get development tools
- `getEssentialTools()` - Get essential tools only
- `executeTool(name, input, context?)` - Execute tool directly
- `getStats()` - Get registry statistics

### **ToolRegistry**
- `getTools()` - Get all registered tools
- `getTool(name)` - Get tool by name
- `getToolsByCategory(category)` - Filter by category
- `getToolsByTag(tag)` - Filter by tag
- `filterTools(criteria)` - Advanced filtering
- `executeTool(name, input, context?, token?)` - Execute with full control

## Security & Best Practices

- **Safe command execution** - All bash commands run in controlled contexts
- **Path validation** - Automatic path traversal protection
- **Error boundaries** - Comprehensive error handling
- **Resource limits** - Configurable timeouts and limits
- **No external dependencies** - Pure TypeScript implementation

## Performance

- **Zero overhead** - Direct tool access, no conversions
- **Memory efficient** - Lazy loading and smart caching
- **Fast execution** - Optimized for speed
- **Scalable** - Handles large projects and complex operations

## Contributing

We welcome contributions! The tools are designed to be:
- **Framework-agnostic** - Work anywhere
- **Self-contained** - No external dependencies
- **Well-tested** - Comprehensive test coverage
- **Documented** - Clear interfaces and examples

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Ready to supercharge your applications with powerful CLI tools? Install today!**

```bash
npm install @paulohenriquevn/sdkagent
```