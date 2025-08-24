# CLI Agent SDK

Uma SDK completa para integrar o CLI Agent em outros sistemas e aplicações.

## 🚀 **Instalação**

```bash
npm install cli-agent-sdk
```

## 📖 **Uso Básico**

```typescript
import { CliAgentSDK } from 'cli-agent-sdk';

const sdk = new CliAgentSDK({
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    enableHealing: true,
    enableNormalization: true
});

await sdk.initialize();

// Executar uma ferramenta
const result = await sdk.executeTool('readFile', {
    filePath: 'package.json'
});

if (result.success) {
    console.log('Conteúdo:', result.output);
} else {
    console.error('Erro:', result.error);
}
```

## 🛠️ **Ferramentas Disponíveis**

### **Arquivos e Sistema**
- `readFile` - Ler arquivos
- `writeFile` - Escrever arquivos 
- `editFile` - Editar arquivos (com healing automático)
- `listDirectory` - Listar diretórios
- `executeCommand` - Executar comandos do sistema
- `bashCommand` - Executar scripts bash

### **Busca e Análise**
- `grep` - Busca por padrões em arquivos
- `glob` - Busca por arquivos com padrões
- `searchCode` - Busca inteligente em código
- `symbolAnalysis` - Análise de símbolos

### **Web e Rede**
- `webSearch` - Busca na web
- `webFetch` - Fazer requisições HTTP
- `fetchDocumentation` - Buscar documentação online

### **Desenvolvimento**
- `multiEdit` - Editar múltiplos arquivos
- `advancedPatch` - Aplicar patches avançados
- `intelligentTestAnalyzer` - Análise inteligente de testes
- `todoWrite` - Gerenciar lista de tarefas

### **Integrações**
- `task` - Executar sub-agentes especializados
- `mcpIntegration` - Integração com MCP
- `hooksManagement` - Gerenciar hooks Git

## 🔧 **Configuração Avançada**

```typescript
const sdk = new CliAgentSDK({
    // LLM Configuration
    openRouterApiKey: 'your-api-key',
    defaultModel: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 4000,
    
    // Features
    enableHealing: true,          // Correção automática de parâmetros
    enableNormalization: true,    // Compatibilidade entre modelos
    healingTimeout: 30000,
    toolCallLimit: 10,
    
    // Context
    workingDirectory: '/app/workspace',
    sessionId: 'my-session',
    environment: process.env,
    
    // Logging
    enableLogging: true,
    logLevel: 'info',
    customLogger: (level, message, data) => {
        console.log(`[${level}] ${message}`, data);
    },
    
    // Extensions
    customTools: [
        // Suas ferramentas customizadas
    ],
    pluginPaths: ['./plugins']
});
```

## 🎯 **Casos de Uso**

### **1. Aplicação Web**

```typescript
import { CliAgentSDK } from 'cli-agent-sdk';

class CodeAnalysisService {
    private sdk: CliAgentSDK;
    
    constructor() {
        this.sdk = new CliAgentSDK({
            openRouterApiKey: process.env.OPENROUTER_API_KEY,
            workingDirectory: '/workspace'
        });
    }
    
    async analyzeProject(projectPath: string) {
        await this.sdk.initialize();
        
        // Análise em batch paralela
        const results = await this.sdk.executeBatch({
            operations: [
                {
                    id: 'files',
                    toolName: 'listDirectory',
                    parameters: { path: projectPath }
                },
                {
                    id: 'todos',
                    toolName: 'grep',
                    parameters: { 
                        pattern: 'TODO|FIXME', 
                        path: projectPath 
                    }
                },
                {
                    id: 'tests',
                    toolName: 'intelligentTestAnalyzer',
                    parameters: { 
                        testPath: `${projectPath}/tests` 
                    }
                }
            ],
            options: { parallel: true }
        });
        
        return {
            files: results.results.files?.data,
            todos: results.results.todos?.data,
            testAnalysis: results.results.tests?.data
        };
    }
}
```

