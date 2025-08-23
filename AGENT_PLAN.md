# 🤖 Plano Code Agent LLM com OpenRouter

## 🎯 **Arquitetura Baseada em OpenRouter + TypeScript**

### **Por que OpenRouter é a Melhor Escolha:**
- ✅ **300+ modelos**: OpenAI, Anthropic, Google, DeepSeek em uma API única
- ✅ **Transparência de preços**: Custos claros, sem taxas extras
- ✅ **API Compatível**: Same OpenAI API specification para function calling
- ✅ **Auto-otimização**: Routing inteligente para melhor preço/performance
- ✅ **TypeScript SDK**: openrouter-kit com function calling nativo

### **1. Stack Tecnológico**
**Dependencies**:
- `openrouter-kit`: SDK TypeScript oficial com function calling
- `zod`: Schema validation para tools
- `readline`: CLI interface interativa
- Nossos 14 tools CLI existentes (100% aproveitados)

### **2. Componentes Core - Detalhamento Técnico**

## **2.1 Agent Controller** 
*Core orchestrator que gerencia todo o ciclo de vida do agent*

### **Responsabilidades:**
- **LLM Communication**: Interface única com OpenRouter API
- **ReAct Loop Management**: Execução do ciclo reasoning→action→observation
- **Session Management**: Controle de sessões ativas e contexto
- **Response Streaming**: Respostas em tempo real para o usuário
- **Error Handling**: Recovery automático e fallback strategies

### **Arquitetura Interna:**
```typescript
interface AgentController {
  // Core LLM interaction
  llmClient: OpenRouterKit;
  currentSession: AgentSession;
  
  // ReAct cycle components
  reasoningEngine: ReasoningEngine;
  actionExecutor: ActionExecutor;
  observationProcessor: ObservationProcessor;
  
  // State management
  conversationState: ConversationState;
  executionContext: ExecutionContext;
}
```

### **ReAct Pattern Implementation:**
1. **Reasoning Phase**: 
   - Analisa input do usuário
   - Consulta memory para contexto relevante
   - Determina approach (single-step vs multi-step)
   - Seleciona model apropriado baseado em complexity

2. **Action Phase**:
   - Identifica tools necessários
   - Formata function calls para OpenRouter
   - Executa tools via Tool Registry Adapter
   - Monitora execution progress e timeouts

3. **Observation Phase**:
   - Processa resultados dos tools
   - Atualiza working memory
   - Avalia se goal foi atingido
   - Decide próxima action ou finaliza

### **Multi-Model Strategy:**
- **GPT-4o**: Planning complexo, reasoning avançado
- **Claude-3.5-Sonnet**: Code analysis, detailed explanations  
- **Gemini-Pro**: Research tasks, web integration
- **Cheaper models**: Simple tasks, confirmations
- **Auto-selection**: Baseado em task type e cost constraints

### **Streaming & Progress:**
- Real-time response chunks para UX responsiva
- Progress indicators para long-running tasks
- Cancellation support via AbortController
- Error recovery com user feedback

---

## **2.2 Tool Registry Adapter**
*Bridge entre nossos CLI tools e OpenRouter function calling*

### **Responsabilidades:**
- **Schema Conversion**: CLI tool schemas → OpenRouter function format
- **Execution Management**: Safe tool execution com isolation
- **Security Validation**: Input sanitization e permission checks
- **Cost Tracking**: Monitor tool usage e associated costs
- **Performance Optimization**: Caching e execution optimization

### **Arquitetura de Conversão:**
```typescript
interface ToolAdapter {
  // Registry integration  
  cliToolRegistry: ToolRegistry; // Nosso registry existente
  openRouterFunctions: OpenRouterFunction[];
  
  // Security & execution
  sandboxManager: SandboxManager;
  permissionValidator: PermissionValidator;
  
  // Monitoring
  costTracker: CostTracker;
  performanceMonitor: PerformanceMonitor;
}
```

### **Schema Mapping Strategy:**
Conversão automática dos nossos 14 tools:

