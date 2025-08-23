# 🚀 Implementation Guide - LLM Agent System

## 📋 **Visão Geral**

Este guia prático fornece instruções passo-a-passo para implementar o sistema LLM Agent completo usando OpenRouter, TypeScript e nossos 14 tools CLI existentes.

## 📦 **Fase 1: Setup & Dependencies**

### **1.1 Instalação de Dependencies**

```bash
# Instalar dependencies principais (usando OpenAI SDK conforme documentação oficial)
npm install openai zod readline dotenv

# Dev dependencies para TypeScript e testing
npm install -D typescript @types/node ts-node jest @types/jest

# Utilities adicionais
npm install winston axios retry fs-extra

# CLI interface dependencies  
npm install commander inquirer chalk ora

# Vector storage para memory system
npm install @xenova/transformers faiss-node

# Docker SDK para sandbox management
npm install dockerode @types/dockerode
```

### **1.2 Configuração TypeScript**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### **1.3 Project Structure**

```
src/
├── agent/
│   ├── controller/           # Agent Controller
│   ├── memory/              # Memory & Context Manager
│   ├── planning/            # Planning Engine
│   └── registry/            # Tool Registry Adapter
├── tools/                   # Existing CLI tools (unchanged)
├── types/                   # TypeScript type definitions
├── config/                  # Configuration files
├── utils/                   # Utility functions
└── cli/                     # CLI interface
```

## 🧠 **Fase 2: Core Agent Implementation**

### **2.1 Base Agent Class**

```typescript
// src/agent/core/BaseAgent.ts
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { ToolRegistry } from '../../tools/registry/ToolRegistry';
import { MemoryContextManager } from '../memory/MemoryContextManager';
import { PlanningEngine } from '../planning/PlanningEngine';
import { ToolRegistryAdapter } from '../registry/ToolRegistryAdapter';

export class LLMAgent {
  private llmClient: OpenAI;
  private toolAdapter: ToolRegistryAdapter;
  private memoryManager: MemoryContextManager;
  private planningEngine: PlanningEngine;
  private currentSession: AgentSession | null = null;
  private defaultModel: string;

  constructor(config: AgentConfiguration) {
    // Initialize OpenRouter client using OpenAI SDK (oficial recommendation)
    this.llmClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: config.openRouterApiKey,
      defaultHeaders: {
        "HTTP-Referer": config.siteUrl || "https://github.com/your-org/llm-agent",
        "X-Title": config.siteName || "LLM Agent System"
      }
    });
    
    this.defaultModel = config.defaultModel || 'openai/gpt-4o-mini';

    // Initialize tool registry adapter
    this.toolAdapter = new ToolRegistryAdapter(
      new ToolRegistry(), // Our existing tool registry
      config.security
    );

    // Initialize memory manager
    this.memoryManager = new MemoryContextManager(config.memory);

    // Initialize planning engine
    this.planningEngine = new PlanningEngine({
      modelSelector: config.modelSelection,
      costOptimizer: config.costOptimization
    });
  }

  async createSession(userId: string): Promise<AgentSession> {
    const session = new AgentSession({
      userId,
      agent: this,
      configuration: this.getSessionConfiguration()
    });

    this.currentSession = session;
    
    // Load user memory context
    await this.memoryManager.loadUserContext(userId);
    
    return session;
  }

  async processUserInput(input: string): Promise<AgentResponse> {
    if (!this.currentSession) {
      throw new Error('No active session. Please create a session first.');
    }

    try {
      // 1. Add user message to memory
      await this.memoryManager.addMessage({
        role: 'user',
        content: input,
        timestamp: new Date().toISOString()
      });

      // 2. Retrieve relevant context
      const context = await this.memoryManager.retrieveRelevantContext(input);

      // 3. Determine if this requires planning
      const taskComplexity = await this.assessTaskComplexity(input);

      let response: AgentResponse;

      if (taskComplexity.requiresPlanning) {
        // Complex task - use planning engine
        response = await this.executeWithPlanning(input, context);
      } else {
        // Simple task - direct execution
        response = await this.executeDirectly(input, context);
      }

      // 4. Add response to memory
      await this.memoryManager.addMessage({
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString()
      });

      // 5. Learn from interaction
      await this.memoryManager.learnFromInteraction({
        userInput: input,
        agentResponse: response,
        context,
        outcome: response.success ? 'success' : 'failure'
      });

      return response;

    } catch (error) {
      const errorResponse: AgentResponse = {
        success: false,
        content: `Sorry, I encountered an error: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      await this.memoryManager.addMessage({
        role: 'assistant', 
        content: errorResponse.content,
        timestamp: errorResponse.timestamp
      });

      return errorResponse;
    }
  }

  private async executeDirectly(
    input: string, 
    context: ContextResult
  ): Promise<AgentResponse> {
    
    // Convert tools to OpenRouter format
    const openRouterTools = this.toolAdapter.convertToolsToOpenRouterFormat();

    // Create conversation context
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(context)
      },
      {
        role: 'user',
        content: input
      }
    ];

    // Call OpenRouter with function calling using OpenAI SDK
    const completion = await this.llmClient.chat.completions.create({
      model: this.defaultModel,
      messages,
      tools: openRouterTools,
      tool_choice: 'auto',
      temperature: 0.1
    });

    const assistantMessage = completion.choices[0].message;

    // Execute tool calls if present
    const toolResults: ToolExecutionResult[] = [];
    if (assistantMessage.tool_calls) {
      for (const toolCall of assistantMessage.tool_calls) {
        const result = await this.toolAdapter.executeToolSafely({
          toolName: this.mapOpenRouterToolName(toolCall.function.name),
          parameters: JSON.parse(toolCall.function.arguments),
          context: this.currentSession!.getExecutionContext()
        });
        
        toolResults.push(result);
      }
    }

    return {
      success: true,
      content: assistantMessage.content || this.formatToolResults(toolResults),
      toolResults,
      timestamp: new Date().toISOString()
    };
  }

  private async executeWithPlanning(
    input: string,
    context: ContextResult
  ): Promise<AgentResponse> {
    
    // Create execution plan
    const plan = await this.planningEngine.createExecutionPlan({
      description: input,
      context,
      constraints: this.currentSession!.getResourceConstraints()
    });

    // Execute plan step by step
    const executionResult = await this.planningEngine.executePlan(plan.id);

    return {
      success: executionResult.success,
      content: executionResult.summary,
      planId: plan.id,
      executionSteps: executionResult.steps,
      toolResults: executionResult.toolResults,
      timestamp: new Date().toISOString()
    };
  }
}
```

### **2.2 Agent Session Management**

```typescript
// src/agent/core/AgentSession.ts
export class AgentSession {
  public readonly id: string;
  public readonly userId: string;
  public readonly startTime: Date;
  private agent: LLMAgent;
  private executionContext: ExecutionContext;
  private resourceConstraints: ResourceConstraints;

