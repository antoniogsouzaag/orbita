# Triagem e execução da evolução do ecossistema

Decisão de Antonio em24/10/2026: bugs e melhorias delimitadas de baixo risco são trabalho de execução, não pedidos repetidos de aprovação. Mudança estrutural, diretriz, regra de negócio ou impacto sensível depende de sua decisão. Isto não ativa automações, despachos nem amplia o privilégio de ORBE/JEV/MCP.

## Fluxo

1. Conferir default branch, SHA, issues, PRs e implementação real antes de agir. Não confiar só no título, rótulo ou relatório de ontem.
2. Reutilizar issue canônica. Duplicada aponta para original; implementada precisa commit/PR e evidência. Não fechar uma issue só para reduzir o contador.
3. Baixo risco: reproduzir, implementar lote pequeno, testar, revisar, integrar e verificar publicação quando autorizada. Estado de implantação e jornada real separado do merge.
4. Sensível: registrar a decisão concreta que falta, impacto e recomendação. Não chamar todo bug técnico de mudança comercial; correção de comportamento documentado pode ser execução, mas não dispensa validação proporcional.
5. Se infraestrutura/cota/gate bloquear, continua fila de execução com bloqueio e condição de retomada, não nova proposta a Antonio nem conclusão inventada. Não comprar minutos, dispensar gates ou usar produção como teste financeiro.

## Rótulos e painel

- execucao: correção/evolução autorizada para trabalho técnico. Não significa implementada/publicada.
- decisao: falta uma escolha estrutural, comercial, sensível ou de política. Em conflito com execucao prevalece decisão até reconciliação.
- bloqueado: modificador, por exemplo cota de CI, ambiente ou aprovação necessária. Informar causa e próximo critério na issue/PR.
- proposta: legado ainda a classificar; não inferir decisão só por existir esse prefixo no título.
- aprovado: legado tratado como execução se a issue continuar aberta, sem desaparecer da central.
- recusado: excluído da fila ativa; fechamento/justificativa deve preservar histórico.

Títulos de itens puramente técnicos deixam o prefixo Proposta após triagem comprovada. Encerrar só duplicatas/resolvidos com evidência; problemas reais não deixam de existir por mudar o rótulo.

## Fonte e limites

GitHub é a fonte da implementação (issues/PRs/checks). Órbita consulta PRs e issues abertas com proposta,execucao,decisao na organização configurada; contagens são dos itens carregados, respeitando cobertura do token, limite100 por busca e aviso de parcialidade/erro. Cache de5minutos, botão Atualizar GitHub força renovação. O MCP de leitura usa a mesma classificação. Não é um agendamento ou agente autônomo.

Não prometer cobertura de todos os repositórios privados, organizações ou contas pessoais fora da origem consultada. Não copiar tickets inteiros para tarefas paralelas que podem divergir. Revisão/implementação/publicação/jornada validada são estados diferentes.
