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
  - [computer_use](#computer_use)
  - [advanced_diff](#advanced_diff)
  - [advanced_patch](#advanced_patch)
  - [advanced_notebook](#advanced_notebook)
- [Integration Operations](#integration-operations)
- [Notebook Operations](#notebook-operations)

---

## File Operations

### read_file

Read contents from a file.

**CLI Usage:**
```bash
cli-agent read_file --filePath="path/to/file.txt"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('read_file', {
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

### write_file

Write content to a file.

**CLI Usage:**
```bash
cli-agent write_file --filePath="output.txt" --content="Hello World"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('write_file', {
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

### edit_file

Edit a file by replacing specific text content.

**CLI Usage:**
```bash
cli-agent edit_file --filePath="src/app.js" --oldText="var x = 1;" --newText="const x = 1;"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('edit_file', {
    filePath: './src/app.js',
    oldText: 'console.log("debug")',
    newText: '// Debug removed',
    replaceAll: false
});
```

**Parameters:**
- `filePath` (string, required) - Path to the file to edit
- `oldText` (string, required) - Text to find and replace
- `newText` (string, required) - Replacement text
- `replaceAll` (boolean, optional) - Replace all occurrences (default: false)

**Returns:**
- Number of replacements made
- Before/after content preview
- File modification confirmation

**Features:**
- **Automatic healing** - If `oldText` doesn't match exactly, AI corrects it
- Exact match validation
- Multiple replacement strategies
- Undo capability

---

### multi_edit

Perform multiple edits on a single file in one operation.

**CLI Usage:**
```bash
cli-agent multi_edit --file_path="src/app.js" --edits='[{"old_string":"var","new_string":"const"},{"old_string":"function","new_string":"const"}]'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('multi_edit', {
    file_path: './src/app.js',
    edits: [
        {
            old_string: 'var apiUrl = "localhost"',
            new_string: 'const apiUrl = process.env.API_URL'
        },
        {
            old_string: 'var port = 3000',
            new_string: 'const port = process.env.PORT || 3000'
        }
    ]
});
```

**Parameters:**
- `file_path` (string, required) - Path to the file to edit
- `edits` (array, required) - Array of edit operations
  - `old_string` (string) - Text to find
  - `new_string` (string) - Replacement text
  - `replace_all` (boolean, optional) - Replace all occurrences

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

### text_editor

Advanced text manipulation operations.

**CLI Usage:**
```bash
cli-agent text_editor --path="README.md" --command="str_replace" --old_str="old text" --new_str="new text"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('text_editor', {
    path: './README.md',
    command: 'str_replace',
    old_str: 'old text',
    new_str: 'new text'
});
```

**Parameters:**
- `path` (string, required) - Path to the file
- `command` (string, required) - Command type: `view`, `str_replace`, `create`
- `old_str` (string) - Text to find (for str_replace)
- `new_str` (string) - Replacement text (for str_replace)
- `content` (string) - Content for create operations

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

### execute_command

Execute system commands with output capture.

**CLI Usage:**
```bash
cli-agent execute_command --command="npm test" --workingDirectory="/project"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('execute_command', {
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

### bash

Execute bash scripts with enhanced features.

**CLI Usage:**
```bash
cli-agent bash --command="echo 'Hello' && pwd && date"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('bash', {
    command: `
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

### ls

List contents of a directory with detailed information.

**CLI Usage:**
```bash
cli-agent ls --path="src"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('ls', {
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

### search_code

Intelligent code search with semantic understanding.

**CLI Usage:**
```bash
cli-agent search_code --query="authentication function" --path="src" --fileTypes='["js","ts"]'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('search_code', {
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

### web_search

Search the web for information.

**CLI Usage:**
```bash
cli-agent web_search --query="React hooks tutorial" --allowedDomains='["reactjs.org","developer.mozilla.org"]'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('web_search', {
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

### web_fetch

Fetch content from web URLs.

**CLI Usage:**
```bash
cli-agent web_fetch --url="https://api.github.com/repos/microsoft/vscode" --method="GET"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('web_fetch', {
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

### fetch_documentation

Fetch and process documentation from URLs.

**CLI Usage:**
```bash
cli-agent fetch_documentation --url="https://nodejs.org/api/fs.html" --format="markdown"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('fetch_documentation', {
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

### enhanced_web_search

Advanced web search with additional processing.

**CLI Usage:**
```bash
cli-agent enhanced_web_search --query="machine learning tutorials" --searchDepth="comprehensive"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('enhanced_web_search', {
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

### symbol_analysis

Analyze code symbols with intelligent navigation and usage analysis.

**CLI Usage:**
```bash
cli-agent symbol_analysis --action="find_usages" --symbol_name="authenticate" --file_paths='["src/main.ts"]' --include_tests=true
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('symbol_analysis', {
    action: 'find_usages',
    symbol_name: 'authenticate',
    file_paths: ['./src/api/users.js', './src/auth.js'],
    include_tests: false,
    max_results: 100,
    search_scope: 'project'
});
```

**Parameters:**
- `action` (string, required) - `find_usages`, `find_definitions`, `find_implementations`, `analyze_symbol`, `find_references`
- `symbol_name` (string, required) - Name of the symbol to analyze
- `file_paths` (array, optional) - Specific files to search in
- `include_tests` (boolean, optional) - Include test files in analysis
- `max_results` (number, optional) - Maximum number of results to return
- `search_scope` (string, optional) - `workspace`, `project`, `file`

**Returns:**
- Symbol locations (definitions, references, implementations)
- Usage patterns and analysis
- Code snippets with context
- Refactoring safety assessment
- Recommendations for code improvements

**Features:**
- Multi-language support
- Intelligent symbol navigation
- Usage pattern analysis
- Refactoring safety scoring
- Context-aware recommendations

---

### test_analyzer

Analyze test files and coverage.

**CLI Usage:**
```bash
cli-agent test_analyzer --action="analyze_failures" --test_output="Test failed: assertion error" --testPath="tests/"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('test_analyzer', {
    action: 'analyze_failures',
    test_output: 'Test failed: assertion error in auth.test.js',
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

### todo_write

Manage and track project todos and tasks.

**CLI Usage:**
```bash
cli-agent todo_write --todos='[{"content":"Fix auth bug","status":"pending","activeForm":"Fixing auth bug"}]'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('todo_write', {
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

### create_execution_plan

Create detailed execution plans for development tasks.

**CLI Usage:**
```bash
cli-agent create_execution_plan --description="Implement OAuth" --tasks='[{"content":"Setup provider","status":"pending","priority":"high","id":"1"},{"content":"Add middleware","status":"pending","priority":"medium","id":"2"}]'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('create_execution_plan', {
    description: 'Refactor authentication system',
    tasks: [
        {content: 'Update login flow', status: 'pending', priority: 'high', id: '1'},
        {content: 'Add OAuth support', status: 'pending', priority: 'medium', id: '2'},
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

### exit_plan_mode

Exit planning mode and summarize the plan.

**CLI Usage:**
```bash
cli-agent exit_plan_mode --plan="Complete authentication refactor with OAuth integration"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('exit_plan_mode', {
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

### computer_use

Control the desktop with mouse clicks, keyboard input, and screen capture (like Claude Computer Use).

**CLI Usage:**
```bash
cli-agent computer_use --action="screenshot"
cli-agent computer_use --action="left_click" --coordinate="[300,400]"
cli-agent computer_use --action="type" --text="Hello World"
```

**SDK Usage:**
```typescript
// Take a screenshot
const result = await sdk.executeTool('computer_use', {
    action: 'screenshot'
});

// Click at coordinates
const clickResult = await sdk.executeTool('computer_use', {
    action: 'left_click',
    coordinate: [300, 400]
});

// Type text
const typeResult = await sdk.executeTool('computer_use', {
    action: 'type',
    text: 'Hello World!'
});

// Press a key
const keyResult = await sdk.executeTool('computer_use', {
    action: 'key',
    key: 'Ctrl+C'
});
```

**Parameters:**
- `action` (string, required) - Desktop action: `screenshot`, `left_click`, `right_click`, `middle_click`, `double_click`, `triple_click`, `type`, `key`, `scroll`, `mouse_move`, `left_click_drag`
- `coordinate` (array, optional) - [x, y] coordinates for mouse actions
- `text` (string, optional) - Text to type (for `type` action)
- `key` (string, optional) - Key to press (for `key` action)
- `scroll_direction` (string, optional) - Direction: `up`, `down`, `left`, `right`
- `scroll_amount` (number, optional) - Amount to scroll
- `drag_to` (array, optional) - [x, y] coordinates for drag destination

**Returns:**
- Screenshot image data (for screenshot action)
- Action confirmation and results
- Coordinate information
- Error details if action fails

**Features:**
- Cross-platform support (Windows, macOS, Linux)
- Screen capture capabilities
- Mouse control (clicks, drags, movements)
- Keyboard input (text typing, key combinations)
- Scrolling support
- Visual feedback

**Note:** Requires a display environment (GUI). Will fail in headless environments.

---

### advanced_diff

Generate advanced diffs between files, text, or apply patches with detailed analysis.

**CLI Usage:**
```bash
cli-agent advanced_diff --action="compare_files" --file_path_1="src/app.js" --file_path_2="src/app.backup.js" --context_lines=3
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('advanced_diff', {
    action: 'compare_files',
    file_path_1: './src/api/users.js',
    file_path_2: './src/api/users.backup.js',
    context_lines: 5,
    ignore_whitespace: true,
    algorithm: 'myers'
});

// Compare text directly
const textResult = await sdk.executeTool('advanced_diff', {
    action: 'compare_text',
    text_1: 'Hello world',
    text_2: 'Hello universe',
    ignore_case: false
});
```

**Parameters:**
- `action` (string, required) - `compare_files`, `compare_text`, `analyze_changes`, `generate_patch`, `merge_changes`
- `file_path_1` (string, optional) - Path to the first file
- `file_path_2` (string, optional) - Path to the second file
- `text_1` (string, optional) - First text content to compare
- `text_2` (string, optional) - Second text content to compare
- `patch_content` (string, optional) - Patch content for merge operations
- `context_lines` (number, optional) - Number of context lines to include
- `ignore_whitespace` (boolean, optional) - Ignore whitespace differences
- `ignore_case` (boolean, optional) - Ignore case differences
- `algorithm` (string, optional) - `myers`, `patience`, `histogram`

**Returns:**
- Detailed diff output with line numbers
- Change statistics and analysis
- Patch format generation
- Conflict identification and resolution

**Features:**
- Multiple diff algorithms
- File and text comparison
- Patch generation and application
- Advanced filtering options
- Detailed change analysis

---

### advanced_patch

Apply patches to files with advanced V4A format support and intelligent healing.

**CLI Usage:**
```bash
cli-agent advanced_patch --patch="..." --explanation="Fix authentication token parsing" --dry_run=true
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('advanced_patch', {
    patch: `
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
    explanation: 'Fix authentication token parsing to handle Bearer tokens',
    dry_run: false,
    auto_heal: true
});
```

**Parameters:**
- `patch` (string, required) - Patch content in V4A format
- `explanation` (string, optional) - Description of what the patch does
- `auto_heal` (boolean, optional) - Enable automatic healing if patch fails
- `dry_run` (boolean, optional) - Test without applying changes

**Returns:**
- Patch application results
- Modified files list  
- Healing information (if auto_heal enabled)
- Detailed change summary

**Features:**
- V4A patch format support
- Intelligent auto-healing
- Dry-run mode for testing
- Detailed application feedback

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

### sub_agents

Orchestrate multiple sub-agents for complex tasks.

**CLI Usage:**
```bash
cli-agent sub_agents --taskType="full-audit" --payload='{"targetPath":"./src","scanTypes":["security","performance"]}'
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('sub_agents', {
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

### mcp_integration

Integrate with Model Context Protocol (MCP) servers.

**CLI Usage:**
```bash
cli-agent mcp_integration --server="file-server" --action="list-capabilities"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('mcp_integration', {
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

### hooks_management

Manage Git hooks and development workflows.

**CLI Usage:**
```bash
cli-agent hooks_management --hookType="pre-commit" --action="install" --repoPath="."
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('hooks_management', {
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

### notebook_read

Read and analyze Jupyter notebooks.

**CLI Usage:**
```bash
cli-agent notebook_read --notebook_path="analysis.ipynb" --format="json"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('notebook_read', {
    notebook_path: './data-analysis.ipynb',
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

### notebook_edit

Edit Jupyter notebook cells and structure.

**CLI Usage:**
```bash
cli-agent notebook_edit --notebook_path="analysis.ipynb" --edit_mode="replace" --cell_id="1" --new_source="print('Hello World')" --cell_type="code"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('notebook_edit', {
    notebook_path: './data-analysis.ipynb',
    edit_mode: 'insert',
    cell_id: '2',
    cell_type: 'markdown',
    new_source: '## Data Processing\n\nThis section processes the raw data.'
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

### advanced_notebook

Advanced notebook analysis and operations.

**CLI Usage:**
```bash
cli-agent advanced_notebook --notebookPath="analysis.ipynb" --operation="analyze" --analysisType="dependencies"
```

**SDK Usage:**
```typescript
const result = await sdk.executeTool('advanced_notebook', {
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

This comprehensive tools reference covers all 30+ built-in tools available in the CLI Agent system. Each tool is designed for specific use cases and can be used both via CLI commands and programmatically through the SDK.