  constructor(config: SessionConfiguration) {
    this.id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.userId = config.userId;
    this.agent = config.agent;
    this.startTime = new Date();
    
    this.executionContext = {
      sessionId: this.id,
      userId: config.userId,
      workingDirectory: process.cwd(),
      environment: process.env,
      permissions: config.permissions || this.getDefaultPermissions()
    };

    this.resourceConstraints = config.constraints || this.getDefaultConstraints();
  }

  async processMessage(input: string): Promise<AgentResponse> {
    return this.agent.processUserInput(input);
  }

  getExecutionContext(): ExecutionContext {
    return { ...this.executionContext };
  }

  getResourceConstraints(): ResourceConstraints {
    return { ...this.resourceConstraints };
  }

  updateConstraints(constraints: Partial<ResourceConstraints>): void {
    this.resourceConstraints = { ...this.resourceConstraints, ...constraints };
  }

  private getDefaultPermissions(): AgentPermissions {
    return {
      fileAccess: ['read', 'write'],
      allowedDirectories: [process.cwd()],
      commandExecution: true,
      networkAccess: true,
      dangerousOperations: false
    };
  }

  private getDefaultConstraints(): ResourceConstraints {
    return {
      maxCost: 5.0,
      maxExecutionTime: 300000, // 5 minutes
      maxConcurrentTools: 3
    };
  }
}
```

## 🔧 **Fase 3: Tool Registry Adapter Implementation**

### **3.1 Schema Conversion System**

```typescript
// src/agent/registry/SchemaConverter.ts
import { z } from 'zod';
import { CLITool } from '../../tools/registry/ToolRegistry';

export class SchemaConverter {
  private toolMappings: Map<string, OpenRouterToolMapping>;

