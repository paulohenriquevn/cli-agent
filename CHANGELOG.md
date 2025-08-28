# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.2] - 2025-01-27

### 🧪 Test Suite Fixes
- **Fixed test suite to account for 29 tools** (including Memory Tool):
  - Updated `fixed-tools-integration.test.ts` to expect 29 tools
  - Updated `non-refactored-tools.test.ts` refactoring progress counter
  - Corrected refactored tools count to 15 (including Memory Tool)
  - All integration tests now passing

### 📊 Current Tool Status
- **Total Tools**: 29
- **Refactored Tools**: 15 (52% completion)
- **Remaining to Refactor**: 14
- **Latest Addition**: Memory Tool with comprehensive unit tests

---

## [2.1.1] - 2025-01-27

### 🧪 Testing & Quality Improvements
- **Added comprehensive unit tests for Memory Tool**:
  - 19 test cases covering all functionality
  - Basic memory saving and retrieval
  - Edge cases (empty facts, whitespace, long content)
  - Priority levels and metadata handling
  - Tags and categories validation
  - File management scenarios
  - Schema validation tests
  - Error handling verification

### 🔧 Bug Fixes
- **Fixed CliErrorPart and CliTextPart types**:
  - Added missing `type` property for proper error detection
  - Added `text` getter for consistent API
  - Improved error handling in tool execution
  - Better integration with IToolResult interface

### 📊 Test Coverage
- Memory Tool: 100% coverage with 19 test cases
- All edge cases properly handled
- Error scenarios thoroughly tested
- OpenAI schema compatibility validated

---

## [2.1.0] - 2025-01-27

### 🧠 NEW FEATURE - Memory Tool
- **Added Memory Tool (`save_memory`)** for persistent information storage:
  - Automatically creates and manages `agent.md` file in workspace
  - Saves important facts, preferences, and project information
  - Supports categorization with custom categories
  - Priority levels: low, medium, high
  - Tag system for better organization
  - Project association for multi-project workflows
  - Unique fact IDs with timestamps
  - Auto-formatting with markdown structure

### ✨ Memory Tool Features
- **Persistent Context**: Information saved across conversations
- **Smart File Management**: Auto-detects existing agent files (`agent.md`, `.agent.md`, `context.md`, etc.)
- **Rich Metadata**: Categories, priorities, tags, and project associations
- **Error Handling**: Robust error handling with clear feedback
- **OpenAI Compatible**: Full compatibility with OpenAI Function Calling

### 🎯 Use Cases
- Save user preferences and coding standards
- Remember project configurations and decisions
- Store important architectural patterns
- Keep track of best practices and guidelines
- Maintain context across development sessions

### 📝 Example Usage
```typescript
// Basic memory saving
await CLIAgentTools.executeTool('save_memory', {
    fact: 'User prefers TypeScript over JavaScript'
});

// With metadata
await CLIAgentTools.executeTool('save_memory', {
    fact: 'Project uses React 18 with strict mode',
    category: 'project-config',
    priority: 'high',
    project: 'my-app',
    tags: ['react', 'config', 'strict-mode']
});
```

### 📊 Updated Stats
- **Total Tools**: 29 (added Memory Tool)
- **New Category**: memory-management
- **New Tags**: memory, persistence, context

---

## [2.0.2] - 2025-01-27

### 🧹 Cleanup
- **Removed all remaining LangChain references and dependencies**:
  - Removed `package-sdk.json` with old LangChain references
  - Removed `LangGraph.txt` documentation file
  - Uninstalled extraneous LangChain packages: `@langchain/core`, `@langchain/langgraph`, etc.
  - Clean package-lock.json regenerated without LangChain dependencies
  - **Package is now 100% LangChain-free**

### 📦 Package Improvements
- Reduced package size further by removing unused dependencies
- Clean dependency tree with no extraneous packages
- Faster installation with fewer transitive dependencies

---

## [2.0.1] - 2025-01-27

### 🚀 Added
- **Critical missing functionality implementation**:
  - `IToolResult` interface with `hasErrors()`, `getErrors()`, `getText()` methods
  - `ToolResult` concrete class implementation
  - `CLIAgentTools.executeTool()` now returns proper `IToolResult`
  - Full OpenAI Function Calling compatibility for all 28 tools

### ✅ Fixed
- **CRITICAL**: Fixed `CLIAgentTools.executeTool()` method to return `IToolResult` instead of raw CLI results
- **CRITICAL**: Added missing `IToolResult` interface methods required for tool execution
- Improved error handling in tool execution with proper `IToolResult` conversion
- Fixed TypeScript imports in main index file

