# CLI Agent SDK

Uma SDK completa para integrar o CLI Agent em outros sistemas e aplicações, com interface CLI para execução direta de ferramentas.

## 🚀 **Instalação e Setup**

```bash
# Clone o repositório
git clone <repository-url>
cd cli-agent

# Instalar dependências
npm install

# Build do projeto
npm run build

# Configurar variáveis de ambiente (opcional)
export OPENROUTER_API_KEY="sua-chave-api"
```

## 🖥️ **Uso via CLI (Interface Direta)**

### **Comandos Básicos**

```bash
# Executar diretamente (recomendado)
node dist/cli.js <comando> [opções]

# Ou via npm (precisa usar -- para passar argumentos)
npm start -- <comando> [opções]

# Modo desenvolvimento
npm run dev -- <comando> [opções]
```

### **Comandos Essenciais**

```bash
# Listar todas as ferramentas disponíveis
node dist/cli.js list-tools

# Ver informações detalhadas de uma ferramenta
node dist/cli.js tool-info <nome_ferramenta>

# Ver status do sistema
node dist/cli.js status

# Ajuda geral
node dist/cli.js --help
```

### **Operações com Arquivos**

```bash
# Ler arquivo
node dist/cli.js read_file --filePath="package.json"

# Escrever arquivo
node dist/cli.js write_file --filePath="teste.txt" --content="Hello World"

# Editar arquivo com substituição precisa
node dist/cli.js edit_file --filePath="src/app.js" --oldText="var x = 1" --newText="const x = 1"

# Listar diretório
node dist/cli.js ls --path="src"

# Múltiplas edições em um arquivo
node dist/cli.js multi_edit --file_path="src/app.js" --edits='[{"old_string":"var","new_string":"const"}]'
```

### **Busca e Análise**

```bash
# Buscar arquivos por padrão
node dist/cli.js glob --pattern="**/*.ts" --path="src"

# Buscar texto em arquivos
node dist/cli.js grep --pattern="function" --path="src" --outputMode="content"

# Busca inteligente em código
node dist/cli.js search_code --query="authenticate" --path="src" --fileTypes='["ts","js"]'

# Análise de símbolos
node dist/cli.js symbol_analysis --action="find_usages" --symbol_name="getUserData" --file_paths='["src/api.ts"]'
```

### **Comandos do Sistema**

```bash
# Executar comando bash
node dist/cli.js bash --command="echo 'Hello World' && pwd"

# Executar comando avançado
node dist/cli.js execute_command --command="npm test" --workingDirectory="/project"
```

### **Ferramentas Web**

```bash
# Buscar na web (requer API key)
node dist/cli.js web_search --query="TypeScript best practices"

# Fetch de URL
node dist/cli.js web_fetch --url="https://api.github.com/repos/microsoft/vscode"

# Buscar documentação
node dist/cli.js fetch_documentation --url="https://nodejs.org/api/fs.html"
```

### **Ferramentas Avançadas**

```bash
# Comparar arquivos
node dist/cli.js advanced_diff --action="compare_files" --file_path_1="src/app.ts" --file_path_2="src/app.backup.ts"

# Analisar notebook Jupyter
node dist/cli.js notebook_read --notebook_path="analysis.ipynb"

# Gerenciar tarefas
node dist/cli.js todo_write --todos='[{"content":"Implementar feature X","status":"pending"}]'

# Executar sub-agentes especializados
node dist/cli.js task --description="Code review" --prompt="Review this code" --subagent_type="code-reviewer"
```

### **Execução com JSON**

```bash
# Executar com parâmetros JSON
node dist/cli.js execute read_file --params='{"filePath": "package.json"}'

# Carregar parâmetros de arquivo
echo '{"filePath": "package.json"}' > params.json
node dist/cli.js execute read_file --file="params.json"
```

## 📖 **Uso via SDK (Programático)**

### **Setup Básico**

```typescript
import { CliAgentSDK } from './src/sdk';

const sdk = new CliAgentSDK({
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    workingDirectory: './workspace',
    enableLogging: true
});

await sdk.initialize();

// Executar uma ferramenta
const result = await sdk.executeTool('read_file', {
    filePath: 'package.json'
});

if (result.success) {
    console.log('Conteúdo:', result.output);
} else {
    console.error('Erro:', result.error);
}
```

## 🛠️ **30+ Ferramentas Disponíveis**

### **Arquivos e Sistema**
- `read_file` - Ler arquivos com suporte a ranges
- `write_file` - Escrever arquivos com backup automático
- `edit_file` - Editar arquivos com substituição precisa
- `multi_edit` - Múltiplas edições em um arquivo
- `text_editor` - Editor avançado com undo
- `ls` - Listar diretórios com metadados
- `execute_command` - Executar comandos do sistema
- `bash` - Executar scripts bash

### **Busca e Análise**
- `grep` - Busca por padrões com fallback automático
- `glob` - Busca por arquivos com padrões
- `search_code` - Busca inteligente em código
- `symbol_analysis` - Análise de símbolos e refactoring

### **Web e Rede**
- `web_search` - Busca na web com filtros
- `web_fetch` - Requisições HTTP avançadas
- `enhanced_web_search` - Busca web aprimorada
- `fetch_documentation` - Buscar documentação

