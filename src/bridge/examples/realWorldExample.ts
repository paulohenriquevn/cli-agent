/*---------------------------------------------------------------------------------------------
 * Real World Example - Complete code analysis and documentation workflow
 * 
 * This example shows a practical use case: analyzing a codebase and generating documentation
 * using CLI Agent tools within a LangGraph workflow.
 *--------------------------------------------------------------------------------------------*/

// This example demonstrates how CLI Agent tools can be integrated into LangGraph workflows
// The actual implementation would be in an external LangGraph project

export const realWorldWorkflowExample = {
    description: 'Documentation generation workflow using CLI Agent tools',
    
    tools_used: [
        'ls - List project files',
        'glob - Find code files by pattern', 
        'read_file - Read package.json and config files',
        'search_code - Find functions, classes, imports',
        'grep - Search for TODO/FIXME comments',
        'write_file - Generate documentation files'
    ],
    
    workflow_steps: [
        '1. Analyze project structure with ls and glob tools',
        '2. Read configuration files with read_file',
        '3. Search for code patterns with search_code', 
        '4. Find TODO items with grep',
        '5. Generate documentation with write_file',
        '6. Create summary report'
    ],
    
    example_usage: `
    // In an external LangGraph project:
    import { CLIAgentTools } from 'path/to/cli-agent/src/bridge';
    import { createReactAgent } from '@langchain/langgraph/prebuilt';
    
    const tools = CLIAgentTools.getAllTools({
        workingDirectory: './target-project'
    });
    
    const agent = createReactAgent({
        llm: model,
        tools: tools,
        checkpointer: checkpointer
    });
    
    // The agent can now use all 30+ CLI Agent tools
    const result = await agent.invoke({
        messages: [{ 
            role: 'user', 
            content: 'Analyze this codebase and generate documentation' 
        }]
    });
    `,
    
    workflow_benefits: [
        'Automated project analysis',
        'Comprehensive documentation generation', 
        'Code pattern detection',
        'Technical debt identification',
        'Multi-format output generation'
    ]
};

export const integrationPatterns = {
    react_agent: 'Use with createReactAgent for autonomous tool usage',
    state_graph: 'Build custom workflows with StateGraph',
    human_in_loop: 'Add human approval steps with interrupt()',
    batch_processing: 'Process multiple files in parallel',
    error_handling: 'Robust error handling with try/catch patterns'
};

export const toolCategories = {
    file_operations: ['read_file', 'write_file', 'edit_file', 'multi_edit', 'ls'],
    search_analysis: ['grep', 'glob', 'search_code', 'symbol_analysis'],
    system_commands: ['bash', 'execute_command'],
    web_integration: ['web_search', 'web_fetch', 'fetch_documentation'],
    development: ['test_analyzer', 'advanced_diff', 'todo_write'],
    notebooks: ['notebook_read', 'notebook_edit', 'advanced_notebook'],
    integrations: ['task', 'mcp_integration', 'computer_use']
};

console.log('Real-world example configuration loaded - Ready for LangGraph integration!');