# 🚀 CLI Agent Development Guidelines

## Princípios Fundamentais de Desenvolvimento

Este documento estabelece as regras não-negociáveis para desenvolvimento do CLI Agent SDK, baseadas nos princípios KISS, FAST-FAIL e DRY.

---

## 🎯 KISS - Keep It Simple, Stupid

### Definição
**Simplicidade é a máxima sofisticação.** Mantenha soluções simples, diretas e compreensíveis.

### Regras KISS

#### ✅ **DEVE Fazer:**
- **Uma responsabilidade por função/classe**: Cada componente deve ter apenas um propósito claro
- **Nomenclatura descritiva**: `createLangChainTool()` vs `processStuff()`  
- **Lógica linear**: Evite nested callbacks e condicionais complexas
- **APIs intuitivas**: Se precisa documentação extensa, está muito complexo
- **Soluções diretas**: Resolva o problema específico, não todos os problemas futuros

#### ❌ **NUNCA Faça:**
- **Over-engineering**: Planejar para todos os cenários futuros possíveis
- **Abstrações prematuras**: Não abstraia até ter 3+ casos de uso reais
- **Clever code**: Código inteligente demais é código impossível de manter
- **Kitchen sink classes**: Classes que fazem "tudo um pouco"
- **Configurações desnecessárias**: Se pode ser hard-coded com segurança, faça

#### 📏 **Métricas KISS:**
- **Complexidade ciclomática < 10** por função
- **Profundidade de aninhamento ≤ 3** níveis
- **Linhas por função ≤ 50**
- **Parâmetros por função ≤ 5**

---

## ⚡ FAST-FAIL - Falhe Rápido e Cedo

### Definição
**Detecte e reporte erros imediatamente**, antes que se propaguem ou corrompam o sistema.

### Regras FAST-FAIL

#### ✅ **DEVE Fazer:**
- **Validação de entrada**: Rejeite inputs inválidos na primeira linha da função
- **Guards claros**: Use `if (!condition) throw new Error()` no início
- **Tipos estritos**: TypeScript strict mode, sem `any` desnecessário
- **Falhas visíveis**: Erros claros e específicos, não genéricos
- **Fail atomically**: Se uma operação falha, desfaça mudanças parciais

#### ❌ **NUNCA Faça:**
- **Fail silently**: `catch (e) { /* ignore */ }`
- **Default values perigosos**: Não assuma valores quando input é inválido
- **Continue com estado corrompido**: Se há inconsistência, pare
- **Logs em vez de erros**: Log é informação, erro é interrupção
- **Magic numbers**: Use constantes nomeadas para validações

#### 🔧 **Padrões FAST-FAIL:**

```typescript
// ✅ CORRETO - Falha imediatamente
function createTool(name: string, description: string) {
  if (!name || name.trim() === '') {
    throw new Error(`Tool name cannot be empty`);
  }
  if (!description || description.length < 10) {
    throw new Error(`Tool description must be at least 10 characters`);
  }
  // ... resto da lógica
}

// ❌ ERRADO - Falha tardia/silenciosa  
function createTool(name?: string, description?: string) {
  const toolName = name || 'default'; // ❌ Mascara o problema
  const toolDesc = description || ''; // ❌ Estado inválido aceito
  // ... lógica pode falhar depois
}
```

---

## 🎭 DRY - Don't Repeat Yourself  

### Definição
**Cada conhecimento deve ter uma representação única, não-ambígua e autoritativa no sistema.**

### Regras DRY

#### ✅ **DEVE Fazer:**
- **Single Source of Truth**: Uma definição por conceito
- **Extrair constantes**: Valores duplicados → constantes nomeadas
- **Funções utilitárias**: Lógica repetida → função reutilizável  
- **Herança/Composição**: Comportamento comum → base classes/mixins
- **Template patterns**: Estruturas similares → templates/generators

#### ❌ **NUNCA Faça:**
- **Copy-paste code**: Duplicar código sem abstrair
- **Magic numbers repetidos**: Mesmo valor hardcoded em vários lugares
- **Lógica similar espalhada**: Validações/transformações duplicadas
- **Configurações redundantes**: Mesmo config em múltiplos arquivos
- **Abstrações prematuras**: DRY após 3+ repetições, não antes

#### 🏗️ **Estratégias DRY:**

```typescript
// ❌ VIOLAÇÃO DRY - Lógica duplicada
class ReadTool {
  invoke() {
    if (!this.context) throw new Error('Context required');
    if (!this.filePath) throw new Error('FilePath required'); 
    // ... lógica de validação
  }
}

class WriteTool {
  invoke() {
    if (!this.context) throw new Error('Context required');
    if (!this.filePath) throw new Error('FilePath required');
    // ... mesma lógica de validação ❌
  }
}

// ✅ SOLUÇÃO DRY - Validação centralizada
abstract class BaseTool {
  protected validateRequired(context: any, filePath: string) {
    if (!context) throw new Error('Context required');
    if (!filePath) throw new Error('FilePath required');
  }
}

class ReadTool extends BaseTool {
  invoke() {
    this.validateRequired(this.context, this.filePath);
    // ... lógica específica do read
  }
}
```

---

## 🎯 Aplicação Prática no CLI Agent

### Estrutura de Classes
```
BaseTool (KISS: responsabilidade única)
├── validateInput() (FAST-FAIL: validação imediata)  
├── executeCore() (DRY: lógica compartilhada)
└── handleResult() (FAST-FAIL: tratamento de erro)
```

### Padrão de Error Handling
```typescript
// Template padrão para todas as tools
abstract class BaseTool {
  async invoke(input: unknown): Promise<ToolResult> {
    // FAST-FAIL: Validação imediata
    this.validateInput(input);
    
    try {
      // KISS: Lógica linear e clara
      const result = await this.executeCore(input);
      return this.handleSuccess(result);
    } catch (error) {
      // FAST-FAIL: Erro imediato e claro
      return this.handleError(error);
    }
  }
  
  // DRY: Implementações específicas sobrescrevem apenas o necessário  
  protected abstract validateInput(input: unknown): void;
  protected abstract executeCore(input: unknown): Promise<any>;
}
```

### Métricas de Qualidade
- **KISS**: Complexidade < 10, Aninhamento ≤ 3
- **FAST-FAIL**: 100% validação de entrada, 0% fail silently  
- **DRY**: 0% duplicação de lógica, Single Source of Truth

---

## 🚨 Red Flags - Violações Inaceitáveis

### ❌ **KISS Violations:**
- Classes com mais de 5 responsabilidades
- Funções que fazem mais de uma coisa
- Configurações que ninguém entende

### ❌ **FAST-FAIL Violations:**
- `try/catch` vazios
- Funções que retornam `null` em vez de erro
- Estados inconsistentes aceitos

### ❌ **DRY Violations:**  
- Código copy-paste sem abstrair
- Validações duplicadas
- Constantes mágicas repetidas

---

## ✅ Checklist de Review

Antes de qualquer commit, verificar:

- [ ] **KISS**: Posso explicar este código em 30 segundos?
- [ ] **FAST-FAIL**: Todos os inputs são validados imediatamente?
- [ ] **DRY**: Esta lógica já existe em outro lugar?
- [ ] **TYPES**: TypeScript strict sem `any` desnecessário?
- [ ] **TESTS**: Cenários de erro são testados?

---

**Lembre-se: Princípios não são sugestões. São regras fundamentais que garantem qualidade, manutenibilidade e confiabilidade do código.**