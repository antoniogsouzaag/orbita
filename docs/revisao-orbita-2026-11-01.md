# Revisão da Órbita e do ecossistema — 01/11/2026

## Base e cobertura

Checkout inicialmente em `main`, sincronizado com `origin/main` em `5dcfd4b`. A pasta local `.claude/` já existia e foi preservada. Foram consultados manual MCP 2026-10-29.3, notas empresariais, ficha canônica da Órbita, Automações Ativas, GitHub, diagnóstico de integrações, disponibilidade, workflows e interface autenticada. Os resultados abaixo são um retrato da consulta, não certificação de todas as jornadas.

Às 04h32 de Brasília, disponibilidade: 36/36 endereços com verificação recente; três monitores com batida; banco, vault (87 notas), CRM, duas instâncias n8n e agregados dos seis produtos responderam. n8n: 34/117 workflows ativos; API retornou seis falhas históricas, enquanto a ingestão não tinha falhas abertas. Telegram respondeu à consulta de configuração, sem envio; Postiz retornou 14 canais, sem publicação. Resumo diário e acionamento dos agentes continuam distinguindo configuração de execução.

## Ajustes desta rodada

- Feedback sai da sidebar e passa ao botão no título de Negócios. Novos feedbacks empresariais aparecem nos avisos com ID estável, acesso autenticado e link para o produto; o espaço Pessoal não consulta essa fonte. O polling consulta o CRM com cache de 30 segundos e compartilha requisições simultâneas. A triagem invalida esse cache. A indisponibilidade não remove avisos locais nem é apresentada como ausência confirmada.
- O comando explícito **Limpar** marca os avisos atuais como lidos, preservando **Ver lidos**. A leitura individual continua ocorrendo ao abrir um aviso. A preferência é deste navegador, não uma confirmação global entre dispositivos. Incidentes permanecem na origem até sua resolução.
- O avatar da sidebar reutiliza o menu de conta do topo.
- Tags das tarefas ganham busca, filtro ativo removível e rolagem limitada. As colunas do Kanban têm rolagem própria e não alongam a página inteira.
- Clique em tarefa abre modal de leitura; **Editar tarefa** abre o painel existente. Notas permanecem com modal de leitura e editor no painel normal.
- Confirmações nativas do navegador passam a um modal acessível, com cancelamento em foco e autorização explícita antes da mutação. Nenhuma confirmação foi removida.
- A tela Automações mantém workflows n8n, falhas e informação de cobertura parcial. A extensa lista de rotinas sem estado recebido e os cards de comparação do vault saem dessa tela. O inventário canônico continua disponível pelo link para o vault.
- Contadores da página de tarefas passam a usar agregados, sem carregar três listas completas e suas subtarefas apenas para contar. A consulta de concluídas do Kanban começa em paralelo. As seções principais ganham estado de carregamento.
- Ferramentas locais deixam de incluir `.claude/worktrees` nas verificações do checkout principal. Conteúdo dessas cópias é preservado.

## Conciliação das anotações

| Nota | Evidência e tratamento |
| --- | --- |
| Menu ORBE sem seleção | Correção no código atual, testes de navegação e PR #84 mesclado (`123961379d909b1215210e3cb062c23b4f50d0ee`). Registrar evidência e arquivar preservando conteúdo. |
| Modal da nota e autosave | Já implementados no PR #84; não refazer nem tratar como nova pendência. |
| Modal da tarefa; confirmações nativas; notificações | Cobertos nesta alteração; a baixa depende de publicação e verificação do comportamento. |
| Telas lentas | Melhorias concretas implementadas, mas a medição comparativa autenticada de produção ainda é um critério separado. Não declarar toda a nota concluída só porque existem skeletons. |
| Feedback centralizado | Órbita #85, CRM #61, Members #55, Viajeki #41 e Barberias #148 constam mesclados. Isso corrige “tudo em PR”, mas não prova entrega real app → CRM em todos os produtos. |
| Configurações: créditos e extrato | O texto descreve AG LABS App, não a configuração da Órbita. Preservar como pendência do produto de origem até conferir sua tela e entrega. |
| Planos de redes e pendências de 29/10 | Misturam entregas antigas, decisões e trabalho de outros produtos. Preservar itens abertos e acrescentar conciliação; não arquivar o plano inteiro. |

## Melhorias priorizadas para a continuidade

1. **Confiabilidade de alertas:** reconciliar as seis falhas históricas da API com os recibos de ingestão. Distinguir testes temporários de falhas reais sem apagá-los ou presumir cobertura do alerta global. Critério: uma falha real autorizada, sanitizada e rastreável do n8n até a ocorrência na Órbita, com resolução e sem duplicação. Não houve disparo de workflows ou mensagens nesta revisão.
2. **Alerta legado Members:** continua aberto o relato de divergência 10%/6,99%. O histórico de 29/10 já registra uma correção relatada pelo Tom; confirmar o registro original atual antes de encerrar. Não alterar taxa comercial a partir de um alerta antigo.
3. **Entregas completas por produto:** consolidar evidência de feedback, cadastro, assinatura, estorno e revogação no app → CRM → Órbita, com IDs e recibos idempotentes. Os agregados responderem não certifica esses caminhos. Não usar pagamento ou mensagem a cliente como teste.
4. **Vault útil e atual:** o índice de automações ainda descreve rotinas de vários runtimes como inventário; a tela operacional deve mostrar só o que consulta. Atualizar sua descrição e a ficha da Órbita ao publicar. A tabela canônica contém células com múltiplos IDs que o parser pode não comparar integralmente; documentação não deve ser tomada como prova de execução ou contagem exata de workflows.
5. **Desempenho mensurável:** medir navegação, abertura de modal e chamadas servidor nas cinco seções principais, antes/depois, com a mesma massa de dados e dispositivo. Reduzir gradualmente invalidações de todo o layout, preservando contadores, projetos, início e avisos; não trocar todas por invalidação local sem validar dependências.
6. **Qualidade operacional dos agentes:** continuar a matriz supervisionada da ORBE e verificar versão do conhecimento montado em cada runtime. Repositório sincronizado, token presente ou tarefa concluída não comprovam execução nem qualidade factual.

## Validação e publicação

Os resultados finais de typecheck, lint, testes, build, commit, PR e deploy são registrados no PR e na conciliação das notas. Pendências externas, limitações dos provedores e validação humana não são convertidas em checks aprovados.
