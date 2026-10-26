# Evolução do ecossistema — 26/10/2026

Continuação da [rodada de 25/10](./evolucao-ecossistema-2026-10-25.md). Este registro mantém a diferença entre implementação, merge, publicação e homologação. Não substitui o conhecimento durável do Vault.

## Entregas comprovadas

| Produto | Entrega | Validação e publicação |
| --- | --- | --- |
| Members | [PR 49](https://github.com/aglabs-core/members/pull/49): reconciliação de chargeback com estado anterior preservado, recuperação idempotente e proteção do espelho legado | 1.032 testes unitários, 30 cenários SQL e demais suítes SQL, tipos/lint/build/audit; migration 20261026051904 aplicada com RLS e privilégios conferidos; EasyPanel concluído no merge 71c6960 |
| Órbita | [PR 36](https://github.com/antoniogsouzaag/orbita/pull/36): síntese final mesmo quando as ferramentas retornam sem deltas de texto | CI executado e aprovado; produção READY. A primeira análise real revelou interrupção posterior pelo teto HTTP |
| Órbita | [PR 37](https://github.com/antoniogsouzaag/orbita/pull/37): duração de 180 segundos e detecção de EOF sem terminal | 313 testes, tipos/build e CI aprovados; produção READY em 4237df6; análise real completa, datada e somente leitura, sem aviso de interrupção |
| AG LABS | [PR 122](https://github.com/aglabs-core/aglabs/pull/122): player visual e retorno OAuth carregados sob demanda | 338 testes e três testes OpenAI simulados, tipos/build/audit; Render Live em 9f16dcf |
| AG LABS | [PR 123](https://github.com/aglabs-core/aglabs/pull/123): fontes locais com subconjuntos e licenças preservados | verify aprovado e hashes dos 24 arquivos conferidos; Render Live em 4fcc91f; HTML e inspeção visual sem CSS bloqueante do Google Fonts |
| AG LABS | [PR 124](https://github.com/aglabs-core/aglabs/pull/124): título e apresentação da criação independentes do compositor carregado sob demanda | verify aprovado; merge normal 9230c01 e Render dep-dbffmq0u01pc73809fjg concluído/Live; inspeção visual e controles de criação conferidos, sem geração paga |

O CI da organização continua impedido de iniciar por cobrança/limite da conta. Isso é falha de infraestrutura, não gate remoto aprovado. Os merges foram normais, com gates locais, sem reduzir proteção ou alterar cobrança. O CI próprio da Órbita executou e passou. Nenhuma geração paga, cobrança, mensagem a cliente ou exclusão de conta real foi usada para teste.

Antonio informou que não existe ambiente separado do Members com Asaas Sandbox. A [issue 21](https://github.com/aglabs-core/members/issues/21) permanece aberta apenas para a homologação vertical apropriada. Não simular Sandbox usando credenciais de produção.

## Desempenho observado

Lighthouse 13.5 em Chrome isolado, emulação mobile, uma amostra por etapa, mesma ferramenta e configuração. Não são percentis de usuários reais nem validação em aparelho físico.

| Etapa | Performance | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| Antes desta rodada | 51 | 3,1 s | 5,1 s | 1.050 ms | 0,012 |
| Após PR 122 | 75 | 3,2 s | 4,7 s | 120 ms | 0 |
| Após PR 123 | 80 | 2,5 s | 4,0 s | 160 ms | 0,001 |
| Após PR 124 | 86 | 2,49 s | 3,54 s | 56 ms | 0,040 |

O TBT ficou abaixo de 300 ms nas três últimas amostras; o LCP ainda não atingiu 2,5 segundos. A [issue 110](https://github.com/aglabs-core/aglabs/issues/110) não pode ser encerrada por redução de bundle. O título e a apresentação da criação foram o elemento LCP observado, motivando a PR 124.

## Conciliação da Órbita e fontes

A tarefa existente “Barberias: concluir validação e ativar métricas na Órbita” foi concluída e a evidência persistida nas suas notas, sem criar duplicata. Em 26/10, o superadmin em Todo o período mostrou 29 contas, 25 prontas, dez com primeira reserva e zero pagamentos confirmados. O contrato de métricas exclui a conta de demonstração: 28, 24, nove e zero, respectivamente. A diferença foi reconciliada; ambos indicam 15 prontas sem primeira reserva. Contas, acessos manuais/vitalícios, trials, reservas e pagamentos são entidades distintas.

A análise real final da ORBE consultou as fontes com horário, separou métricas de produto de contatos/clientes globais do CRM e identificou metas como propostas. Não declarou receita inexistente no provedor a partir de ausência de receita registrada no CRM. Não fez despacho, mudança de acesso ou envio de mensagens.

A tarefa “ORBE: avaliar respostas reais e desenhar memória por escopo” continua em andamento: correções publicadas e desenho em [memória por escopo](./orbe-memoria-escopo.md), mas a matriz supervisionada completa, latência/custo e persistência ainda têm critérios por cumprir. Não marcar 24/24 por existir uma matriz ou por uma análise correta.

As duas tarefas adicionadas pelo proprietário — telemetria do VibeKit e conexão administrativa AG LABS → CRM → Órbita — pertencem à fila existente e não serão recriadas. A compra já chegar ao CRM não comprova instrumentação de visita, checkout, ativação, falha ou uso administrativo.

## Ordem de execução a partir das dependências reais

1. **Homologação e CI.** Preparar Members separado com Asaas Sandbox e executar duplicidade/ordem invertida/disputa ganha e perdida, sem usuários de produção. O proprietário precisa resolver a cobrança/cota do Actions; conservar gates e normalidade dos merges.
2. **Estornos e saldo AG LABS.** [Issue 107](https://github.com/aglabs-core/aglabs/issues/107): implementação proposta na [PR 126 em rascunho](https://github.com/aglabs-core/aglabs/pull/126), com coordenador transacional, FIFO cumulativo, leitura autoritativa dos provedores e caminho comum com reembolso interno e devoluções de mídia, áudio e texto. Gates locais: 389 testes e três OpenAI simulados, tipos/build/audit; revisão final com tipos e 41 cenários financeiros focados aprovados. Ainda faltam homologação em Stripe/Mercado Pago de teste, concorrência em PostgreSQL real e revisão final dos handlers e tratamento de divergências. Sem merge, migration ou publicação financeira em produção.
3. **Exclusão operacional segura.** [AG 103](https://github.com/aglabs-core/aglabs/issues/103) e [MeCard 11](https://github.com/aglabs-core/mecard/issues/11): processo retomável, cancelamento confirmado, limpeza pública/storage e anonimização. Registro financeiro mínimo deve sobreviver separado da identidade de acesso. A proposta de retenção não é política aprovada nem autoriza purga universal em cinco anos; definir bases, marco inicial e exceções com contabilidade/jurídico.
4. **Telemetria dos produtos.** Começar pela perda real de ativação do Barberias e pelo funil VibeKit solicitado. Contrato versionado, produto/ambiente/evento, horário de ocorrência e recebimento, deduplicação/outbox, distinção entre tentativa e pagamento liquidado. CRM recebe apenas dados necessários ao relacionamento e agregados administrativos; Órbita consome visão datada, sem PII. Comparar com a origem antes de ligar cada novo produto.
5. **AG LABS → CRM → Órbita.** Expor primeiro contas, ativação, uso, assinatura e pagamentos confirmados com suas definições e janelas. Métricas operacionais não devem promover automaticamente um contato a Cliente. Depois conectar a ferramenta de agregados já existente na Órbita, sem conceder escrita nos apps.
6. **ORBE e ferramentas por app.** Terminar a matriz supervisionada e medir uso/latência sem texto sensível. Fatos aprovados por escopo somente após contrato de aprovação, origem, versão, acesso e retenção. Validar privacidade/orçamento antes de MCP de mídia; Members começa por catálogo/rascunho/oferta/link e Barberias por diagnóstico. Sem geração, envio ou concessão de acesso por inferência.
7. **Vault e agentes.** Atualizar apenas notas canônicas quando houver mudança durável aprovada. Tom/Hermes mantêm os papéis registrados e os canais existentes. Pedido recebido, execução iniciada e entrega verificada são estados diferentes; não criar outro diretor nem ampliar acesso para acelerar a fila.

As cinco issues funcionais acima continuam abertas pelos critérios restantes. As oito tarefas internas abertas da Órbita representam entregas distintas; o encerramento do backlog depende dessas evidências, não da quantidade de PRs integradas. Não foram criadas campanhas, novas automações ou tarefas duplicadas nesta conciliação.

## Preparação de homologação e limites desta continuação

Antonio confirmou que também não existe ambiente separado de teste Stripe/Mercado Pago para a AG LABS. A PR 126 fica em rascunho; testes em PostgreSQL WASM e APIs simuladas não substituem esse ambiente. A consulta de revisão financeira proposta usa apenas autenticação/admin existentes e não fornece liberação manual de saldo.

A [PR Members 50](https://github.com/aglabs-core/members/pull/50) foi integrada em `5291388`, com 1.043 testes/140 arquivos, todas as suítes SQL, lint/tipos/build e audit aprovados. Inclui preflight offline, exemplo sem credenciais, bloqueio de configuração insegura quando `MEMBERS_ENVIRONMENT=homologation` e [roteiro de provisionamento e testes](https://github.com/aglabs-core/members/blob/master/docs/homologacao-chargeback.md). A configuração de produção sem esse marcador mantém o comportamento existente. O pool local de forks falhou ao iniciar workers; toda a suíte foi reexecutada em duas threads, sem desabilitar casos.

Essa preparação não criou projeto Supabase, conta Asaas, domínio, credencial ou cobrança. A checagem estática não verifica a validade das chaves nem configura o SMTP do Supabase ou as notificações do Asaas. O roteiro inclui esses canais porque desligar Resend não impede mensagens dos outros provedores. Antonio confirmou que publicou a PR 50 manualmente; a home respondeu 200 na checagem posterior. O log autenticado do deployment não foi inspecionado, pois o navegador local ficou desativado ao trocar o login na mesma sessão, conforme esclarecimento do proprietário. A correção financeira da PR 49 já havia sido publicada; a homologação vertical continua pendente.

## Mapeamento inicial da telemetria do VibeKit

O clone antigo do proprietário estava em `cfd0476`; a análise usou uma cópia isolada do GitHub `2f5d218`. Nenhum arquivo do clone original foi alterado. O checkout atual continua no Stripe e já envia Meta `PageView`, `ViewContent` e `InitiateCheckout`; o webhook persiste compras pagas e a liberação de GitHub grava `grantedAt`/times concedidos. Isso não constitui um funil administrativo de visitas, tentativas, falhas, compra e ativação no CRM.

O coletor administrativo atual do CRM permite apenas Barberias, MeCard e Members e projeta métricas de usuários/contas/assinaturas. Não transportar pedidos pagos do VibeKit como se fossem contas SaaS ou assinaturas ativas. A próxima implementação precisa de contrato próprio de comércio: contagens de eventos por janela, checkout criado, compra confirmada e acesso provisionado, com cobertura inicial explícita e sem confundir visita à página `/sucesso` com pagamento confirmado. O resumo entregue à Órbita deve preservar fonte, janela e limites; não receber e-mail, login GitHub, token de acesso ou URL com `session_id`.

A automação de compra → CRM informada pelo proprietário deve ser preservada. A busca por nome “VibeKit” nos dois n8n conectados não retornou workflows, o que não comprova ausência: o fluxo pode ter outro nome ou origem. Nenhum workflow foi criado, executado ou alterado, e a instrumentação nova ainda não foi implementada ou publicada nesta etapa. O registro permanece na tarefa existente.
