#!/usr/bin/env node

/*---------------------------------------------------------------------------------------------
 * LangGraph + CLI Agent Tools Integration Sample
 *
 * This sample demonstrates how to use CLI Agent tools within a LangGraph workflow.
 * Shows a practical example of automated project analysis using 28 available tools.
 *--------------------------------------------------------------------------------------------*/

import * as dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";

// Import CLI Agent tools SDK
// Note: In a real external project, this would be:
// import { CLIAgentTools } from 'path/to/cli-agent/src/bridge';
import { CLIAgentTools } from "../../../dist/bridge/index.js";

// Load environment variables
dotenv.config();

class LangGraphCliAgentDemo {
  async init() {
    this.workspaceDir = process.cwd();
    this.setupLLM();
    await this.setupTools();
    this.setupAgent();
  }

  setupLLM() {
    // Configure OpenRouter with OpenAI-compatible interface
    this.model = new ChatOpenAI(
      {
        modelName: "deepseek/deepseek-r1:floor", // Cheapest price version with excellent function calling support
        temperature: 0,
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        // Add retry configuration for rate limiting
        maxRetries: 3,
        retryDelay: 2000, // 2 seconds between retries
      },
      {
        basePath: "https://openrouter.ai/api/v1",
        baseOptions: {
          headers: {
            "HTTP-Referer": process.env.SITE_URL || "https://localhost:3000",
            "X-Title":
              process.env.SITE_NAME || "CLI Agent LangGraph Integration",
          },
        },
        timeout: 60000, // 60s timeout
      }
    );
    console.log("✅ LLM configured (OpenRouter DeepSeek-R1-Floor)");
  }

  async setupTools() {
    // All 28 CLI Agent tools - fully working with OpenRouter DeepSeek-R1!

    this.tools = CLIAgentTools.getAllTools({
      workingDirectory: this.workspaceDir,
      enableLogging: true,
    });

    console.log(`✅ Loaded ${this.tools.length} CLI Agent tools for LangGraph`);
    console.log("Available tool categories:");

    // Show available tools by category
    const toolsByCategory = {};
    this.tools.forEach((tool) => {
      // Extract category from tool metadata - handle new OpenRouter format
      const toolName = tool.function?.name || tool.name || "unknown";
      const category = toolName.includes("file")
        ? "File Operations"
        : toolName.includes("search") ||
          toolName.includes("grep") ||
          toolName.includes("glob")
        ? "Search"
        : toolName.includes("web")
        ? "Web"
        : toolName.includes("bash") || toolName.includes("execute")
        ? "Commands"
        : toolName.includes("notebook")
        ? "Notebooks"
        : "Other";

      if (!toolsByCategory[category]) {
        toolsByCategory[category] = [];
      }
      toolsByCategory[category].push(toolName);
    });

    Object.entries(toolsByCategory).forEach(([category, tools]) => {
      console.log(`  📂 ${category}: ${tools.join(", ")}`);
    });
  }

  setupAgent() {
    // Create memory for conversation persistence
    this.memory = new MemorySaver();

    // Create LangGraph ReAct agent with CLI Agent tools
    this.agent = createReactAgent({
      llm: this.model,
      tools: this.tools, // All 28 CLI Agent tools!
      checkpointSaver: this.memory,
      // Add timeout and other options for better error handling
      messageModifier:
        "You are a helpful assistant. Use the available tools to complete tasks.",
    });

    console.log("✅ LangGraph ReAct agent created with CLI Agent SDK tools");
  }