### 🧪 Tested
- All 28 tools verified working with new API
- OpenAI Function Calling compatibility tested and confirmed
- Error handling verified for both success and failure cases
- Complete SDK functionality validated

### 📝 Technical Details
- `IToolResult` interface provides consistent API for all tool results
- `hasErrors()`: Returns boolean indicating if tool execution had errors
- `getErrors()`: Returns array of error messages
- `getText()`: Returns formatted text output from tool execution
- All existing tools maintain full compatibility with OpenAI Function Calling format

---

## [2.0.0] - 2025-01-27

### 🚨 MAJOR RELEASE - Complete Architecture Overhaul

This release introduces a **fundamental architectural change** that completely simplifies the SDK by removing all framework dependencies and wrappers. **This is a major breaking change that requires code migration.**

### 🎯 **Philosophy Change**

- **Before (v1.x)**: Complex bridge system with framework-specific conversions
- **After (v2.0.0)**: Pure CLI tools with direct access, zero dependencies

### 💥 **Breaking Changes**

#### **Removed Components**
- ❌ **SDKBridge** class - Complex bridge system eliminated
- ❌ **SDKLangGraph** class - Framework-specific wrapper removed
- ❌ **LangChainToolWrapper** - Conversion layer removed
- ❌ **FrameworkToolWrapper** - Generic wrapper removed
- ❌ **All framework interfaces** - LangChainToolInterface, FrameworkToolInterface
- ❌ **All framework dependencies** - @langchain/core no longer required

#### **Architecture Changes**
```typescript
// ❌ OLD (v1.x) - Complex bridge system
const bridge = new SDKBridge(config);
const tools = bridge.getAllTools(); // Returns DynamicStructuredTool[]

// ✅ NEW (v2.0.0) - Direct tool access
const tools = CLIAgentTools.getAllTools(); // Returns BaseTool[]
```

### ✨ **Added**

#### **Simplified API**
- **Direct tool access** - No wrappers, no conversions, no complexity
- **CLIAgentTools** - Simple static class for tool discovery and execution
- **ToolRegistry** - Direct registry access for advanced usage
- **Zero dependencies** - Pure TypeScript implementation

#### **New Features**
- **Framework-agnostic** - Works with any AI framework
- **Better performance** - No conversion overhead
- **Smaller bundle** - Significantly reduced package size
- **Easier testing** - Direct tool mocking and testing

### 🔄 **Changed**

#### **Tool Discovery**
```typescript
// ❌ OLD (v1.x)
const bridge = new SDKBridge({ includeCategories: ['file_operations'] });
const tools = bridge.getAllTools();

// ✅ NEW (v2.0.0)
const tools = CLIAgentTools.getFileTools();
```

#### **Tool Execution**
```typescript
// ❌ OLD (v1.x) - Framework wrapped
const result = await bridge.executeTool('read_file', { filePath: './file.txt' });

// ✅ NEW (v2.0.0) - Direct execution
const result = await CLIAgentTools.executeTool('read_file', { filePath: './file.txt' });
```

#### **Error Handling**
```typescript
// ❌ OLD (v1.x) - Bridge result format
if (!result.success) {
    console.error(result.error);
}

// ✅ NEW (v2.0.0) - CLI result format
if (result.hasErrors()) {
    console.error(result.getErrors().join(', '));
}
```

### 🗑️ **Removed**

#### **Dependencies**
- Removed `@langchain/core` from dependencies
- Removed `@langchain/langgraph` from peerDependencies
- Package is now completely self-contained

#### **Configuration**
- Removed complex bridge configuration
- No more centralized SDK configuration
- Configuration is now per-tool execution (when needed)

### 🎯 **Benefits**

#### **What You Gain**
1. **Zero Dependencies** - No external framework requirements
2. **Simpler API** - Direct tool access without layers
3. **Better Performance** - No conversion overhead
4. **Framework Freedom** - Use with any AI framework
5. **Smaller Bundle** - Reduced package size by ~60%
6. **Easier Testing** - Direct tool access and mocking

#### **What You Need to Change**
1. **Import statements** - Remove bridge imports
2. **Tool discovery** - Use CLIAgentTools static methods
3. **Tool execution** - Direct tool calls or CLIAgentTools.executeTool
4. **Error handling** - CLI result format instead of bridge format
5. **Framework integration** - Manual conversion if needed