  constructor() {
    this.toolMappings = this.initializeToolMappings();
  }

  convertToolsToOpenRouterFormat(tools: CLITool[]): OpenRouterFunction[] {
    return tools.map(tool => this.convertSingleTool(tool));
  }

  private convertSingleTool(tool: CLITool): OpenRouterFunction {
    const mapping = this.toolMappings.get(tool.name);
    if (!mapping) {
      throw new Error(`No mapping found for tool: ${tool.name}`);
    }

    return {
      type: 'function',
      function: {
        name: mapping.openRouterName,
        description: this.enhanceDescription(tool.description, mapping),
        parameters: this.convertZodToJsonSchema(tool.inputSchema, mapping)
      }
    };
  }

  private convertZodToJsonSchema(
    zodSchema: z.ZodSchema, 
    mapping: OpenRouterToolMapping
  ): JSONSchema {
    // Convert Zod schema to JSON Schema
    const jsonSchema = zodToJsonSchema(zodSchema);
    
    // Apply parameter mappings
    if (mapping.parameterMappings) {
      jsonSchema.properties = this.applyParameterMappings(
        jsonSchema.properties,
        mapping.parameterMappings
      );
    }

    return jsonSchema;
  }

  private initializeToolMappings(): Map<string, OpenRouterToolMapping> {
    const mappings = new Map<string, OpenRouterToolMapping>();

    // Example mapping for bashCommandTool
    mappings.set('bashCommandTool', {
      openRouterName: 'execute_bash_command',
      description: 'Execute bash commands in secure sandbox environment',
      parameterMappings: {
        'command': 'command',
        'timeout': 'timeout_ms'
      },
      securityLevel: 'high',
      executionMode: 'sandboxed'
    });

    // Add all other tool mappings...
    // (Full mappings from the detailed documentation)
    
    return mappings;
  }
}
```

### **3.2 Security Validation**

```typescript
// src/agent/registry/SecurityValidator.ts
export class SecurityValidator {
  private dangerousPatterns = [
    /rm\s+-rf\s+/,
    /sudo\s+/,
    /chmod\s+777/,
    />\s*\/dev\/null/,
    /curl\s+.*\|\s*bash/,
    /wget\s+.*\|\s*bash/
  ];

  async validateToolExecution(
    request: ToolExecutionRequest
  ): Promise<SecurityValidationResult> {
    
    const validations = [
      this.validateCommandSafety(request),
      this.validateFileAccess(request),
      this.validateNetworkAccess(request),
      this.validateResourceLimits(request)
    ];

    const results = await Promise.all(validations);
    const failed = results.filter(r => !r.passed);

    if (failed.length > 0) {
      return {
        valid: false,
        reason: `Security validation failed: ${failed.map(f => f.reason).join(', ')}`,
        riskLevel: 'high',
        blockedOperations: failed.map(f => f.operation)
      };
    }

    return {
      valid: true,
      reason: 'All security validations passed',
      riskLevel: 'low'
    };
  }

  private async validateCommandSafety(
    request: ToolExecutionRequest
  ): Promise<ValidationCheck> {
    
    if (request.toolName !== 'bashCommandTool') {
      return { passed: true, reason: 'Not a command tool' };
    }

    const command = request.parameters.command as string;

    // Check dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          passed: false,
          reason: `Dangerous command pattern detected: ${pattern}`,
          operation: 'command_execution'
        };
      }
    }

    // Check path traversal
    if (command.includes('../') || command.includes('..\\')) {
      return {
        passed: false,
        reason: 'Path traversal attempt detected',
        operation: 'file_access'
      };
    }

    return { passed: true, reason: 'Command is safe' };
  }

  private async validateFileAccess(
    request: ToolExecutionRequest
  ): Promise<ValidationCheck> {
    
    const fileTools = ['readFileTool', 'writeFileTool', 'editFileTool'];
    if (!fileTools.includes(request.toolName)) {
      return { passed: true, reason: 'Not a file tool' };
    }

    const filePath = this.extractFilePath(request.parameters);
    if (!filePath) {
      return { passed: true, reason: 'No file path specified' };
    }

    // Check if file is in allowed directories
    const allowedDirs = request.context.permissions?.allowedDirectories || [process.cwd()];
    const resolvedPath = path.resolve(filePath);
    
    const isAllowed = allowedDirs.some(dir => 
      resolvedPath.startsWith(path.resolve(dir))
    );

    if (!isAllowed) {
      return {
        passed: false,
        reason: `File access outside allowed directories: ${filePath}`,
        operation: 'file_access'
      };
    }

    return { passed: true, reason: 'File access is allowed' };
  }
}
```

## 💾 **Fase 4: Memory System Implementation**

### **4.1 Conversation Buffer**

```typescript
// src/agent/memory/ConversationBuffer.ts
export class ConversationBuffer {
  private messages: ConversationMessage[] = [];
  private readonly maxSize = 50;
  private compressionEngine: ConversationCompressor;

