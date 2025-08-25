/*---------------------------------------------------------------------------------------------
 * Basic Usage Examples - How to use CLI Agent tools in LangGraph projects
 * 
 * These examples show how to import and use your 30+ tools in external LangGraph projects
 *--------------------------------------------------------------------------------------------*/

// Example 1: Using all tools in a LangGraph project
/*
// In your external LangGraph project:
import { CLIAgentTools } from 'path/to/cli-agent/src/bridge/langGraphBridge';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from '@langchain/langgraph';

// Get all CLI Agent tools
const tools = CLIAgentTools.getAllTools({
    workingDirectory: '/path/to/your/project',
    enableLogging: true
});

const model = new ChatOpenAI({ temperature: 0 });
const checkpointer = new MemorySaver();

const agent = createReactAgent({
    llm: model,
    tools: tools,  // Your 30+ tools ready to use!
    checkpointer: checkpointer
});

// Use the agent
const result = await agent.invoke({
    messages: [{ role: 'user', content: 'Read the package.json file and analyze the dependencies' }]
}, { configurable: { thread_id: '1' } });
*/

// Example 2: Using only file operation tools
/*
import { CLIAgentTools } from 'path/to/cli-agent/src/bridge/langGraphBridge';

const fileTools = CLIAgentTools.getFileTools({
    workingDirectory: './my-project'
});

const agent = createReactAgent({
    llm: model,
    tools: fileTools,  // Only file-related tools
    checkpointer: checkpointer
});
*/

// Example 3: Using specific tools by name
/*
import { CLIAgentTools } from 'path/to/cli-agent/src/bridge/langGraphBridge';

const bridge = CLIAgentTools.createBridge({
    workingDirectory: './workspace',
    enableLogging: true
});

const specificTools = bridge.getToolsByName([
    'read_file',
    'write_file',
    'search_code',
    'grep',
    'bash'
]);

const agent = createReactAgent({
    llm: model,
    tools: specificTools,
    checkpointer: checkpointer
});
*/

// Example 4: Custom workflow with StateGraph
/*
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { CLIAgentTools } from 'path/to/cli-agent/src/bridge/langGraphBridge';

// Get development tools only
const devTools = CLIAgentTools.getDevTools();

// Create custom workflow
const workflow = new StateGraph(MessagesAnnotation)
    .addNode('analyze', async (state) => {
        // Use search_code tool to find functions
        const searchTool = devTools.find(tool => tool.name === 'search_code');
        const result = await searchTool!.func({
            query: 'function',
            search_type: 'function',
            max_results: 10
        });
        
        return {
            messages: state.messages.concat([
                { role: 'assistant', content: `Found functions: ${result}` }
            ])
        };
    })
    .addNode('document', async (state) => {
        // Use write_file tool to create documentation
        const writeTool = devTools.find(tool => tool.name === 'write_file');
        await writeTool!.func({
            filePath: 'functions-analysis.md',
            content: 'Function analysis results...'
        });
        
        return {
            messages: state.messages.concat([
                { role: 'assistant', content: 'Documentation created successfully!' }
            ])
        };
    })
    .addEdge('__start__', 'analyze')
    .addEdge('analyze', 'document');

const app = workflow.compile();
*/

// Example 5: Error handling and monitoring
/*
import { CLIAgentTools, LangGraphBridge } from 'path/to/cli-agent/src/bridge/langGraphBridge';

const bridge = new LangGraphBridge({
    workingDirectory: './project',
    enableLogging: true,
    timeout: 10000  // 10 second timeout
});

// Get tools with error handling
const tools = bridge.getAllTools();

// Monitor execution stats
const agent = createReactAgent({
    llm: model,
    tools: tools,
    checkpointer: checkpointer
});

// After some executions
const stats = bridge.getExecutionStats();
console.log('Tool execution stats:', stats);
*/

// Example 6: Integration with human-in-the-loop
/*
import { interrupt } from '@langchain/langgraph';
import { CLIAgentTools } from 'path/to/cli-agent/src/bridge/langGraphBridge';

const tools = CLIAgentTools.getAllTools();

const workflow = new StateGraph(MessagesAnnotation)
    .addNode('read_files', async (state) => {
        const readTool = tools.find(tool => tool.name === 'read_file');
        const content = await readTool!.func({ filePath: 'sensitive-config.json' });
        
        return { 
            messages: state.messages.concat([
                { role: 'assistant', content: content }
            ])
        };
    })
    .addNode('human_approval', async (state) => {
        const approved = interrupt({
            question: 'Should I proceed with modifying this sensitive file?',
            file_content: state.messages[state.messages.length - 1].content
        });
        
        return { approved };
    })
    .addNode('modify_file', async (state) => {
        if (state.approved) {
            const editTool = tools.find(tool => tool.name === 'edit_file');
            await editTool!.func({
                filePath: 'sensitive-config.json',
                oldText: '"debug": false',
                newText: '"debug": true'
            });
        }
        
        return {
            messages: state.messages.concat([
                { role: 'assistant', content: 'File modification completed!' }
            ])
        };
    });
*/

export const examples = {
    basicUsage: 'See comments above for basic usage examples',
    fileOperations: 'File-specific tools usage',
    customWorkflows: 'StateGraph with CLI Agent tools',
    errorHandling: 'Error handling and monitoring',
    humanInTheLoop: 'Integration with human approval workflows'
};

// Type definitions for external projects
export interface LangGraphProjectSetup {
    tools: any[];
    model: any;
    checkpointer: any;
    agent: any;
}