1. **bashCommandTool** → `execute_bash_command`
   - Input: `{ command: string, timeout?: number }`
   - Security: Dangerous command detection
   - Sandbox: Isolated execution environment

2. **readFileTool** → `read_file_content`
   - Input: `{ filePath: string, limit?: number, offset?: number }`
   - Security: Path traversal protection
   - Optimization: File content caching

3. **writeFileTool** → `write_file_content`
   - Input: `{ filePath: string, content: string }`
   - Security: Write permission validation
   - Backup: Automatic file versioning

4. **editFileTool** → `edit_file_content`
   - Input: `{ filePath: string, oldText: string, newText: string }`
   - Security: Content validation
   - Preview: Show changes before applying

5. **webFetchTool** → `fetch_web_content`
   - Input: `{ url: string, prompt: string }`
   - Security: URL whitelist validation
   - Rate limiting: Request throttling

6. **webSearchTool** → `search_web`
   - Input: `{ query: string, maxResults?: number }`
   - Cost optimization: Results caching
   - Relevance: Result ranking

7. **grepTool** → `search_text_in_files`
   - Input: `{ pattern: string, path?: string }`
   - Performance: Indexed search
   - Results: Highlighted matches

8. **globTool** → `find_files_by_pattern`
   - Input: `{ pattern: string, path?: string }`
   - Optimization: Path caching
   - Results: File metadata inclusion

9. **listDirectoryTool** → `list_directory_contents`
   - Input: `{ path: string, recursive?: boolean }`
   - Security: Directory access validation
   - Formatting: Human-readable output

10. **multiEditTool** → `apply_multiple_edits`
    - Input: `{ filePath: string, edits: EditOperation[] }`
    - Atomicity: All-or-nothing execution
    - Preview: Change summary

11. **executeCommandTool** → `execute_system_command`
    - Input: `{ command: string, args: string[] }`
    - Security: Command whitelist
    - Monitoring: Resource usage tracking

12. **taskTool** → `delegate_to_specialist`
    - Input: `{ description: string, subagentType: string }`
    - Routing: Specialized agent selection
    - Coordination: Inter-agent communication

13. **exitPlanModeTool** → `finalize_execution_plan`
    - Input: `{ plan: string }`
    - Validation: Plan completeness check
    - Approval: User confirmation flow

14. **todoWriteTool** → `manage_task_list`
    - Input: `{ todos: TodoItem[] }`
    - Persistence: Task state management
    - Progress: Completion tracking

### **Security Layer:**
```typescript
interface SecurityValidation {
  // Input sanitization
  validateToolInput(toolName: string, input: any): ValidationResult;
  
  // Permission checking
  checkToolPermissions(toolName: string, context: ExecutionContext): boolean;
  
  // Dangerous operation detection
  detectDangerousOperations(toolName: string, input: any): RiskLevel;
  
  // User confirmation for high-risk operations
  requireUserConfirmation(operation: ToolOperation): Promise<boolean>;
}
```

### **Cost Tracking System:**
- Token usage per tool execution
- Model cost calculation
- Budget limits e alerting
- Cost optimization recommendations

---

## **2.3 Memory & Context Manager**
*Sistema de memória hierárquico para contexto e aprendizado*

### **Responsabilidades:**
- **Short-term Memory**: Conversação ativa e working context
- **Long-term Memory**: Patterns aprendidos e knowledge base
- **Session Management**: Persistência entre interações
- **Context Retrieval**: Busca inteligente de informações relevantes
- **Memory Optimization**: Garbage collection e compression

### **Arquitetura de Memória:**
```typescript
interface MemoryArchitecture {
  // Hierarchical memory layers
  shortTermMemory: ConversationBuffer;    // Last 50 messages
  workingMemory: ActiveContext;           // Current task context  
  episodicMemory: SessionHistory[];       // Past sessions
  semanticMemory: KnowledgeBase;          // Learned patterns
  proceduralMemory: ToolUsagePatterns;    // How to use tools effectively
}
```