### **2. Sistema Enterprise**

```typescript
class EnterpriseSDK {
    private sdk: CliAgentSDK;
    
    constructor(userContext: any) {
        this.sdk = new CliAgentSDK({
            openRouterApiKey: process.env.OPENROUTER_API_KEY,
            workingDirectory: `/workspaces/${userContext.orgId}`,
            sessionId: `enterprise-${userContext.userId}`,
            customLogger: this.createAuditLogger(userContext)
        });
        
        // Event listeners para compliance
        this.sdk.on('tool.execution.start', this.auditStart);
        this.sdk.on('tool.execution.complete', this.auditComplete);
    }
    
    private createAuditLogger(userContext: any) {
        return (level: string, message: string, data?: any) => {
            // Enviar para sistema de auditoria
            this.sendToAuditSystem({
                timestamp: new Date(),
                userId: userContext.userId,
                orgId: userContext.orgId,
                level, message, data
            });
        };
    }
}
```

### **3. Pipeline CI/CD**

```typescript
// ci-pipeline.ts
import { CliAgentSDK } from 'cli-agent-sdk';

async function runCIPipeline() {
    const sdk = new CliAgentSDK({
        workingDirectory: process.env.GITHUB_WORKSPACE,
        sessionId: `ci-${process.env.GITHUB_RUN_ID}`
    });
    
    await sdk.initialize();
    
    // Pipeline sequencial com dependências
    const pipeline = await sdk.executeBatch({
        operations: [
            {
                id: 'install',
                toolName: 'executeCommand',
                parameters: { command: 'npm install' }
            },
            {
                id: 'lint',
                toolName: 'executeCommand',
                parameters: { command: 'npm run lint' },
                dependsOn: ['install']
            },
            {
                id: 'test',
                toolName: 'executeCommand', 
                parameters: { command: 'npm test' },
                dependsOn: ['install']
            },
            {
                id: 'build',
                toolName: 'executeCommand',
                parameters: { command: 'npm run build' },
                dependsOn: ['lint', 'test']
            }
        ],
        options: {
            stopOnError: true,
            timeout: 300000 // 5 minutes
        }
    });
    
    if (pipeline.success) {
        console.log('✅ Pipeline completed successfully');
    } else {
        console.error('❌ Pipeline failed');
        process.exit(1);
    }
}
```

## 🔌 **Sistema de Plugins**

```typescript
import { SDKPlugin } from 'cli-agent-sdk';

const customPlugin: SDKPlugin = {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'Plugin customizado',
    
    initialize: async (sdk) => {
        console.log('Plugin inicializado');
    },
    
    beforeToolExecution: async (toolName, parameters) => {
        // Modificar parâmetros antes da execução
        if (toolName === 'readFile') {
            parameters.encoding = 'utf8';
        }
        return parameters;
    },
    
    afterToolExecution: async (result) => {
        // Processar resultado após execução
        if (result.toolInfo.name === 'readFile') {
            result.data = {
                ...result.data,
                lineCount: result.output?.split('\n').length
            };
        }
        return result;
    }
};

// Instalar plugin
await sdk.installPlugin(customPlugin);
```

## 🛠️ **Ferramentas Customizadas**

```typescript
const sdk = new CliAgentSDK({
    customTools: [
        {
            name: 'calculateMetrics',
            description: 'Calculate code metrics',
            category: 'analysis',
            tags: ['metrics', 'code-quality'],
            complexity: 'advanced',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: {
                        type: 'string',
                        description: 'Path to project'
                    },
                    metrics: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Metrics to calculate'
                    }
                },
                required: ['projectPath']
            },
            execute: async (params, context) => {
                // Sua lógica customizada
                return {
                    linesOfCode: 1000,
                    complexity: 'medium',
                    coverage: '85%'
                };
            }
        }
    ]
});
```