### 📋 **Migration Guide**

#### **Step 1: Update Package**
```bash
npm install @paulohenriquevn/sdkagent@^2.0.0
# Remove LangChain dependencies if not used elsewhere
npm uninstall @langchain/core @langchain/langgraph
```

#### **Step 2: Update Imports**
```typescript
// ❌ REMOVE
import { SDKBridge, SDKLangGraph } from '@paulohenriquevn/sdkagent';

// ✅ ADD
import { CLIAgentTools, ToolRegistry, BaseTool } from '@paulohenriquevn/sdkagent';
```

#### **Step 3: Replace Bridge Usage**
```typescript
// ❌ OLD
const bridge = new SDKBridge(config);
const tools = bridge.getAllTools();

// ✅ NEW
const tools = CLIAgentTools.getAllTools();
```

#### **Step 4: Update Tool Execution**
```typescript
// ❌ OLD
const result = await bridge.executeTool('read_file', input);

// ✅ NEW
const result = await CLIAgentTools.executeTool('read_file', input);
```

### 🛠️ **Framework Integration Examples**

#### **LangChain (Manual Conversion)**
```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';

const cliTools = CLIAgentTools.getAllTools();
const langchainTools = cliTools.map(tool => new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: tool.inputSchema,
    func: async (input) => {
        const result = await tool.invoke({ input, toolName: tool.name, context }, token);
        return result.hasErrors() ? 
            Promise.reject(new Error(result.getErrors().join('; '))) : 
            result.getText();
    }
}));
```

#### **OpenAI Function Calling**
```typescript
const tools = CLIAgentTools.getAllTools();
const openaiTools = tools.map(tool => ({
    type: "function",
    function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
    }
}));
```

### 📚 **Documentation**

- **BREAKING-CHANGES.md** - Detailed breaking changes documentation
- **MIGRATION-GUIDE.md** - Complete step-by-step migration guide
- **README.md** - Updated with new v2.0.0 examples and patterns
- **Package size reduced** - From ~2MB to ~800KB

---

## [1.2.0] - 2025-01-26 (DEPRECATED)

### 🚀 MAJOR RELEASE - LangChain Compatibility Overhaul

**⚠️ DEPRECATED**: This version is deprecated in favor of v2.0.0 which removes framework dependencies entirely.

This release completely overhauled the LangChain integration following KISS, FAST-FAIL, and DRY principles. **This was a breaking change that improved reliability and type safety.**

### ✨ Added

#### **New Architecture**
- **`LangChainToolWrapper`** - New dedicated class for clean CLI-to-LangChain conversion
- **Strict TypeScript types** - All functions returned `DynamicStructuredTool[]` instead of `unknown[]`
- **Real DynamicStructuredTool instances** - No more mock objects or type casting
- **FAST-FAIL error handling** - Immediate validation with clear error messages
- **Centralized configuration** - DRY principle applied with `TOOL_CONSTANTS`

#### **Enhanced Error Handling**
- Tools threw meaningful exceptions instead of returning error strings
- Input validation happened immediately at function entry
- Clear error messages with tool names and specific failure reasons
- Timeout protection with proper cancellation tokens

### 🔄 Changed

#### **Type System Overhaul**
```typescript
// BEFORE (v1.1.x)
CLIAgentTools.getAllTools(): unknown[]

// AFTER (v1.2.0)
CLIAgentTools.getAllTools(): DynamicStructuredTool[]
```

### 🔧 Fixed
- **Schema validation errors** - No more runtime errors
- **Type casting issues** - Eliminated all `as any` type casting
- **Runtime failures** - Tools failed gracefully with proper error handling

---

## [1.1.x] - 2025-01-25 (DEPRECATED)

### Added
- Initial LangChain compatibility layer
- Basic DynamicStructuredTool creation

### Known Issues (Fixed in later versions)
- Type casting with `as any` 
- Schema undefined errors
- Mock objects instead of real DynamicStructuredTool instances

---

## Migration Resources

- **📖 Complete Migration Guide**: See `MIGRATION-GUIDE.md`
- **🚨 Breaking Changes**: See `BREAKING-CHANGES.md` 
- **📚 New Documentation**: Updated `README.md`
- **💬 Support**: [GitHub Issues](https://github.com/paulohenriquevn/sdkagent/issues)

---

**The v2.0.0 release represents a fundamental improvement in simplicity, performance, and flexibility. While it requires migration from previous versions, the result is a much cleaner and more maintainable SDK that works with any AI framework without dependencies.**