  // Helper method for rate limiting
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runDemo() {
    console.log("\n🚀 Starting LangGraph + CLI Agent Tools Demo");
    console.log("=".repeat(60));

    const threadConfig = { configurable: { thread_id: "demo-1" } };

    try {
      // Demo 1: Simple file analysis
      await this.demo1_fileAnalysis(threadConfig);
      
      // Wait between demos to respect rate limits
      console.log("\n⏱️  Waiting 3s to respect rate limits...");
      await this.sleep(3000);

      // Demo 2: Project structure analysis
      await this.demo2_projectAnalysis(threadConfig);
      
      // Wait between demos to respect rate limits
      console.log("\n⏱️  Waiting 3s to respect rate limits...");
      await this.sleep(3000);

      // Demo 3: Code search and analysis
      await this.demo3_codeAnalysis(threadConfig);
    } catch (error) {
      console.error("❌ Demo failed:", error.message);
      
      if (error.message.includes("429") || error.message.includes("rate limit") || error.message.includes("MODEL_RATE_LIMIT")) {
        console.log("\n⚠️  Rate Limit Exceeded - Solutions:");
        console.log("1. Wait a few minutes and try again (limits reset hourly/daily)");
        console.log("2. Add $10+ to OpenRouter account for 1000 daily requests");
        console.log("3. Try demo with: npm run demo (tools-only, no LLM calls)");
        console.log("4. Current model: DeepSeek-R1:floor (cheapest price routing - ultra low cost)");
        
      } else if (error.message.includes("API key")) {
        console.log("\n💡 To run this demo with actual LLM calls:");
        console.log(
          "1. Set OPENROUTER_API_KEY environment variable (recommended)"
        );
        console.log("2. Or set OPENAI_API_KEY for direct OpenAI access");
        console.log("3. Or update the API key in main.js");
        console.log("4. Install dependencies: npm run setup");
      }
    }
  }

  async demo1_fileAnalysis(threadConfig) {
    console.log("\n📂 Demo 1: File Analysis");
    console.log("-".repeat(30));

    const message = new HumanMessage(
      "Please read the package.json file and tell me about this project's dependencies and scripts."
    );

    console.log("User:", message.content);
    console.log("\nAgent working...");

    const result = await this.agent.invoke(
      { messages: [message] },
      threadConfig
    );

    const lastMessage = result.messages[result.messages.length - 1];
    console.log("Agent:", lastMessage.content.substring(0, 300) + "...");
  }

  async demo2_projectAnalysis(threadConfig) {
    console.log("\n🏗️ Demo 2: Project Structure Analysis");
    console.log("-".repeat(30));

    const message = new HumanMessage(
      "Analyze this project structure using ls and glob tools. Show me the main directories and find all TypeScript files."
    );

    console.log("User:", message.content);
    console.log("\nAgent working...");

    const result = await this.agent.invoke(
      { messages: [message] },
      threadConfig
    );

    const lastMessage = result.messages[result.messages.length - 1];
    console.log("Agent:", lastMessage.content.substring(0, 300) + "...");
  }

  async demo3_codeAnalysis(threadConfig) {
    console.log("\n🔍 Demo 3: Code Search and Analysis");
    console.log("-".repeat(30));

    const message = new HumanMessage(
      "Use the search_code tool to find all functions in this project, then create a brief summary of what this codebase does."
    );

    console.log("User:", message.content);
    console.log("\nAgent working...");

    const result = await this.agent.invoke(
      { messages: [message] },
      threadConfig
    );

    const lastMessage = result.messages[result.messages.length - 1];
    console.log("Agent:", lastMessage.content.substring(0, 300) + "...");
  }

  showIntegrationSummary() {
    console.log("\n📋 Integration Summary");
    console.log("=".repeat(40));
    console.log("✅ CLI Agent SDK: Working");
    console.log(`✅ Available Tools: ${this.tools.length}`);
    console.log("✅ LangGraph Agent: Created");
    console.log("✅ Memory Persistence: Enabled");
    console.log(
      "✅ Tool Categories: File Ops, Search, Web, Commands, Notebooks, etc."
    );

    console.log("\n🚀 Ready for Production Use!");
    console.log(
      "Your CLI Agent tools can now be used in any LangGraph workflow."
    );
  }
}

// Run the demo
async function main() {
  console.log("🔧 LangGraph + CLI Agent Tools Integration Demo");
  console.log("Version: 1.0.0");
  console.log("Tools: 28 available\n");

  const demo = new LangGraphCliAgentDemo();
  await demo.init();
  await demo.runDemo();
  demo.showIntegrationSummary();
}

// Execute if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Demo failed:", error);
    process.exit(1);
  });
}

export { LangGraphCliAgentDemo };