## 📊 **Monitoramento e Estatísticas**

```typescript
// Obter estatísticas
const stats = sdk.getStats();
console.log({
    totalTools: stats.totalTools,
    executions: stats.executionStats.totalExecutions,
    successRate: stats.executionStats.successfulExecutions / stats.executionStats.totalExecutions,
    averageTime: stats.executionStats.averageExecutionTime
});

// Event listeners
sdk.on('tool.execution.start', (data) => {
    console.log(`🔧 Starting: ${data.toolName}`);
});

sdk.on('tool.execution.complete', (result) => {
    console.log(`✅ Completed: ${result.toolInfo.name} (${result.executionTime}ms)`);
});

sdk.on('healing.applied', (healing) => {
    console.log(`🩹 Healing applied: ${healing.strategy}`);
});
```

## 🚀 **Features Principais**

### **✅ Healing Automático**
- Detecção automática de erros em parâmetros
- Correção via LLM (GPT-4o-mini)
- Suporte para over-escaping, whitespace, formato
- Re-execução transparente

### **✅ Normalização Multi-Modelo**  
- Compatibilidade com GPT-4, Claude, Gemini
- Ajuste automático de schemas
- Cache de normalizações

### **✅ Execução Robusta**
- Timeout configurável
- Cancelamento de operações
- Retry com backoff exponencial
- Tratamento de erros avançado

### **✅ Sistema de Eventos**
- Monitoramento em tempo real
- Logs estruturados
- Métricas detalhadas
- Auditoria completa

## 📋 **API Reference**

### **CliAgentSDK**

```typescript
class CliAgentSDK {
    constructor(config: Partial<SDKConfig>)
    
    // Lifecycle
    async initialize(): Promise<void>
    async dispose(): Promise<void>
    
    // Tool execution
    async executeTool(toolName: string, parameters: any, context?: SDKExecutionContext): Promise<ToolExecutionResult>
    async executeBatch(request: BatchExecutionRequest): Promise<BatchExecutionResult>
    
    // Tool discovery
    listTools(): SDKToolInfo[]
    getToolInfo(toolName: string): SDKToolInfo | null
    
    // Statistics
    getStats(): SDKStats
    
    // Extensions
    async installPlugin(plugin: SDKPlugin): Promise<void>
    async uninstallPlugin(pluginName: string): Promise<void>
    
    // Events (extends EventEmitter)
    on(event: string, listener: Function): this
    emit(event: string, data: any): boolean
}
```

## 💡 **Best Practices**

1. **Sempre inicialize a SDK antes do uso**
```typescript
await sdk.initialize();
```

2. **Use batch execution para operações paralelas**
```typescript
const results = await sdk.executeBatch({
    operations: [...],
    options: { parallel: true }
});
```

3. **Implemente error handling robusto**
```typescript
sdk.on('tool.execution.error', (error) => {
    console.error(`Tool failed: ${error.toolName}`, error);
});
```

4. **Configure logging para debugging**
```typescript
const sdk = new CliAgentSDK({
    enableLogging: true,
    customLogger: myLogger
});
```

5. **Use plugins para funcionalidades transversais**
```typescript
await sdk.installPlugin(authenticationPlugin);
await sdk.installPlugin(metricsPlugin);
```

## 🎯 **Resultado**

Com esta SDK você pode:

- ✅ **Integrar facilmente** o CLI Agent em qualquer aplicação
- ✅ **Executar 30+ ferramentas** de forma programática  
- ✅ **Healing automático** quando parâmetros falham
- ✅ **Batch processing** com dependências
- ✅ **Sistema de plugins** extensível
- ✅ **Monitoramento completo** com events
- ✅ **Configuração flexível** para qualquer ambiente

**Perfeito para aplicações web, sistemas enterprise, pipelines CI/CD, e qualquer integração que precise de automação robusta!** 🚀