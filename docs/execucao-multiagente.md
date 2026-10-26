# Execução multiagente das tarefas da Empresa

Cada tarefa interna da Empresa tem **no máximo um responsável**. Assim vários agentes (Tom, Hermes Oracle, Claude Code, Codex…) e Antonio trabalham ao mesmo tempo sem pegar a mesma tarefa.

## Estados

| Status | Responsável | Significado |
| --- | --- | --- |
| A fazer | — | Livre na fila |
| A fazer | preenchido | Assumida, aguardando início |
| Em andamento | preenchido | Sendo executada pelo responsável |
| Concluída | preenchido | Quem concluiu fica registrado |

Reservas em andamento há mais de 48 h aparecem destacadas em amarelo para conferência. Nada é liberado automaticamente.

## Agentes (MCP, escopo `tarefas`)

1. `fila_empresa` — lista as tarefas abertas: livres primeiro (prioridade, prazo, antiguidade), depois as já assumidas com o responsável.
2. `assumir_tarefa { id, plano? }` — reserva atômica: uma única instrução condicional coloca a tarefa em andamento com o nome do agente autenticado. Se outro já assumiu, falha e informa quem. Repetir com o mesmo agente é seguro e não reinicia o relógio.
3. `atualizar_minha_tarefa` — progresso e conclusão com evidência (já existente). Agora vale também para tarefas assumidas; um pedido marcado com a tag do agente não pode ser alterado por ele depois que outro responsável o assumiu.
4. `liberar_tarefa { id, motivo }` — devolve à fila (a fazer, sem responsável) com o motivo e o ponto em que parou. Só o responsável pode liberar.

Toda reserva e liberação entra no histórico (notas) da tarefa e na atividade do agente.

## Proprietário (interface)

- `/tarefas?escopo=empresa` mostra o selo do responsável em cada tarefa e a visão **Em andamento**, agrupada por responsável.
- No detalhe da tarefa, o campo **Responsável** sugere Antonio, os agentes com acesso ativo e nomes já usados; o botão **Assumir** reserva para Antonio e coloca em andamento.
- A atribuição pela interface prevalece sobre a reserva de um agente (reatribuir é decisão do proprietário).
- A ORBE e as ferramentas `orbita_*` de admin aceitam `responsavel` em `atualizar_tarefa`.

## Dados

Migração `0005_responsavel_tarefas`: colunas `tasks.assignee` (texto) e `tasks.claimed_at`, mais índice `(scope, assignee)`. Só adiciona colunas; tarefas existentes ficam sem responsável até alguém assumir ou atribuir.
