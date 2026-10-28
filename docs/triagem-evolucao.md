# Triagem e execução da evolução do ecossistema

Diretriz de Antonio atualizada em 25/10/2026: correção de bugs, conformidade (incluindo LGPD), consistência, UX, telemetria e desempenho são trabalho de execução. Não apresentar novamente como proposta a correção de um comportamento comprovadamente incorreto. Autenticação, cobrança e acesso exigem validação proporcional, mas a área afetada, sozinha, não transforma uma correção autorizada em decisão de negócio. Isto não ativa automações, despachos nem amplia o privilégio de ORBE/JEV/MCP.

## Fluxo

1. Conferir default branch, SHA, issues, PRs e implementação real antes de agir. Não confiar só no título, rótulo ou relatório de ontem.
2. Reutilizar issue canônica. Duplicada aponta para original; implementada precisa commit/PR e evidência. Não fechar uma issue só para reduzir o contador.
3. Correção autorizada: reproduzir, implementar lote coerente, testar, revisar, integrar e verificar publicação quando autorizada. Para autenticação, isolamento e pagamentos, testar também acesso indevido, eventos antigos, duplicidade e falha parcial, conforme o caso. Estado de implantação e jornada real separado do merge.
4. Decisão real: registrar a escolha concreta que falta, impacto e recomendação. Novas regras comerciais, finalidade ou prazo de retenção, ampliação de acesso e ações irreversíveis sobre dados reais não são autorizados apenas pelo pedido de corrigir bugs. Implementar e validar a parte técnica independente antes de solicitar a escolha restante. Não executar pagamentos, excluir contas reais nem disparar mensagens a clientes para testar.
5. Se infraestrutura/cota/gate bloquear, continua fila de execução com bloqueio e condição de retomada, não nova proposta a Antonio nem conclusão inventada. Não comprar minutos, dispensar gates ou usar produção como teste financeiro.

## Rótulos e painel

- execucao: correção/evolução autorizada para trabalho técnico. Não significa implementada/publicada.
- decisao: falta uma escolha concreta de negócio, política, acesso ou ação irreversível. Deve explicar qual escolha falta; mencionar LGPD, login ou pagamento não basta. Em conflito com execucao prevalece decisão até reconciliação individual com evidência.
- bloqueado: modificador, por exemplo cota de CI, ambiente ou aprovação necessária. Informar causa e próximo critério na issue/PR.
- proposta: legado ainda a classificar; não inferir decisão só por existir esse prefixo no título.
- aprovado: legado tratado como execução se a issue continuar aberta, sem desaparecer da central.
- recusado: excluído da fila ativa; fechamento/justificativa deve preservar histórico.

Títulos de itens puramente técnicos deixam o prefixo Proposta após triagem comprovada. Encerrar só duplicatas/resolvidos com evidência; problemas reais não deixam de existir por mudar o rótulo.

## Fonte e limites

GitHub é a fonte da implementação (issues/PRs/checks). Órbita consulta PRs e todas as issues abertas não recusadas na organização configurada. Issues sem etiqueta de execução ou decisão aparecem em A classificar, sem inferir aprovação ou risco. Contagens são dos itens carregados, respeitando cobertura do token, limite de 100 por busca e aviso de parcialidade/erro; issues recusadas e repositórios arquivados ficam fora. Cache de 5 minutos; o botão Atualizar GitHub força renovação. O MCP de leitura usa a mesma classificação. Não é um agendamento ou agente autônomo.

Se uma atualização falhar, o último snapshot válido (inclusive vazio) mantém a data original e o aviso de desatualização nas próximas consultas. Uma falha reduz o intervalo de nova tentativa para um minuto; a atualização explícita ignora esse intervalo. Recusa de acesso não reapresenta dados antigos. Consultas simultâneas da mesma organização e credencial compartilham a atualização em andamento no processo; isso não é cache distribuído. Resposta malformada não é considerada fonte verificada.

Não prometer cobertura de todos os repositórios privados, organizações ou contas pessoais fora da origem consultada. Não copiar tickets inteiros para tarefas paralelas que podem divergir. Revisão/implementação/publicação/jornada validada são estados diferentes.