### **Desenvolvimento e Testes**
- `test_analyzer` - Análise inteligente de testes
- `advanced_diff` - Comparação avançada de arquivos
- `advanced_patch` - Aplicar patches com formato V4A
- `todo_write` - Gerenciar lista de tarefas
- `create_execution_plan` - Planos de execução

### **Notebooks Jupyter**
- `notebook_read` - Ler notebooks
- `notebook_edit` - Editar células
- `advanced_notebook` - Operações avançadas

### **Integrações e Automação**
- `task` - Sub-agentes especializados
- `sub_agents` - Gerenciar múltiplos agentes
- `mcp_integration` - Integração MCP
- `hooks_management` - Gerenciar hooks Git
- `computer_use` - Controle de desktop (GUI)

## 🔧 **Configuração Avançada**

```typescript
const sdk = new CliAgentSDK({
    // LLM Configuration
    openRouterApiKey: 'your-api-key',
    defaultModel: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 4000,
    
    // Execution
    toolCallLimit: 10,
    timeout: 30000,
    
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

### **1. Automação de Desenvolvimento**

```bash
# Pipeline de desenvolvimento
node dist/cli.js bash --command="npm run build"
node dist/cli.js bash --command="npm test"
node dist/cli.js grep --pattern="TODO|FIXME" --path="src" --outputMode="content"
```

### **2. Análise de Código**

```bash
# Analisar estrutura do projeto
node dist/cli.js ls --path="src"
node dist/cli.js glob --pattern="**/*.ts"
node dist/cli.js search_code --query="authentication" --path="src"
```

### **3. Integração CI/CD**

```bash
# Script de CI/CD
node dist/cli.js execute_command --command="npm install"
node dist/cli.js execute_command --command="npm run lint"
node dist/cli.js execute_command --command="npm test"
node dist/cli.js execute_command --command="npm run build"
```

### **4. Aplicação Web (SDK)**

```typescript
import { CliAgentSDK } from './src/sdk';

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
                    toolName: 'ls',
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
                    toolName: 'test_analyzer',
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

## 🔌 **Sistema de Plugins**

```typescript
import { SDKPlugin } from './src/sdk/types/sdkTypes';

const customPlugin: SDKPlugin = {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'Plugin customizado',
    
    initialize: async (sdk) => {
        console.log('Plugin inicializado');
    },
    
    beforeToolExecution: async (toolName, parameters) => {
        // Modificar parâmetros antes da execução
        if (toolName === 'read_file') {
            parameters.encoding = 'utf8';
        }
        return parameters;
    },
    
    afterToolExecution: async (result) => {
        // Processar resultado após execução
        return result;
    }
};

// Instalar plugin
await sdk.installPlugin(customPlugin);
```

## 📊 **Monitoramento e Estatísticas**

```typescript
// Obter estatísticas via SDK
const stats = sdk.getStats();
console.log({
    totalTools: stats.totalTools,
    executions: stats.executionStats.totalExecutions,
    successRate: stats.executionStats.successfulExecutions / stats.executionStats.totalExecutions
});

// Via CLI
node dist/cli.js status
```

## 🚀 **Features Principais**

### **✅ Interface Dupla**
- **CLI Direta**: Execução imediata de ferramentas via linha de comando
- **SDK Programática**: Integração em aplicações TypeScript/JavaScript

### **✅ Execução Robusta**
- Validação de parâmetros com JSON Schema
- Tratamento de erros detalhado
- Timeout configurável e cancelamento

### **✅ 30+ Ferramentas Built-in**
- Operações de arquivo, sistema, web, análise
- Notebooks Jupyter, testes, integrações
- Controle de desktop (GUI)

### **✅ Batch Processing**
- Execução paralela e sequencial
- Gerenciamento de dependências
- Pipeline de automação

### **✅ Extensibilidade**
- Sistema de plugins
- Ferramentas customizadas
- Hooks e eventos

## 🎓 **Primeiros Passos**

1. **Instalar e buildar**:
   ```bash
   npm install && npm run build
   ```

2. **Testar CLI básico**:
   ```bash
   node dist/cli.js list-tools
   node dist/cli.js status
   ```

3. **Explorar projeto**:
   ```bash
   node dist/cli.js ls --path="."
   node dist/cli.js read_file --filePath="README.md"
   ```

4. **Buscar e analisar**:
   ```bash
   node dist/cli.js glob --pattern="**/*.ts"
   node dist/cli.js grep --pattern="function" --path="src"
   ```

## 📋 **Scripts Disponíveis**

- `npm run build` - Compilar TypeScript
- `npm start` - Executar CLI (versão compilada)
- `npm run dev` - Executar CLI (modo desenvolvimento)
- `npm test` - Executar testes
- `npm run lint` - Verificar código
- `npm run typecheck` - Verificar tipos

## 🎯 **Resultado**

Com esta ferramenta você pode:

- ✅ **Executar 30+ ferramentas** via CLI ou SDK
- ✅ **Automação completa** de desenvolvimento
- ✅ **Validação robusta** de parâmetros e schemas
- ✅ **Batch processing** com dependências
- ✅ **Sistema de plugins** extensível
- ✅ **Monitoramento completo** com events
- ✅ **Interface dupla** CLI + SDK

**Perfeito para automação, análise de código, pipelines CI/CD, aplicações web e qualquer workflow de desenvolvimento!** 🚀