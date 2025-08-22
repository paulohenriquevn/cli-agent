# TRD - CLI Agent AI

## Visão Geral
O componente CLI Agent AI é uma ferramenta embutida em cada container DinD que atua como uma ponte entre a LLM geradora de código e o ambiente de desenvolvimento. Ela interpreta comandos, aplica modificações no código-fonte local e pode iniciar snapshots sob demanda.

## Objetivos
- Servir como agente executor no ambiente DinD.
- Receber comandos da LLM ou do Orquestrador (via API/sockets).
- Realizar operações no filesystem do projeto (criação, modificação, deleção).
- Interagir com a LLM em modo assíncrono e com controle de estado.

## Funcionalidades

### 1. Comando `apply`
Executa instruções de modificação no código. Exemplo: criar arquivos, inserir código, atualizar trechos.

### 2. Comando `snapshot`
Gera um novo snapshot do projeto e envia ao Servidor de Snapshots.

### 3. Comando `restart`
Reinicia o processo de hotreload se necessário.

### 4. Comando `status`
Retorna status atual do ambiente (stack, processos rodando, últimas ações).

### 5. Comando `logs`
Exibe logs da aplicação em execução.

## Interface de Comunicação
- WebSocket (preferencial)
- REST API (fallback)

## Composição
- Script CLI Python (ou Node) com entrypoint unificado.
- Interpretação semântica de comandos simples da LLM.
- Atualização incremental do código com segurança (parser, AST, etc).

## Segurança
- Token por ambiente DinD para autenticação das ações remotas.
- Timeout e rollback parcial em caso de erro grave.

## Observabilidade
- Log local e centralizado de todas as ações feitas pela CLI.
- Histórico dos comandos executados por projeto.

## Extensões Futuras
- Integração com VS Code remoto (via `code-server`).
- Acesso via terminal remoto em ambiente web.
- Execução de testes automatizados sob demanda.

---
Próximo TRD sugerido: **Gerador de Código / LLM Interface**. Deseja continuar com esse?