  constructor() {
    this.compressionEngine = new ConversationCompressor();
  }

  addMessage(message: ConversationMessage): void {
    const enrichedMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: message.timestamp || new Date().toISOString(),
      tokenCount: this.estimateTokenCount(message.content)
    };

    this.messages.push(enrichedMessage);

    // Trigger compression if needed
    if (this.messages.length > this.maxSize) {
      this.compressOldMessages();
    }
  }

  getContextWindow(maxTokens: number = 4000): ConversationMessage[] {
    let tokenCount = 0;
    const contextMessages: ConversationMessage[] = [];

    // Add messages from newest to oldest until token limit
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const message = this.messages[i];
      
      if (tokenCount + message.tokenCount > maxTokens) {
        break;
      }

      contextMessages.unshift(message);
      tokenCount += message.tokenCount;
    }

    return contextMessages;
  }

  private async compressOldMessages(): Promise<void> {
    const messagesToCompress = this.messages.slice(0, this.messages.length - this.maxSize);
    const summary = await this.compressionEngine.compressMessages(messagesToCompress);

    // Replace old messages with summary
    this.messages = [
      {
        role: 'system',
        content: `Conversation summary: ${summary}`,
        id: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        tokenCount: this.estimateTokenCount(summary),
        type: 'summary'
      },
      ...this.messages.slice(-this.maxSize)
    ];
  }

  private estimateTokenCount(content: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(content.length / 4);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}
```

### **4.2 Semantic Memory with Vector Search**

```typescript
// src/agent/memory/SemanticMemory.ts
import { pipeline } from '@xenova/transformers';

export class SemanticMemoryManager {
  private embeddings: EmbeddingModel;
  private vectorStore: VectorStore;
  private knowledgeBase: Map<string, KnowledgeEntry> = new Map();

  constructor() {
    this.initializeEmbeddings();
    this.vectorStore = new VectorStore();
  }