### **Short-term Memory (Hot Memory):**
- **Conversation Buffer**: Últimas 50 mensagens da sessão ativa
- **Working Context**: Variables, file paths, current task state
- **Tool Execution History**: Últimas actions executadas
- **Error Context**: Recent failures para better error handling
- **User Preferences**: Temporary preferences para current session

### **Long-term Memory (Cold Storage):**
```typescript
interface LongTermMemory {
  // Knowledge categories
  factualKnowledge: FactEntry[];          // "User prefers Python over JS"
  proceduralKnowledge: ProcedureEntry[];  // "How to debug Node.js apps"
  episodicMemory: EpisodeEntry[];         // "Last week's refactoring session"
  
  // Learning mechanisms
  patternRecognition: PatternEntry[];     // Common user request patterns
  toolEffectiveness: ToolMetrics[];       // Which tools work best for what
  userBehavior: BehaviorPattern[];        // User's coding style and preferences
}
```

### **Context Retrieval System:**
- **Semantic Search**: Vector-based similarity matching
- **Relevance Scoring**: Rank memories by current task relevance
- **Temporal Decay**: Older memories have lower weight
- **User Feedback Integration**: Learn from user corrections
- **Cross-session Learning**: Apply patterns across different sessions

### **Memory Optimization Strategies:**
1. **Compression**: Summarize old conversations
2. **Importance Weighting**: Keep critical information longer
3. **Garbage Collection**: Remove irrelevant data
4. **Deduplication**: Merge similar memories
5. **Export/Import**: Session backup e restore

---

## **2.4 Planning Engine**
*Sistema de planejamento multi-step com model selection*

### **Responsabilidades:**
- **Task Decomposition**: Breaking complex tasks into subtasks
- **Execution Planning**: Sequencing e dependency management
- **Resource Allocation**: Model selection e cost optimization
- **Progress Monitoring**: Track execution state e handle failures
- **Plan Adaptation**: Dynamic re-planning based on results

### **Planning Architecture:**
```typescript
interface PlanningEngine {
  // Core planning components
  taskAnalyzer: TaskAnalyzer;             // Understand user intent
  decomposer: TaskDecomposer;             // Break into subtasks
  sequencer: ExecutionSequencer;          // Plan execution order
  
  // Resource management
  modelSelector: ModelSelector;           // Choose best model for each step
  costOptimizer: CostOptimizer;          // Minimize expenses
  resourceManager: ResourceManager;       // Manage execution resources
  
  // Execution control
  executionMonitor: ExecutionMonitor;     // Track progress
  adaptationEngine: AdaptationEngine;     // Handle failures and re-plan
}
```

### **Task Decomposition Strategies:**

1. **Chain of Thought (CoT)**:
   - Linear reasoning para tasks straightforward
   - Step-by-step breakdown
   - Sequential dependency resolution

2. **Tree of Thoughts (ToT)**:
   - Multi-path reasoning para complex problems
   - Parallel exploration of alternatives
   - Best path selection

3. **Plan-and-Execute**:
   - Comprehensive upfront planning
   - Detailed execution steps
   - Progress checkpoints

### **Model Selection Logic:**
```typescript
interface ModelSelectionStrategy {
  // Task complexity assessment
  assessComplexity(task: Task): ComplexityLevel;
  
  // Model capabilities matching
  matchCapabilities(requirements: TaskRequirements): ModelCandidate[];
  
  // Cost-benefit analysis
  optimizeSelection(candidates: ModelCandidate[], budget: Budget): Model;
  
  // Performance prediction
  predictPerformance(model: Model, task: Task): PerformancePrediction;
}
```

### **Execution Monitoring:**
- **Real-time Progress**: Visual indicators para long-running tasks
- **Failure Detection**: Automatic error recognition
- **Recovery Strategies**: Fallback plans e retry logic
- **User Intervention**: Pause/resume capability
- **Quality Assessment**: Validate intermediate results

### **Dynamic Re-planning:**
- **Context Changes**: Adapt to new information
- **Failure Recovery**: Alternative approaches quando steps fail
- **User Feedback**: Incorporate user corrections
- **Resource Constraints**: Adjust plans based on budget/time limits
- **Learning Integration**: Apply lessons from previous executions

