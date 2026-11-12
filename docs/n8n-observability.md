# Cobertura das consultas n8n

A tela Automações, o contexto operacional e o MCP `automacoes_operacionais` consultam a mesma função em `src/server/ops.ts`. São leituras; não executam workflows, enviam mensagens ou resolvem ocorrências.

## Fontes independentes

Cada instância consulta inventário e execuções em paralelo. Uma resposta inválida ou indisponível não elimina a resposta válida da outra consulta. Se uma página posterior do inventário falhar, as páginas válidas permanecem como amostra parcial. IDs repetidos entre páginas não aumentam a contagem.

- `ok`: ambas as consultas responderam com o contrato esperado; não comprova execução saudável dos workflows.
- `workflowsAvailable`: todas as páginas tentadas foram recebidas e validadas. `workflowsPartial` ainda indica cursor repetido ou limite de dez páginas; também indica páginas preservadas antes de falha posterior.
- `executionsAvailable`: a página de execuções respondeu com contrato válido. Falha não equivale a zero execuções.
- `errorsPartial`: a API informou outra página. A leitura traz até 25 falhas; a lista não representa todo o histórico.
- `error` e `executionsError`: mensagens controladas da aplicação; não propagam payloads, credenciais ou detalhes do transporte.

O gráfico soma apenas os registros presentes nos seus 14 dias de calendário. A lista pode incluir ocorrências antigas ainda abertas e execuções antigas da API; seu total é separado do gráfico. Com cobertura indisponível e sem registros, o indicador exibe ausência de dado em vez de zero confirmado.

## Documentação do vault

Uma linha de `Automações Ativas` pode conter vários IDs separados por vírgula, ponto e vírgula ou quebra HTML. `ids` preserva todos; `id` mantém o primeiro por compatibilidade. A comparação exige vínculo de instância pelo hostname documentado, pelo nome exato do ambiente ou pelo identificador VPS. IDs de outro runtime não comprovam documentação do workflow n8n.

Documentado, configurado, consultado, executado e resultado verificado continuam sendo estados distintos. As consultas não criam recibos de execução nem demonstram que o alerta global recebeu todas as falhas.