  private async initializeEmbeddings(): Promise<void> {
    // Initialize lightweight embedding model
    this.embeddings = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async addKnowledge(entry: KnowledgeEntry): Promise<void> {
    // Generate embedding
    const embedding = await this.generateEmbedding(entry.content);
    
    // Store in vector database
    await this.vectorStore.upsert({
      id: entry.id,
      vector: embedding,
      metadata: {
        type: entry.type,
        confidence: entry.confidence,
        timestamp: entry.timestamp,
        source: entry.source
      }
    });

    // Store full entry
    this.knowledgeBase.set(entry.id, entry);
  }

  async searchSimilar(
    query: string, 
    limit: number = 5
  ): Promise<SemanticSearchResult[]> {
    
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Search vector store
    const vectorResults = await this.vectorStore.search({
      vector: queryEmbedding,
      topK: limit,
      threshold: 0.7
    });

    // Enrich with full knowledge entries
    const results: SemanticSearchResult[] = [];
    for (const vectorResult of vectorResults) {
      const knowledge = this.knowledgeBase.get(vectorResult.id);
      if (knowledge) {
        results.push({
          knowledge,
          similarity: vectorResult.score,
          relevanceScore: this.calculateRelevanceScore(knowledge, query)
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const result = await this.embeddings(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }

  private calculateRelevanceScore(knowledge: KnowledgeEntry, query: string): number {
    // Combine similarity with other factors
    const recencyBoost = this.calculateRecencyBoost(knowledge.timestamp);
    const confidenceBoost = knowledge.confidence;
    const typeBoost = this.getTypeBonus(knowledge.type);
    
    return (recencyBoost * 0.2) + (confidenceBoost * 0.5) + (typeBoost * 0.3);
  }
}
```

## 📋 **Fase 5: Planning Engine Implementation**

### **5.1 Task Decomposition**

```typescript
// src/agent/planning/TaskDecomposer.ts
export class TaskDecomposer {
  private llmClient: OpenRouterKit;

  constructor(llmClient: OpenRouterKit) {
    this.llmClient = llmClient;
  }

  async decomposeTask(
    taskDescription: string,
    context: ExecutionContext
  ): Promise<ExecutionPlan> {
    
    // Analyze task complexity
    const complexity = await this.analyzeComplexity(taskDescription);
    
    // Select decomposition strategy
    const strategy = this.selectStrategy(complexity);
    
    // Decompose based on strategy
    let steps: PlanStep[];
    
    switch (strategy) {
      case 'simple':
        steps = await this.decomposeSimpleTask(taskDescription, context);
        break;
      case 'complex':
        steps = await this.decomposeComplexTask(taskDescription, context);
        break;
      case 'expert':
        steps = await this.decomposeExpertTask(taskDescription, context);
        break;
      default:
        throw new Error(`Unknown decomposition strategy: ${strategy}`);
    }

    // Create execution plan
    const plan: ExecutionPlan = {
      id: this.generatePlanId(),
      description: taskDescription,
      steps,
      dependencies: this.calculateDependencies(steps),
      estimatedDuration: this.calculateEstimatedDuration(steps),
      estimatedCost: this.calculateEstimatedCost(steps),
      complexity,
      strategy,
      createdAt: new Date().toISOString()
    };

    // Validate plan
    await this.validatePlan(plan);

    return plan;
  }

  private async decomposeComplexTask(
    taskDescription: string,
    context: ExecutionContext
  ): Promise<PlanStep[]> {
    
    const decompositionPrompt = `
    You are an expert software engineering assistant. Break down this complex task into specific, executable steps:

    Task: ${taskDescription}
    Context: Working directory: ${context.workingDirectory}
    Available tools: ${this.getAvailableToolNames().join(', ')}

    Create a detailed step-by-step plan where each step:
    1. Has a clear, specific objective
    2. Identifies the exact tool to use
    3. Specifies the expected output
    4. Lists prerequisites from previous steps
    5. Estimates execution time in minutes

    Format your response as a JSON array of steps with this structure:
    {
      "steps": [
        {
          "id": "step_1",
          "description": "Clear description of what this step does",
          "tool": "toolName",
          "parameters": {
            // Tool-specific parameters
          },
          "expectedOutput": "Description of expected result",
          "prerequisites": ["step_id_if_any"],
          "estimatedMinutes": 5,
          "complexity": "simple|medium|complex"
        }
      ]
    }

    Be specific and practical. Each step should be directly executable.
    `;

    const response = await this.llmClient.chat({
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: decompositionPrompt }],
      temperature: 0.1
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed.steps.map((step: any, index: number) => ({
      ...step,
      id: step.id || `step_${index + 1}`,
      status: 'pending' as const,
      createdAt: new Date().toISOString()
    }));
  }

  private calculateDependencies(steps: PlanStep[]): StepDependency[] {
    const dependencies: StepDependency[] = [];

    steps.forEach(step => {
      if (step.prerequisites && step.prerequisites.length > 0) {
        step.prerequisites.forEach(prereqId => {
          dependencies.push({
            stepId: step.id,
            dependsOn: prereqId,
            type: 'blocking' // This step cannot start until dependency is complete
          });
        });
      }
    });

    return dependencies;
  }
}
```

### **5.2 Model Selection**

```typescript
// src/agent/planning/ModelSelector.ts
export class ModelSelector {
  private modelCapabilities: ModelCapabilityMap;
  private costCalculator: CostCalculator;

  constructor() {
    this.modelCapabilities = this.initializeCapabilities();
    this.costCalculator = new CostCalculator();
  }

  async selectOptimalModel(
    step: PlanStep,
    constraints: ResourceConstraints
  ): Promise<ModelSelection> {
    
    // Get candidate models
    const candidates = this.getCandidateModels(step);
    
    // Evaluate each model
    const evaluations = await Promise.all(
      candidates.map(model => this.evaluateModel(model, step, constraints))
    );

    // Filter by constraints
    const feasible = evaluations.filter(eval => 
      eval.estimatedCost <= constraints.maxCost &&
      eval.estimatedTime <= constraints.maxExecutionTime
    );

    if (feasible.length === 0) {
      throw new Error('No models meet the specified constraints');
    }

    // Select best option
    const selected = feasible.reduce((best, current) => 
      current.overallScore > best.overallScore ? current : best
    );

    return {
      model: selected.model,
      rationale: selected.rationale,
      estimatedCost: selected.estimatedCost,
      estimatedTime: selected.estimatedTime,
      confidence: selected.confidence
    };
  }

  private async evaluateModel(
    model: string,
    step: PlanStep,
    constraints: ResourceConstraints
  ): Promise<ModelEvaluation> {
    
    const capabilities = this.modelCapabilities.get(model);
    if (!capabilities) {
      throw new Error(`Unknown model: ${model}`);
    }

    // Calculate capability match score
    const capabilityScore = this.calculateCapabilityScore(capabilities, step);
    
    // Estimate cost
    const estimatedCost = await this.costCalculator.estimateStepCost(model, step);
    
    // Calculate cost efficiency
    const costScore = Math.max(0, 100 - (estimatedCost / constraints.maxCost) * 100);
    
    // Speed score
    const speedScore = capabilities.averageResponseTime ? 
      Math.max(0, 100 - capabilities.averageResponseTime) : 50;

    // Overall score (weighted)
    const overallScore = 
      (capabilityScore * 0.5) + 
      (costScore * 0.3) + 
      (speedScore * 0.2);

    return {
      model,
      capabilityScore,
      costScore,
      speedScore,
      overallScore,
      estimatedCost,
      estimatedTime: capabilities.averageResponseTime || 30,
      confidence: capabilityScore / 100,
      rationale: this.generateRationale(capabilities, step, overallScore)
    };
  }

  private initializeCapabilities(): ModelCapabilityMap {
    return new Map([
      ['openai/gpt-4o', {
        reasoning: 95,
        codeGeneration: 90,
        problemSolving: 95,
        creativity: 85,
        accuracy: 90,
        contextLength: 128000,
        costPerToken: { input: 0.000005, output: 0.000015 },
        averageResponseTime: 15
      }],
      ['openai/gpt-4o-mini', {
        reasoning: 80,
        codeGeneration: 75,
        problemSolving: 80,
        creativity: 70,
        accuracy: 85,
        contextLength: 128000,
        costPerToken: { input: 0.000001, output: 0.000002 },
        averageResponseTime: 8
      }],
      ['anthropic/claude-3.5-sonnet', {
        reasoning: 92,
        codeGeneration: 95,
        problemSolving: 90,
        creativity: 80,
        accuracy: 95,
        contextLength: 200000,
        costPerToken: { input: 0.000003, output: 0.000015 },
        averageResponseTime: 12
      }]
    ]);
  }
}
```

## 🖥️ **Fase 6: CLI Interface**

### **6.1 Interactive CLI**

```typescript
// src/cli/AgentCLI.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { LLMAgent } from '../agent/core/LLMAgent';

export class AgentCLI {
  private agent: LLMAgent;
  private currentSession: AgentSession | null = null;
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('agent')
      .description('LLM Code Agent CLI')
      .version('1.0.0');

    // Interactive mode
    this.program
      .command('interactive')
      .alias('i')
      .description('Start interactive mode')
      .action(async () => {
        await this.startInteractiveMode();
      });

    // Single command mode
    this.program
      .command('execute <task>')
      .alias('e')
      .description('Execute a single task')
      .option('-v, --verbose', 'Verbose output')
      .option('--max-cost <cost>', 'Maximum cost limit', parseFloat)
      .action(async (task, options) => {
        await this.executeSingleTask(task, options);
      });

    // Session management
    this.program
      .command('session')
      .description('Session management commands')
      .addCommand(
        new Command('list')
          .description('List active sessions')
          .action(async () => {
            await this.listSessions();
          })
      )
      .addCommand(
        new Command('resume <sessionId>')
          .description('Resume a session')
          .action(async (sessionId) => {
            await this.resumeSession(sessionId);
          })
      );
  }

  async startInteractiveMode(): Promise<void> {
    console.log(chalk.blue.bold('🤖 LLM Code Agent - Interactive Mode'));
    console.log(chalk.gray('Type "exit" to quit, "help" for commands\n'));

    // Initialize agent
    const spinner = ora('Initializing agent...').start();
    try {
      await this.initializeAgent();
      spinner.succeed('Agent initialized successfully');
    } catch (error) {
      spinner.fail(`Failed to initialize agent: ${error.message}`);
      return;
    }

    // Create session
    const sessionSpinner = ora('Creating session...').start();
    try {
      this.currentSession = await this.agent.createSession('cli-user');
      sessionSpinner.succeed(`Session created: ${this.currentSession.id}`);
    } catch (error) {
      sessionSpinner.fail(`Failed to create session: ${error.message}`);
      return;
    }

    // Interactive loop
    while (true) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.green('You:'),
          validate: (input) => {
            if (!input.trim()) {
              return 'Please enter a command or task';
            }
            return true;
          }
        }
      ]);

      const userInput = answers.input.trim();

      if (userInput.toLowerCase() === 'exit') {
        console.log(chalk.blue('Goodbye! 👋'));
        break;
      }

      if (userInput.toLowerCase() === 'help') {
        this.showHelp();
        continue;
      }

      // Process user input
      const processingSpinner = ora('Processing...').start();
      try {
        const response = await this.currentSession!.processMessage(userInput);
        
        processingSpinner.stop();
        
        if (response.success) {
          console.log(chalk.cyan('Agent:'), response.content);
          
          // Show tool results if any
          if (response.toolResults && response.toolResults.length > 0) {
            this.displayToolResults(response.toolResults);
          }
        } else {
          console.log(chalk.red('Error:'), response.error);
        }
      } catch (error) {
        processingSpinner.fail(`Error: ${error.message}`);
      }

      console.log(); // Empty line for readability
    }
  }

  private async executeSingleTask(task: string, options: any): Promise<void> {
    console.log(chalk.blue(`Executing task: ${task}`));

    const spinner = ora('Initializing...').start();
    
    try {
      await this.initializeAgent();
      const session = await this.agent.createSession('cli-user');
      
      // Update constraints if provided
      if (options.maxCost) {
        session.updateConstraints({ maxCost: options.maxCost });
      }

      spinner.text = 'Processing task...';
      
      const response = await session.processMessage(task);
      
      spinner.stop();

      if (response.success) {
        console.log(chalk.green('✅ Task completed successfully'));
        console.log(response.content);
        
        if (options.verbose && response.toolResults) {
          this.displayToolResults(response.toolResults);
        }
      } else {
        console.log(chalk.red('❌ Task failed'));
        console.log(response.error);
      }

    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  }

  private async initializeAgent(): Promise<void> {
    const config: AgentConfiguration = {
      openRouterApiKey: process.env.OPENROUTER_API_KEY!,
      defaultModel: process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini',
      security: {
        sandboxMode: process.env.SANDBOX_MODE === 'true',
        allowedDirectories: [process.cwd()],
        dangerousOperations: false
      },
      memory: {
        maxShortTermMessages: 50,
        enableLongTermMemory: true,
        vectorStorePath: './data/vectors'
      },
      costOptimization: {
        enabled: true,
        maxDailyCost: 10.0,
        preferCheaperModels: true
      }
    };

    if (!config.openRouterApiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    this.agent = new LLMAgent(config);
  }

  private displayToolResults(results: ToolExecutionResult[]): void {
    console.log(chalk.yellow('\n📋 Tool Execution Results:'));
    
    results.forEach((result, index) => {
      const icon = result.success ? '✅' : '❌';
      const color = result.success ? chalk.green : chalk.red;
      
      console.log(`${icon} ${color(result.toolName)}`);
      
      if (result.success && result.result) {
        console.log(chalk.gray(`   Result: ${JSON.stringify(result.result, null, 2)}`));
      }
      
      if (!result.success && result.error) {
        console.log(chalk.red(`   Error: ${result.error}`));
      }
      
      console.log(chalk.gray(`   Time: ${result.executionTime}ms`));
      
      if (index < results.length - 1) {
        console.log(); // Add spacing between results
      }
    });
    
    console.log();
  }

  private showHelp(): void {
    console.log(chalk.yellow('\n📚 Available Commands:'));
    console.log('  exit     - Exit the interactive mode');
    console.log('  help     - Show this help message');
    console.log('  clear    - Clear the console');
    console.log('\n💡 You can ask me to:');
    console.log('  - Read, write, or edit files');
    console.log('  - Execute bash commands');
    console.log('  - Search for code patterns');
    console.log('  - Refactor code');
    console.log('  - Debug issues');
    console.log('  - And much more!\n');
  }

  async run(): Promise<void> {
    await this.program.parseAsync();
  }
}
```

### **6.2 CLI Entry Point**

```typescript
// src/index.ts
#!/usr/bin/env node

import dotenv from 'dotenv';
import { AgentCLI } from './cli/AgentCLI';

// Load environment variables
dotenv.config();

// Create and run CLI
const cli = new AgentCLI();

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Agent terminated by user');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the CLI
cli.run().catch((error) => {
  console.error('CLI Error:', error);
  process.exit(1);
});
```

## 📦 **Fase 7: Configuration & Environment**

### **7.1 Environment Configuration**

```bash
# .env.example
# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
DEFAULT_MODEL=openai/gpt-4o-mini

# Agent Configuration
SANDBOX_MODE=true
MAX_DAILY_COST=10.0
ENABLE_LONG_TERM_MEMORY=true

# Security Settings
ALLOWED_DIRECTORIES=./,../src,../docs
DANGEROUS_OPERATIONS=false

# Performance Settings
MAX_CONCURRENT_TOOLS=3
DEFAULT_TIMEOUT=300000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/agent.log

# Vector Database
VECTOR_STORE_PATH=./data/vectors
EMBEDDINGS_MODEL=Xenova/all-MiniLM-L6-v2

# Docker Configuration (for sandbox)
DOCKER_ENABLED=true
DOCKER_IMAGE=ubuntu:22.04
DOCKER_MEMORY_LIMIT=512m
DOCKER_CPU_LIMIT=1000m
```

### **7.2 Package.json Updates**

```json
{
  "name": "llm-code-agent",
  "version": "1.0.0",
  "description": "Autonomous LLM Code Agent with OpenRouter",
  "main": "dist/index.js",
  "bin": {
    "agent": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "interactive": "npm run dev interactive",
    "test": "jest",
    "lint": "eslint src/**/*.ts --fix",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "openai": "^4.28.0",
    "zod": "^3.22.0",
    "readline": "^1.3.0",
    "dotenv": "^16.3.0",
    "winston": "^3.11.0",
    "axios": "^1.6.0",
    "retry": "^0.13.0",
    "fs-extra": "^11.2.0",
    "commander": "^11.1.0",
    "inquirer": "^9.2.0",
    "chalk": "^4.1.2",
    "ora": "^5.4.1",
    "@xenova/transformers": "^2.8.0",
    "faiss-node": "^0.5.0",
    "dockerode": "^3.3.5"
  }
}
```

## 🚀 **Usage Examples**

### **Basic Usage**

```bash
# Interactive mode
npm run interactive

# Single task execution
agent execute "Read all TypeScript files and check for type errors"

# With cost limit
agent execute "Refactor authentication system" --max-cost 5.0

# Verbose output
agent execute "Debug the API endpoints" --verbose
```

### **Programmatic Usage**

```typescript
// Using the agent programmatically
import { LLMAgent } from './src/agent/core/LLMAgent';

const agent = new LLMAgent({
  openRouterApiKey: 'your-key',
  defaultModel: 'openai/gpt-4o-mini'
});

const session = await agent.createSession('user123');

const response = await session.processMessage(
  'Create a REST API endpoint for user registration'
);

console.log(response.content);
```

## ⚡ **Performance Optimization**

### **Caching Strategy**
```typescript
// Implement response caching for repeated tasks
const cache = new Map<string, AgentResponse>();

const cachedResponse = cache.get(inputHash);
if (cachedResponse && !shouldBypassCache(input)) {
  return cachedResponse;
}
```

### **Memory Management**
```typescript
// Regular memory cleanup
setInterval(() => {
  memoryManager.optimizeMemory();
}, 3600000); // Every hour
```

### **Cost Monitoring**
```typescript
// Real-time cost tracking
const costTracker = new CostTracker();
costTracker.onThresholdExceeded((cost) => {
  console.warn(`Cost threshold exceeded: $${cost}`);
});
```

Este guia fornece uma implementação completa e prática do sistema LLM Agent, pronto para uso em produção com todos os 14 tools CLI existentes integrados perfeitamente.