### **3. Vantagens OpenRouter vs OpenAI Puro**

**Cost Efficiency**
- Acesso a modelos mais baratos para tasks simples
- Automatic routing para melhor custo/benefício
- Transparent pricing (vs OpenAI hidden costs)

**Model Diversity**
- GPT-4 para planning complexo
- Claude para code analysis
- Gemini para research tasks
- Free/cheap models para tasks simples

**Reliability**
- Multi-provider fallback automático
- No vendor lock-in
- Better uptime via provider diversity

### **4. Implementation Strategy**

**Fase 1: Basic Agent (2-3 dias)**
```typescript
import { OpenRouterKit } from 'openrouter-kit';

const agent = new OpenRouterKit({
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultModel: 'openai/gpt-4o',
  tools: [...existing14Tools]
});
```

**Fase 2: Advanced Features (3-4 dias)**
- Multi-model coordination
- Cost optimization logic  
- Security sandbox
- Planning engine

**Fase 3: Production Polish (2-3 dias)**
- Error handling robusto
- Performance monitoring
- CLI interface refinement
- Comprehensive testing

## 🚀 **Resultado**

**Autonomous Code Agent com:**
- 🧠 Multi-model intelligence (GPT-4, Claude, Gemini)
- 💰 Cost optimization automática
- 🔧 Todos os 14 tools CLI existentes
- 💬 Conversação natural pt/en
- 🔒 Sandbox security
- 📊 Planning multi-step inteligente

**ROI**: Melhor custo/benefício que OpenAI puro + flexibilidade de 300 modelos + zero vendor lock-in!

---

## 📋 **Detalhes Técnicos da Pesquisa**

### **OpenRouter Capabilities (2025)**

**Function Calling Support**
- Standardizes tool calling interface across models and providers
- OpenAI-compatible completion API
- Tool calls suggestions (LLM doesn't call tools directly, suggests them)
- Interleaved thinking for sophisticated decision-making

**TypeScript Integration**
- `openrouter-kit`: Comprehensive TypeScript SDK
- Easy chat, history management, secure tool calling
- Cost tracking and plugin support
- Examples available for dialog history and tool calling

**Model Selection & Routing**
- 300+ models from major providers
- Intelligent provider routing based on cost/performance
- Filter models by supported parameters (e.g., tools)
- Automatic fallback and optimization

### **Agent Architecture Patterns (Research-Based)**

**ReAct Pattern Implementation**
- Reasoning → Action → Observation cycle
- Verbalized chain-of-thought reasoning
- External tool integration
- Real-time problem solving

**Multi-Agent Coordination**
- Sequential orchestration (pipeline)
- Group chat pattern (collaborative)
- Hierarchical architecture (supervisor-based)
- Dynamic team construction

**Memory Architecture**
- Short-term: Conversation active (50 messages)
- Long-term: Learned patterns + procedures
- Working memory: Current context + recent actions
- Cross-agent context management

### **Production Considerations**

**Security & Sandbox**
- Docker containers with restricted access
- No direct host machine access
- Network isolation for LLM-generated code
- User confirmation for critical actions

**Performance & Reliability**
- Type safety for complex workflows
- Compile-time error prevention
- Async/await intuitive handling
- Multi-provider fallback strategies

**Cost Optimization**
- Model selection based on task complexity
- Transparent pricing structure
- Pay-as-you-go flexibility
- Automatic routing to competitive prices

### **Current System Integration**

**Existing Assets (100% Reusable)**
- 14 CLI tools fully tested (178/178 tests passing)
- Complete type system with Zod validation
- ESLint + TypeScript compiler configuration
- Tool registry architecture already modular

**Conversion Strategy**
- Tool Registry Adapter converts existing tools to OpenRouter function schemas
- Maintain security validation and sandbox execution
- Preserve all existing functionality while adding LLM intelligence
- Zero rewrite required - pure extension of current system