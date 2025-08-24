# CLI Agent - Tools Reference

Complete reference for all 30+ built-in tools available in the CLI Agent system.

## Table of Contents

- [File Operations](#file-operations)
- [System Operations](#system-operations)
- [Search Operations](#search-operations)
- [Web Operations](#web-operations)
- [Analysis Operations](#analysis-operations)
- [Development Operations](#development-operations)
- [Advanced Operations](#advanced-operations)
- [Integration Operations](#integration-operations)
- [Notebook Operations](#notebook-operations)
- [System Tools](#system-tools)

---

## File Operations

### readFile

Read contents from a file.

**CLI Usage:**
```bash
cli-agent readFile --filePath="path/to/file.txt"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('readFile', {
    filePath: './package.json'
});
```

**Parameters:**
- `filePath` (string, required) - Path to the file to read

**Returns:**
- File content as string
- File encoding information
- File size metadata

**Features:**
- Automatic encoding detection
- Large file handling with streaming
- Path validation and security checks
- Support for various file formats

---

### writeFile

Write content to a file.

**CLI Usage:**
```bash
cli-agent writeFile --filePath="output.txt" --content="Hello World"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('writeFile', {
    filePath: './output.txt',
    content: 'Hello World\nMultiple lines supported'
});
```

**Parameters:**
- `filePath` (string, required) - Path where to write the file
- `content` (string, required) - Content to write to the file
- `encoding` (string, optional) - File encoding (default: utf8)
- `createDirectories` (boolean, optional) - Create parent directories if they don't exist

**Returns:**
- Write confirmation
- File size written
- Path created

**Features:**
- Automatic directory creation
- Multiple encoding support
- Backup creation for existing files
- Atomic write operations

---

### editFile

Edit a file by replacing specific text content.

**CLI Usage:**
```bash
cli-agent editFile --filePath="src/app.js" --oldString="var x = 1;" --newString="const x = 1;"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('editFile', {
    filePath: './src/app.js',
    oldString: 'console.log("debug")',
    newString: '// Debug removed',
    replaceAll: false
});
```

**Parameters:**
- `filePath` (string, required) - Path to the file to edit
- `oldString` (string, required) - Text to find and replace
- `newString` (string, required) - Replacement text
- `replaceAll` (boolean, optional) - Replace all occurrences (default: false)
- `expectedReplacements` (number, optional) - Expected number of replacements for validation

**Returns:**
- Number of replacements made
- Before/after content preview
- File modification confirmation

**Features:**
- **Automatic healing** - If `oldString` doesn't match exactly, AI corrects it
- Exact match validation
- Multiple replacement strategies
- Undo capability

---

### multiEdit

Perform multiple edits on a single file in one operation.

**CLI Usage:**
```bash
cli-agent multiEdit --filePath="src/app.js" --edits='[{"oldString":"var","newString":"const"},{"oldString":"function","newString":"const"}]'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('multiEdit', {
    filePath: './src/app.js',
    edits: [
        {
            oldString: 'var apiUrl = "localhost"',
            newString: 'const apiUrl = process.env.API_URL'
        },
        {
            oldString: 'var port = 3000',
            newString: 'const port = process.env.PORT || 3000'
        }
    ]
});
```

**Parameters:**
- `filePath` (string, required) - Path to the file to edit
- `edits` (array, required) - Array of edit operations
  - `oldString` (string) - Text to find
  - `newString` (string) - Replacement text
  - `replaceAll` (boolean, optional) - Replace all occurrences

**Returns:**
- Summary of all edits applied
- Success/failure status for each edit
- Total modifications count

**Features:**
- Atomic operations (all or none)
- Individual edit healing
- Progress tracking
- Rollback on failure

---

### textEditor

Advanced text manipulation operations.

**CLI Usage:**
```bash
cli-agent textEditor --filePath="README.md" --operation="append" --content="## New Section"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('textEditor', {
    filePath: './README.md',
    operation: 'insertAt',
    lineNumber: 10,
    content: 'New content at line 10'
});
```

**Parameters:**
- `filePath` (string, required) - Path to the file
- `operation` (string, required) - Operation type: `append`, `prepend`, `insertAt`, `deleteLine`, `replaceRange`
- `content` (string) - Content for insert/append/prepend operations
- `lineNumber` (number) - Line number for line-specific operations
- `startLine` (number) - Start line for range operations
- `endLine` (number) - End line for range operations

**Returns:**
- Operation result
- File modification details
- Line count changes

**Features:**
- Line-based operations
- Range manipulation
- Preserve formatting
- Undo support

---

## System Operations

### executeCommand

Execute system commands with output capture.

**CLI Usage:**
```bash
cli-agent executeCommand --command="npm test" --workingDirectory="/project"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('executeCommand', {
    command: 'git status --porcelain',
    workingDirectory: './my-project',
    timeout: 30000
});
```

**Parameters:**
- `command` (string, required) - Command to execute
- `workingDirectory` (string, optional) - Working directory for the command
- `timeout` (number, optional) - Timeout in milliseconds (default: 120000)
- `captureOutput` (boolean, optional) - Capture stdout/stderr (default: true)
- `environment` (object, optional) - Environment variables

**Returns:**
- Command output (stdout/stderr)
- Exit code
- Execution time
- Working directory used

**Features:**
- Cross-platform compatibility
- Timeout handling
- Environment variable support
- Output streaming for long commands

---

### bashCommand

Execute bash scripts with enhanced features.

**CLI Usage:**
```bash
cli-agent bashCommand --script="echo 'Hello' && pwd && date"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('bashCommand', {
    script: `
#!/bin/bash
set -e
echo "Starting deployment..."
npm run build
npm run deploy
echo "Deployment complete!"
    `,
    workingDirectory: './project'
});
```

**Parameters:**
- `script` (string, required) - Bash script to execute
- `workingDirectory` (string, optional) - Working directory
- `timeout` (number, optional) - Timeout in milliseconds
- `environment` (object, optional) - Environment variables
- `shell` (string, optional) - Shell to use (default: /bin/bash)

**Returns:**
- Script output
- Exit code
- Execution details

**Features:**
- Multi-line script support
- Error handling with `set -e`
- Variable substitution
- Script validation

---

### listDirectory

List contents of a directory with detailed information.

**CLI Usage:**
```bash
cli-agent listDirectory --path="src" --recursive=true
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('listDirectory', {
    path: './src',
    recursive: false,
    includeHidden: false,
    sortBy: 'name'
});
```

**Parameters:**
- `path` (string, required) - Directory path to list
- `recursive` (boolean, optional) - Include subdirectories (default: false)
- `includeHidden` (boolean, optional) - Include hidden files (default: false)
- `sortBy` (string, optional) - Sort by: `name`, `size`, `modified`, `type`
- `filter` (string, optional) - File extension filter (e.g., ".js,.ts")

**Returns:**
- Array of file/directory information
- File sizes, modification dates
- Permissions and ownership
- Directory tree structure (if recursive)

**Features:**
- Detailed file metadata
- Flexible filtering
- Multiple sorting options
- Security-conscious path handling

---

## Search Operations

### glob

Find files using glob patterns.

**CLI Usage:**
```bash
cli-agent glob --pattern="**/*.{js,ts}" --path="src"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('glob', {
    pattern: 'src/**/*.{ts,tsx}',
    path: './project',
    ignorePatterns: ['node_modules', '*.test.*']
});
```

**Parameters:**
- `pattern` (string, required) - Glob pattern to match
- `path` (string, optional) - Base directory to search (default: current directory)
- `ignorePatterns` (array, optional) - Patterns to ignore
- `maxResults` (number, optional) - Maximum number of results
- `followSymlinks` (boolean, optional) - Follow symbolic links

**Returns:**
- Array of matching file paths
- Match count
- Search statistics

**Features:**
- Advanced glob syntax support
- Configurable ignore patterns
- Performance optimization for large directories
- Cross-platform path handling

---

### grep

Search for patterns in files using regex.

**CLI Usage:**
```bash
cli-agent grep --pattern="TODO|FIXME" --path="." --outputMode="content"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('grep', {
    pattern: 'function\\s+\\w+\\(',
    path: './src',
    outputMode: 'content',
    contextLines: 2,
    caseInsensitive: true
});
```

**Parameters:**
- `pattern` (string, required) - Regular expression pattern
- `path` (string, required) - File or directory to search
- `outputMode` (string, optional) - `content`, `files_with_matches`, `count` (default: files_with_matches)
- `contextLines` (number, optional) - Lines of context around matches
- `caseInsensitive` (boolean, optional) - Case-insensitive search
- `fileTypes` (array, optional) - File extensions to search
- `excludePatterns` (array, optional) - Patterns to exclude

**Returns:**
- Matching lines or files
- Match context
- Total match count
- Search statistics

**Features:**
- Full regex support
- Context line display
- File type filtering
- Recursive directory search
- Binary file detection and skipping

---

### searchCode

Intelligent code search with semantic understanding.

**CLI Usage:**
```bash
cli-agent searchCode --query="authentication function" --path="src" --fileTypes='["js","ts"]'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('searchCode', {
    query: 'JWT token validation',
    path: './src',
    fileTypes: ['js', 'ts', 'jsx', 'tsx'],
    includeComments: true,
    semanticSearch: true
});
```

**Parameters:**
- `query` (string, required) - Search query (natural language or code patterns)
- `path` (string, required) - Directory to search
- `fileTypes` (array, optional) - File extensions to include
- `includeComments` (boolean, optional) - Search in comments
- `semanticSearch` (boolean, optional) - Use semantic matching
- `maxResults` (number, optional) - Maximum results to return

**Returns:**
- Relevant code matches with context
- Relevance scores
- File locations
- Code snippets with highlighting

**Features:**
- Natural language queries
- Code structure understanding
- Language-specific parsing
- Relevance ranking

---

## Web Operations

### webSearch

Search the web for information.

**CLI Usage:**
```bash
cli-agent webSearch --query="React hooks tutorial" --allowedDomains='["reactjs.org","developer.mozilla.org"]'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('webSearch', {
    query: 'TypeScript best practices 2024',
    allowedDomains: ['typescriptlang.org', 'github.com'],
    blockedDomains: ['spam-site.com'],
    maxResults: 10
});
```

**Parameters:**
- `query` (string, required) - Search query
- `allowedDomains` (array, optional) - Only include results from these domains
- `blockedDomains` (array, optional) - Exclude results from these domains
- `maxResults` (number, optional) - Maximum number of results (default: 10)
- `language` (string, optional) - Search language preference
- `region` (string, optional) - Geographic region for results

**Returns:**
- Search results with titles, URLs, and snippets
- Domain information
- Search metadata
- Relevance scores

**Features:**
- Domain filtering
- Real-time search
- Result ranking
- Spam filtering

---

### webFetch

Fetch content from web URLs.

**CLI Usage:**
```bash
cli-agent webFetch --url="https://api.github.com/repos/microsoft/vscode" --method="GET"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('webFetch', {
    url: 'https://api.example.com/data',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
    },
    body: JSON.stringify({ key: 'value' }),
    timeout: 10000
});
```

**Parameters:**
- `url` (string, required) - URL to fetch
- `method` (string, optional) - HTTP method (GET, POST, PUT, DELETE, etc.)
- `headers` (object, optional) - HTTP headers
- `body` (string, optional) - Request body
- `timeout` (number, optional) - Request timeout in milliseconds
- `followRedirects` (boolean, optional) - Follow HTTP redirects

**Returns:**
- Response body
- Status code
- Response headers
- Request/response timing

**Features:**
- All HTTP methods support
- Custom headers
- Request/response interceptors
- Automatic JSON parsing
- Error handling for network issues

---

### fetchDocumentation

Fetch and process documentation from URLs.

**CLI Usage:**
```bash
cli-agent fetchDocumentation --url="https://nodejs.org/api/fs.html" --format="markdown"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('fetchDocumentation', {
    url: 'https://docs.python.org/3/library/os.html',
    format: 'markdown',
    maxLength: 5000,
    extractSections: ['Functions', 'Classes']
});
```

**Parameters:**
- `url` (string, required) - Documentation URL
- `format` (string, optional) - Output format: `markdown`, `text`, `html`
- `maxLength` (number, optional) - Maximum content length
- `extractSections` (array, optional) - Specific sections to extract
- `includeImages` (boolean, optional) - Include image references
- `cleanupHtml` (boolean, optional) - Remove HTML formatting

**Returns:**
- Processed documentation content
- Extracted sections
- Metadata (title, author, etc.)
- Link references

**Features:**
- Multiple output formats
- Content cleaning and processing
- Section extraction
- Link resolution
- Image handling

---

### enhancedWebSearch

Advanced web search with additional processing.

**CLI Usage:**
```bash
cli-agent enhancedWebSearch --query="machine learning tutorials" --searchDepth="comprehensive"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('enhancedWebSearch', {
    query: 'Vue.js 3 composition API guide',
    searchDepth: 'comprehensive',
    includeCode: true,
    filterDuplicates: true,
    summarizeResults: true
});
```

**Parameters:**
- `query` (string, required) - Search query
- `searchDepth` (string, optional) - `basic`, `detailed`, `comprehensive`
- `includeCode` (boolean, optional) - Include code snippets in results
- `filterDuplicates` (boolean, optional) - Remove duplicate results
- `summarizeResults` (boolean, optional) - AI-generated summary
- `topicFocus` (array, optional) - Focus on specific topics

**Returns:**
- Enhanced search results
- Code snippets and examples
- AI-generated summaries
- Topic categorization
- Relevance scoring

**Features:**
- Multi-stage search process
- Content analysis
- Code extraction
- Result summarization
- Topic clustering

---

## Analysis Operations

### symbolAnalysis

Analyze code symbols (functions, classes, variables) in files.

**CLI Usage:**
```bash
cli-agent symbolAnalysis --filePath="src/main.ts" --analysisType="functions"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('symbolAnalysis', {
    filePath: './src/api/users.js',
    analysisType: 'all',
    includePrivate: false,
    generateDocs: true
});
```

**Parameters:**
- `filePath` (string, required) - File to analyze
- `analysisType` (string, optional) - `functions`, `classes`, `variables`, `all`
- `includePrivate` (boolean, optional) - Include private members
- `generateDocs` (boolean, optional) - Generate documentation
- `outputFormat` (string, optional) - `json`, `markdown`, `text`

**Returns:**
- Symbol definitions and signatures
- Code complexity metrics
- Documentation suggestions
- Dependency analysis
- Code quality indicators

**Features:**
- Multi-language support
- AST-based analysis
- Documentation generation
- Complexity calculation
- Dependency tracking

---

### intelligentTestAnalyzer

Analyze test files and coverage.

**CLI Usage:**
```bash
cli-agent intelligentTestAnalyzer --testPath="tests/" --analysisType="coverage"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('intelligentTestAnalyzer', {
    testPath: './tests',
    analysisType: 'comprehensive',
    includeBenchmarks: true,
    generateReports: true
});
```

**Parameters:**
- `testPath` (string, required) - Path to test files or directory
- `analysisType` (string, optional) - `coverage`, `performance`, `comprehensive`
- `includeBenchmarks` (boolean, optional) - Include performance benchmarks
- `generateReports` (boolean, optional) - Generate detailed reports
- `testFramework` (string, optional) - Specify test framework

**Returns:**
- Test coverage analysis
- Performance metrics
- Test quality assessment
- Missing test identification
- Optimization suggestions

**Features:**
- Multiple test framework support
- Coverage analysis
- Performance profiling
- Quality metrics
- Report generation

---

## Development Operations

### todoWrite

Manage and track project todos and tasks.

**CLI Usage:**
```bash
cli-agent todoWrite --todos='[{"content":"Fix auth bug","status":"pending","activeForm":"Fixing auth bug"}]'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('todoWrite', {
    todos: [
        {
            content: 'Implement user authentication',
            status: 'in_progress',
            activeForm: 'Implementing user authentication',
            priority: 'high'
        },
        {
            content: 'Add unit tests for API endpoints',
            status: 'pending',
            activeForm: 'Adding unit tests for API endpoints',
            priority: 'medium'
        }
    ]
});
```

**Parameters:**
- `todos` (array, required) - Array of todo items
  - `content` (string) - Todo description
  - `status` (string) - `pending`, `in_progress`, `completed`
  - `activeForm` (string) - Present continuous form
  - `priority` (string, optional) - `low`, `medium`, `high`
  - `assignee` (string, optional) - Assigned person
  - `dueDate` (string, optional) - Due date

**Returns:**
- Updated todo list
- Progress tracking
- Status summaries
- Priority analysis

**Features:**
- Status tracking
- Priority management
- Progress visualization
- Team assignment
- Due date management

---

### createExecutionPlan

Create detailed execution plans for development tasks.

**CLI Usage:**
```bash
cli-agent createExecutionPlan --description="Implement OAuth" --requirements='["Setup provider","Add middleware","Create endpoints"]'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('createExecutionPlan', {
    description: 'Refactor authentication system',
    requirements: [
        'Update login flow',
        'Add OAuth support',
        'Implement JWT tokens',
        'Add password reset functionality'
    ],
    constraints: ['Must maintain backward compatibility'],
    timeline: '2 weeks'
});
```

**Parameters:**
- `description` (string, required) - Plan description
- `requirements` (array, required) - List of requirements
- `constraints` (array, optional) - Project constraints
- `timeline` (string, optional) - Expected timeline
- `resources` (array, optional) - Required resources
- `dependencies` (array, optional) - External dependencies

**Returns:**
- Detailed execution plan
- Task breakdown
- Timeline estimation
- Resource allocation
- Risk assessment

**Features:**
- Intelligent task breakdown
- Dependency analysis
- Resource planning
- Risk identification
- Timeline estimation

---

### exitPlanMode

Exit planning mode and summarize the plan.

**CLI Usage:**
```bash
cli-agent exitPlanMode --plan="Complete authentication refactor with OAuth integration"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('exitPlanMode', {
    plan: 'Comprehensive testing strategy implementation',
    nextSteps: [
        'Set up testing framework',
        'Write unit tests',
        'Implement integration tests'
    ],
    summary: 'Ready to begin implementation phase'
});
```

**Parameters:**
- `plan` (string, required) - Plan summary
- `nextSteps` (array, optional) - Immediate next steps
- `summary` (string, optional) - Executive summary

**Returns:**
- Plan confirmation
- Next steps outline
- Implementation roadmap

**Features:**
- Plan validation
- Next step identification
- Implementation guidance

---

## Advanced Operations

### advancedDiff

Generate advanced diffs between files or versions.

**CLI Usage:**
```bash
cli-agent advancedDiff --filePath="src/app.js" --compareWith="HEAD~1" --diffType="unified"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('advancedDiff', {
    filePath: './src/api.js',
    compareWith: 'staging-branch',
    diffType: 'side-by-side',
    contextLines: 5,
    ignoreWhitespace: true
});
```

**Parameters:**
- `filePath` (string, required) - File to compare
- `compareWith` (string, required) - Comparison target (branch, commit, file)
- `diffType` (string, optional) - `unified`, `side-by-side`, `contextual`
- `contextLines` (number, optional) - Context lines around changes
- `ignoreWhitespace` (boolean, optional) - Ignore whitespace changes
- `colorOutput` (boolean, optional) - Colored diff output

**Returns:**
- Formatted diff output
- Change statistics
- File modification summary
- Conflict identification

**Features:**
- Multiple diff formats
- Git integration
- Syntax highlighting
- Change statistics
- Conflict detection

---

### advancedPatch

Apply patches to files with advanced features.

**CLI Usage:**
```bash
cli-agent advancedPatch --patchContent="..." --targetFile="src/app.js" --dryRun=true
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('advancedPatch', {
    patchContent: `
--- a/src/api.js
+++ b/src/api.js
@@ -10,7 +10,7 @@
 function authenticate(req, res, next) {
-  const token = req.headers.authorization;
+  const token = req.headers.authorization?.split(' ')[1];
   if (!token) {
     return res.status(401).json({ error: 'No token provided' });
   }
    `,
    targetFile: './src/api.js',
    dryRun: false,
    backupOriginal: true
});
```

**Parameters:**
- `patchContent` (string, required) - Patch content in unified format
- `targetFile` (string, required) - File to patch
- `dryRun` (boolean, optional) - Test without applying changes
- `backupOriginal` (boolean, optional) - Create backup of original file
- `fuzzyMatching` (boolean, optional) - Allow fuzzy line matching
- `reverseApply` (boolean, optional) - Apply patch in reverse

**Returns:**
- Patch application results
- Modified files list
- Backup locations
- Conflict reports

**Features:**
- Standard patch format support
- Dry run capability
- Automatic backup creation
- Conflict resolution
- Fuzzy matching for changed contexts

---

### computerUse

Interact with the computer interface (screen, mouse, keyboard).

**CLI Usage:**
```bash
cli-agent computerUse --action="screenshot" --coordinates="0,0,1920,1080"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('computerUse', {
    action: 'click',
    coordinates: '100,200',
    element: 'button[data-testid="submit"]',
    waitForElement: true
});
```

**Parameters:**
- `action` (string, required) - Action type: `screenshot`, `click`, `type`, `scroll`, `hover`
- `coordinates` (string, optional) - X,Y coordinates for actions
- `element` (string, optional) - CSS selector for element-based actions
- `text` (string, optional) - Text to type
- `waitForElement` (boolean, optional) - Wait for element to appear
- `timeout` (number, optional) - Action timeout

**Returns:**
- Action result
- Screenshot data (if applicable)
- Element information
- Execution status

**Features:**
- Screen capture
- Element interaction
- Keyboard/mouse simulation
- Wait conditions
- Cross-platform support

---

## Integration Operations

### task

Execute specialized AI tasks using sub-agents.

**CLI Usage:**
```bash
cli-agent task --description="Code security audit" --prompt="Analyze for vulnerabilities" --subagent_type="security-analyst"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('task', {
    description: 'Database schema optimization',
    prompt: 'Analyze the current database schema and suggest optimizations for better performance',
    subagent_type: 'database-expert',
    context: {
        databaseType: 'PostgreSQL',
        tableCount: 25
    }
});
```

**Parameters:**
- `description` (string, required) - Task description
- `prompt` (string, required) - Detailed task prompt
- `subagent_type` (string, required) - Agent type: `code-reviewer`, `security-analyst`, `database-expert`, etc.
- `context` (object, optional) - Additional context for the task
- `priority` (string, optional) - Task priority
- `timeout` (number, optional) - Task timeout

**Returns:**
- AI analysis results
- Recommendations
- Action items
- Confidence scores

**Features:**
- Specialized AI agents
- Context-aware analysis
- Multiple expertise domains
- Structured recommendations

---

### subAgents

Orchestrate multiple sub-agents for complex tasks.

**CLI Usage:**
```bash
cli-agent subAgents --taskType="full-audit" --payload='{"targetPath":"./src","scanTypes":["security","performance"]}'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('subAgents', {
    taskType: 'comprehensive-review',
    payload: {
        codebase: './src',
        frameworks: ['React', 'Node.js'],
        focus: ['performance', 'security', 'maintainability']
    },
    coordination: 'parallel',
    timeout: 300000
});
```

**Parameters:**
- `taskType` (string, required) - Type of coordinated task
- `payload` (object, required) - Task-specific data
- `coordination` (string, optional) - `parallel`, `sequential`, `adaptive`
- `timeout` (number, optional) - Overall timeout
- `agents` (array, optional) - Specific agents to use

**Returns:**
- Aggregated results from all agents
- Coordination summary
- Individual agent reports
- Synthesis and recommendations

**Features:**
- Multi-agent coordination
- Parallel and sequential execution
- Result synthesis
- Conflict resolution
- Performance optimization

---

### mcpIntegration

Integrate with Model Context Protocol (MCP) servers.

**CLI Usage:**
```bash
cli-agent mcpIntegration --server="file-server" --action="list-capabilities"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('mcpIntegration', {
    server: 'database-server',
    action: 'query',
    parameters: {
        query: 'SELECT * FROM users WHERE active = true',
        limit: 100
    },
    timeout: 30000
});
```

**Parameters:**
- `server` (string, required) - MCP server identifier
- `action` (string, required) - Action to perform
- `parameters` (object, optional) - Action-specific parameters
- `timeout` (number, optional) - Request timeout
- `retries` (number, optional) - Number of retry attempts

**Returns:**
- Server response data
- Capability information
- Status details
- Performance metrics

**Features:**
- MCP protocol compliance
- Server capability discovery
- Error handling and retries
- Performance monitoring

---

### hooksManagement

Manage Git hooks and development workflows.

**CLI Usage:**
```bash
cli-agent hooksManagement --hookType="pre-commit" --action="install" --repoPath="."
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('hooksManagement', {
    hookType: 'pre-push',
    action: 'create',
    script: `#!/bin/bash
set -e
npm run test
npm run lint
echo "Pre-push checks passed"`,
    repoPath: './my-project'
});
```

**Parameters:**
- `hookType` (string, required) - Hook type: `pre-commit`, `pre-push`, `post-merge`, etc.
- `action` (string, required) - Action: `install`, `uninstall`, `create`, `list`, `test`
- `script` (string, optional) - Hook script content
- `repoPath` (string, optional) - Repository path
- `force` (boolean, optional) - Force overwrite existing hooks

**Returns:**
- Hook operation results
- Script validation status
- Installation confirmation
- Hook status summary

**Features:**
- All Git hook types support
- Custom script creation
- Hook validation
- Repository detection
- Backup and restore

---

## Notebook Operations

### notebookRead

Read and analyze Jupyter notebooks.

**CLI Usage:**
```bash
cli-agent notebookRead --notebookPath="analysis.ipynb" --format="json"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('notebookRead', {
    notebookPath: './data-analysis.ipynb',
    format: 'structured',
    includeCellOutputs: true,
    extractCode: true
});
```

**Parameters:**
- `notebookPath` (string, required) - Path to notebook file
- `format` (string, optional) - Output format: `json`, `structured`, `markdown`
- `includeCellOutputs` (boolean, optional) - Include cell execution outputs
- `extractCode` (boolean, optional) - Extract code cells separately
- `cellFilter` (string, optional) - Filter by cell type

**Returns:**
- Notebook structure and content
- Cell metadata and outputs
- Code extraction
- Analysis summary

**Features:**
- Multiple output formats
- Cell type filtering
- Output preservation
- Metadata extraction

---

### notebookEdit

Edit Jupyter notebook cells and structure.

**CLI Usage:**
```bash
cli-agent notebookEdit --notebookPath="analysis.ipynb" --cellIndex=0 --newSource="print('Hello World')"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('notebookEdit', {
    notebookPath: './data-analysis.ipynb',
    operation: 'insert',
    cellIndex: 2,
    cellType: 'markdown',
    newSource: '## Data Processing\n\nThis section processes the raw data.'
});
```

**Parameters:**
- `notebookPath` (string, required) - Path to notebook file
- `operation` (string, optional) - `replace`, `insert`, `delete`, `move`
- `cellIndex` (number, required) - Target cell index
- `cellType` (string, optional) - `code`, `markdown`, `raw`
- `newSource` (string, optional) - New cell content
- `metadata` (object, optional) - Cell metadata

**Returns:**
- Edit confirmation
- Updated notebook structure
- Cell modification details

**Features:**
- Cell CRUD operations
- Type conversion
- Metadata management
- Structure preservation

---

### advancedNotebook

Advanced notebook analysis and operations.

**CLI Usage:**
```bash
cli-agent advancedNotebook --notebookPath="analysis.ipynb" --operation="analyze" --analysisType="dependencies"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('advancedNotebook', {
    notebookPath: './ml-model.ipynb',
    operation: 'optimize',
    analysisType: 'comprehensive',
    generateReport: true,
    suggestions: true
});
```

**Parameters:**
- `notebookPath` (string, required) - Path to notebook
- `operation` (string, required) - `analyze`, `optimize`, `validate`, `convert`
- `analysisType` (string, optional) - `dependencies`, `performance`, `comprehensive`
- `generateReport` (boolean, optional) - Generate analysis report
- `suggestions` (boolean, optional) - Include improvement suggestions
- `outputFormat` (string, optional) - Report output format

**Returns:**
- Advanced analysis results
- Performance metrics
- Optimization suggestions
- Quality assessment
- Conversion results

**Features:**
- Dependency analysis
- Performance profiling
- Code quality assessment
- Optimization recommendations
- Format conversion

---

## System Tools

### toolHealing

Debug and repair tool parameter issues.

**CLI Usage:**
```bash
cli-agent toolHealing --originalTool="editFile" --originalParams='{"filePath":"test.txt"}' --healingStrategy="unescape"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('toolHealing', {
    originalTool: 'editFile',
    originalParams: {
        filePath: 'app.js',
        oldString: 'some\\nescaped\\nstring',
        newString: 'corrected string'
    },
    healingStrategy: 'llm_correction',
    errorDetails: 'NoMatchError: oldString not found'
});
```

**Parameters:**
- `originalTool` (string, required) - Tool that failed
- `originalParams` (object, required) - Original parameters that failed
- `healingStrategy` (string, optional) - Strategy: `unescape`, `llm_correction`, `auto`
- `errorDetails` (string, optional) - Error message details
- `fileContent` (string, optional) - File content for context

**Returns:**
- Healed parameters
- Healing strategy applied
- Confidence score
- Explanation of changes made

**Features:**
- Multiple healing strategies
- AI-powered correction
- Context-aware healing
- Healing confidence scoring

---

### toolNormalization

Normalize tool schemas for different model families.

**CLI Usage:**
```bash
cli-agent toolNormalization --toolName="readFile" --modelFamily="claude-3" --inputSchema='{"type":"object"}'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('toolNormalization', {
    toolName: 'editFile',
    modelFamily: 'gpt-4',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: { type: 'string' },
            oldString: { type: 'string' }
        }
    },
    optimizeForModel: true
});
```

**Parameters:**
- `toolName` (string, required) - Tool to normalize
- `modelFamily` (string, required) - Target model family
- `inputSchema` (object, required) - Original tool schema
- `optimizeForModel` (boolean, optional) - Apply model-specific optimizations
- `validationLevel` (string, optional) - Validation strictness

**Returns:**
- Normalized schema
- Applied transformations
- Compatibility notes
- Validation results

**Features:**
- Multi-model compatibility
- Schema optimization
- Validation enhancement
- Transformation tracking

---

This comprehensive tools reference covers all 30+ built-in tools available in the CLI Agent system. Each tool is designed for specific use cases and can be used both via CLI commands and programmatically through the SDK.