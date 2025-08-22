# AI Code Assistant

Uma extensão VSCode avançada que fornece 30 ferramentas de IA para desenvolvimento de software, baseada na arquitetura do Claude Code.

## 🚀 Funcionalidades

### 📁 Operações de Arquivo
- **Edit File**: Edição inteligente de arquivos com preservação de contexto
- **Read File**: Leitura otimizada de arquivos com suporte a grandes arquivos
- **Write File**: Criação e escrita de arquivos com validação
- **Multi Edit**: Múltiplas edições em um único arquivo
- **List Directory**: Navegação inteligente de diretórios

### 🔍 Busca e Análise
- **Glob**: Busca de arquivos por padrões
- **Grep**: Busca avançada de texto com regex
- **Search Code**: Busca semântica em código
- **Symbol Analysis**: Análise inteligente de símbolos no código

### ⚡ Execução de Comandos
- **Bash**: Execução segura de comandos bash
- **Execute Command**: Execução controlada de comandos do sistema
- **Computer Use**: Automação de tarefas do sistema

### 🧠 Planejamento e Organização
- **Todo Write**: Sistema de planejamento de tarefas
- **Task**: Delegação para sub-agentes especializados
- **Create Execution Plan**: Criação de planos de execução estruturados

### 🌐 Web e Documentação
- **Web Fetch**: Busca inteligente de conteúdo web
- **Web Search**: Pesquisa web integrada
- **Enhanced Web Search**: Busca web avançada com contexto
- **Fetch Documentation**: Busca automática de documentação

### 📝 Edição Avançada
- **Text Editor**: Editor de texto com comandos avançados
- **Advanced Diff**: Comparação inteligente de arquivos
- **Advanced Patch**: Aplicação inteligente de patches

### 🧪 Testes e Qualidade
- **Test Analyzer**: Análise inteligente de falhas de teste
- **Advanced Notebook**: Manipulação avançada de notebooks Jupyter
- **Notebook Read/Edit**: Operações específicas para notebooks

### 🔧 Sistemas Avançados
- **Exit Plan Mode**: Controle de modo de planejamento
- **MCP Integration**: Integração com Model Context Protocol
- **Hooks Management**: Gerenciamento de hooks do sistema
- **Sub Agents**: Sistema de sub-agentes especializados

## 🏗️ Arquitetura

### Virtual Tools System
Sistema inteligente que comprime a apresentação de ferramentas para o LLM, otimizando o uso de tokens e melhorando a performance.

### Error Handling
Sistema robusto de tratamento de erros com recovery automático e logging inteligente.

### Tool Registry
Registro centralizado de ferramentas com validação automática e descoberta dinâmica.

## 🧪 Testes

O projeto conta com 100% de cobertura de testes com duas suites:

### Testes Principais (153 testes)
```bash
npm run test:main
```
- Testes unitários com mocks
- Validação de arquitetura
- Testes de integração

### Testes Reais (34 testes)
```bash
npm run test:real
```
- Operações reais de sistema de arquivos
- Execução real de comandos bash
- Validação de funcionalidade real

### Todos os Testes
```bash
npm test
```

## 📦 Instalação e Desenvolvimento

### Pré-requisitos
- Node.js 18+
- VSCode 1.85+

### Instalação
```bash
npm install
```

### Desenvolvimento
```bash
npm run build:dev
npm run watch
```

### Build de Produção
```bash
npm run build
```

### Empacotamento
```bash
npm run package
```

## 🎯 Uso

1. Instale a extensão no VSCode
2. Abra a paleta de comandos (Cmd/Ctrl + Shift + P)
3. Digite "AI Code Assistant" para ver os comandos disponíveis
4. Use o chat integrado para interagir com as ferramentas

## 🔧 Configuração

A extensão funciona out-of-the-box mas pode ser configurada através das configurações do VSCode:

- `ai-code-assistant.provider`: Provedor de IA (anthropic, openai, ollama)
- `ai-code-assistant.virtualTools`: Habilitar sistema de virtual tools
- `ai-code-assistant.errorRecovery`: Habilitar recovery automático de erros

## 📊 Performance

- **30 ferramentas** registradas e validadas
- **Sistema de Virtual Tools** com compressão inteligente
- **Otimização de tokens** para reduzir custos de LLM
- **Cache inteligente** para operações frequentes
- **Memory management** otimizado para grandes projetos

## 🏆 Qualidade

- ✅ **100% de testes passando** (187/187 testes)
- ✅ **Cobertura completa** de funcionalidades críticas
- ✅ **Validação real** de operações de sistema
- ✅ **TypeScript strict mode** habilitado
- ✅ **ESLint** configurado e validado
- ✅ **Build otimizado** para produção

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## 📚 Material Educacional

Este projeto inclui o **curso completo de Agentes de IA da Hugging Face** na pasta `course/`:

- **Unit 0-4**: Curso principal desde fundamentos até casos de uso avançados
- **Bonus Units**: Conteúdo adicional sobre fine-tuning, observabilidade e jogos
- **Exemplos práticos**: Implementações com smolagents, LlamaIndex e LangGraph

Para acessar o material do curso:
```bash
cd course/
```

## 🤝 Contribuição

Contribuições são bem-vindas! Por favor, leia o guia de contribuição antes de submeter PRs.