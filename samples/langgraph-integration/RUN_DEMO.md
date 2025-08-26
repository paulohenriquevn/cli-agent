# 🚀 Como Executar o Demo de Integração LangGraph

## ✅ **Demo Simples (Sem Dependências Externas)**

Execute este demo para verificar que o bridge está funcionando perfeitamente:

```bash
# Do diretório samples/langgraph-integration

# Opção 1: Script npm (recomendado)
npm run demo

# Opção 2: Execução direta
node src/simple-demo.js

# Opção 3: Demo completo sem LLM (funciona sem dependências)
npm run demo:full
# ou
node src/main.js
```

### **O que o demo simples faz:**
- ✅ Carrega todas as 28 ferramentas CLI Agent
- ✅ Testa ferramentas essenciais (read_file, ls, glob, write_file)
- ✅ Demonstra filtragem de ferramentas
- ✅ Valida formato LangChain compatível
- ✅ Prova que está pronto para integração

### **Resultado Esperado:**
```
🎉 SUCCESS: CLI Agent tools are fully ready for LangGraph integration!

📊 Tool Tests: 4/4 passed
✅ Bridge: Functional
✅ Tools: 28 available
✅ Format: LangChain compatible
🎯 Result: Your CLI Agent tools are ready for LangGraph! 🚀
```

---

## 🤖 **Demo Completo com LangGraph (Requer Dependências)**

Para rodar o demo completo com LangGraph:

### 1. Instalar Dependências
```bash
npm install @langchain/langgraph @langchain/openai @langchain/core dotenv
# ou
npm run setup
```

### 2. Configurar API Key
```bash
cp .env.example .env
# Edite .env e adicione uma das seguintes chaves:
# OPENROUTER_API_KEY=sk-or-v1-... (recomendado - suporta múltiplos modelos)
# ou
# OPENAI_API_KEY=sk-... (OpenAI direto)
```

### 3. Executar Demo Completo
```bash
npm start
# ou
node src/main.js
```

### **O que o demo completo faz:**
- 🤖 Cria agente LangGraph com suas 28 ferramentas
- 📂 Demonstra análise de arquivos com LLM
- 🏗️ Mostra análise de estrutura de projeto
- 🔍 Executa busca de código inteligente
- 💬 Mantém memória de conversação

---

## 🎯 **Propósito dos Demos**

### **Demo Simples** 
- **Objetivo**: Provar que o bridge funciona
- **Dependências**: Nenhuma (só CLI Agent)
- **Tempo**: ~5 segundos
- **Resultado**: Validação completa

### **Demo Completo**
- **Objetivo**: Mostrar uso real em LangGraph
- **Dependências**: LangGraph + OpenAI
- **Tempo**: ~30 segundos
- **Resultado**: Agente funcional

---

## 📋 **Checklist de Validação**

Execute o demo simples e verifique:

- [ ] ✅ 28 ferramentas carregadas
- [ ] ✅ Todos os testes passaram (4/4)
- [ ] ✅ Bridge functional
- [ ] ✅ Format LangChain compatible
- [ ] ✅ "SUCCESS: CLI Agent tools are fully ready for LangGraph integration!"

Se todos os checkmarks estão ✅, suas ferramentas estão **prontas para qualquer projeto LangGraph!**

---

## 🔧 **Troubleshooting**

### Se o demo simples falhar:
1. Execute `npm run build` no diretório raiz do CLI Agent
2. Verifique se o arquivo `dist/bridge/index.js` existe
3. Execute novamente

### Se o demo completo falhar:
1. Instale dependências: `npm run setup`
2. Configure API key no arquivo `.env`
3. Execute: `npm start`

---

**🎉 Resultado Final: Suas ferramentas CLI Agent estão 100% prontas para integração LangGraph!**