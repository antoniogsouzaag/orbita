# Evolução do ecossistema — 25/10/2026

## Resultado e limite da rodada

Antonio autorizou escolher as opções de implementação, concluir propostas e organizar a próxima evolução. Propostas funcionais receberam estado de execução; encerramento por implementação precisa de evidência. A integração não comprova publicação e uma resposta pública 200 não comprova uma jornada autenticada.

| Produto | Integração | Validação local | Publicação observada |
|---|---|---|---|
| Órbita | [PR 33](https://github.com/antoniogsouzaag/orbita/pull/33), `ce14cd1` | 304 testes, tipos, lint e build | Vercel Production READY no mesmo commit; seis notas pessoais arquivadas pela interface |
| Viajeki | [PR 39](https://github.com/aglabs-core/viajeki/pull/39), `922c2c7` | 174 testes, tipos, lint, 24 migrations, build e auditoria | EasyPanel concluiu o deployment identificado pelo PR 39 |
| MeCard | [PR 52](https://github.com/aglabs-core/mecard/pull/52), `d15d187` | 557 testes, 107 cenários de autenticação simulada, 208 E2E, SQL, Cloudflare, lint, build e auditoria | Workers Builds de produção aprovado no commit integrado |
| Barber-PRO | [PR 143](https://github.com/aglabs-core/barberias/pull/143), `6e7379d` | 395 testes frontend, 550 backend, 100 controles de segurança, tipos, lint, build e auditoria | EasyPanel concluiu o deployment identificado pelo PR 143 |
| Members | [PR 48](https://github.com/aglabs-core/members/pull/48), `0b139b8` | 1.013 testes, SQL, tipos, lint, build e auditoria | EasyPanel concluiu o deployment identificado pelo PR 48 |
| AG LABS | [PR 119](https://github.com/aglabs-core/aglabs/pull/119), `a01b107`; [PR 120](https://github.com/aglabs-core/aglabs/pull/120), `da2b2da` | 338 testes no lote final, três testes de OpenAI simulado, tipos, build e auditoria | Render `dep-dbfa8j4s728c73em3lag` concluído e Live no commit `da2b2da` |

O Actions da organização falhou antes dos passos por cobrança/limite da conta. Os merges autorizados usaram o mecanismo normal, sem alteração de proteção ou configuração de cobrança. Os gates locais não são apresentados como execução remota verde. O CI próprio da Órbita passou no PR 33.

O Render ainda servia `5b7e5bb`, de dez dias antes, e foi atualizado manualmente. Antes da publicação, uma consulta somente leitura confirmou 63 migrations até `0064_welcome_credits_acknowledgement.sql` e a presença dos requisitos de produção, sem expor valores secretos. O comando de pré-deploy do painel estava vazio; a estrutura do banco já correspondia ao código desta entrega. A configuração de auto-deploy após checks foi preservada.

Respostas públicas observadas: Viajeki e Members 200; Barberias `/health` 200/OK; AG LABS `/api/health` 200. Órbita sem autenticação redireciona ao login. MeCard `https://mecard.com.br` renderizou a home no Chrome; a consulta automatizada recebeu 403, por isso não foi registrada como um health 200. Essas observações não substituem a jornada autenticada.

## Escolhas implementadas

- Notas pessoais concluídas ficam arquivadas e restauráveis; busca e ORBE não as trazem como pendências ativas. Conteúdo e separação Pessoal/Empresa são preservados.
- Viajeki: recuperação idempotente de faturas, confirmação do cancelamento do Pix antes de substituição/exclusão, margem de validade do QR Code, estados de falha/chargeback e webhook 404, quotas restituídas após falha da IA, roteiro em blocos limitados, ordem relativa de paradas protegidas, desafios MFA e recodificação de imagens para remover metadados.
- MeCard: retirada dos adaptadores Vercel legados, preservando os handlers Cloudflare ativos e a implementação de perfil já existente.
- Barber-PRO: mídia de promoção restrita ao tenant e à pasta esperada; fila de limpeza persistida junto com a configuração, com revalidação do uso e repetição segura após falha do R2.
- Members: retomada do Pix do pedido existente, conferindo titularidade e vínculo no provedor antes de mostrar QR Code; conciliação e valores originais preservados.
- AG LABS: débito e job de geração na mesma transação, chave idempotente da intenção na home, cadastro e desafios por e-mail via Clerk em português, bloqueio de assinaturas paralelas e gestão pelo portal Stripe com titularidade validada. O extrato/histórico de reembolso existente justificou o encerramento da issue 109.

Não foram feitos pagamentos, gerações pagas, disparos de e-mail/WhatsApp, exclusões de contas ou limpeza de arquivos reais como teste. Os cenários de autenticação/provedor foram simulados. A disponibilidade do portal Stripe e as jornadas financeiras em Sandbox continuam exigindo validação própria.

## Diagnóstico do conjunto

### Fontes e contexto da empresa

O Vault define identidade, produtos, responsabilidades e processos duráveis. A AG LABS mantém serviços e produtos próprios como frentes permanentes; não existe evidência nesta rodada para abandonar uma delas. Cada app responde pela identidade da conta, uso e assinatura; o CRM responde pelo relacionamento comercial, mensagens e oportunidades; o ledger responde pelo dinheiro confirmado; a Órbita organiza operação interna, evidências e decisão.

A coleta Barberias → CRM → Órbita foi ativada em 25/10, mas não autoriza inferir usuários, assinaturas ou receita para outros produtos. O snapshot anterior de 25 contas e sete ativadas é um sinal para investigar onboarding, não uma contagem de 25 clientes pagantes nem prova da causa do abandono. Acompanhar critérios, janela e atualização da fonte em cada indicador.

Há documentos anteriores ainda descrevendo essa conexão como não configurada; as instruções da central foram corrigidas. Logs, métricas momentâneas e esta fila de trabalho permanecem no repositório/GitHub, conforme o Guia de Contribuição do Vault. Não devem virar fatos canônicos espalhados por notas da empresa.

### Agentes e operação

O registro canônico mantém Tom no OpenClaw/VPS-02, Hermes EasyPanel no VPS-01 e Hermes Oracle no VPS-03. ORBE continua estratégica e conversacional: pode consultar e propor; uma análise não autoriza despacho ou escrita. Não criar outro diretor ou ampliar permissões para acelerar a rodada.

A leitura do n8n encontrou 29 workflows no VPS-01 (16 ativos) e 24 no VPS-03 (17 ativos). Há execuções de erro históricas no VPS-01, a mais recente da amostra em 22/10, e nenhuma de erro na história disponível do VPS-03. A retenção seletiva de execuções impede tratar esses números como SLO ou saúde de todos os agentes. Nenhum workflow foi executado, ativado ou desativado nessa análise.

O maior risco de velocidade é mudar vários fluxos financeiros enquanto o CI não pode iniciar e sem jornada Sandbox observada. O segundo é confundir publicação, saúde técnica e ativação comercial. O terceiro é dar aos agentes capacidade de escrever antes de haver serviço de domínio, escopo, idempotência e auditoria suficientes.

## Fila escolhida para a próxima evolução

| Ordem | Entrega e critério de conclusão | Referência |
|---|---|---|
| 1 | Regularizar a execução do Actions e repetir os gates nos commits integrados. A conta proprietária resolve cobrança/cota; não reduzir os gates nem comprar créditos automaticamente. | Infraestrutura GitHub |
| 2 | Separar reembolso de disputa: aguardar reversão não pode gerar estorno definitivo; confirmação posterior precisa reconciliar ledger e acesso com segurança. Testar ordem invertida e duplicidade em PostgreSQL e Asaas Sandbox. | [Members 21](https://github.com/aglabs-core/members/issues/21) |
| 3 | Estornos externos retiram somente o saldo não usado atribuível à compra, com registro cumulativo e idempotência para parciais; disputa vencida não deve deixar débito indevido. Evitar aplicar a mesma reversão duas vezes pelo fluxo do app e pelo webhook. | [AG LABS 107](https://github.com/aglabs-core/aglabs/issues/107) |
| 4 | Exclusão de conta como processo retomável: reautenticação, bloqueio de novas operações, cancelamento confirmado, retirada pública, limpeza pelo storage, anonimização do cadastro e prova de recadastro. Preservar registro financeiro mínimo separado, com finalidade, prazo e acesso definidos antes da purga. | [AG LABS 103](https://github.com/aglabs-core/aglabs/issues/103), [MeCard 11](https://github.com/aglabs-core/mecard/issues/11) |
| 5 | Medir home e criação em condições mobile repetíveis antes/depois. Separar layout/player e carregamento de autenticação sem alterar retorno do login nem estado do player. Registrar LCP/TBT reais; redução do bundle sozinha não conclui a meta. | [AG LABS 110](https://github.com/aglabs-core/aglabs/issues/110) |
| 6 | Completar a medição de ativação no Barberias: onboarding, primeiro agendamento, tentativa de checkout, pagamento confirmado e primeiro uso pago, com outbox e deduplicação. Medir a etapa que mais perde usuários antes de redesenhar o funil ou aumentar aquisição. | Produto/CRM |
| 7 | Aplicar o contrato de agregados aos demais apps, um por vez, comparando com a origem. Usar `product_id`, `account_id`, `event_id`, versão e horário; nenhuma PII no resumo entregue à ORBE. | Integrações |
| 8 | Piloto supervisionado da ORBE com perguntas reais e fontes datadas: acerto, hipótese explícita, ausência de falsa conclusão e nenhuma escrita sem pedido. Só depois ampliar operações pequenas por app com escopo e auditoria. | [Conexões operacionais](./conexoes-operacionais.md) |
| 9 | Concluir o piloto do cofre de segredos com recuperação testada e permissões mínimas, começando em Preview. A conta e o aceite dos termos pertencem ao proprietário. Não migrar arquivos inteiros nem sobrescrever produção por valores vazios. | [Infisical](./infisical-cloud-implantacao.md) |

As cinco issues funcionais acima permanecem abertas enquanto sua implementação e validação não forem concluídas. Encerrar os antigos índices de revisão significa consolidar a fila e preservar o histórico, não declarar essas funcionalidades prontas. Nenhuma campanha, nova automação ou ampliação de acesso foi ativada pelo plano.

O desenho de exclusão e a distinção dos prazos estão em [retenção e exclusão de contas](./retencao-e-exclusao-contas.md). Não havia prazo empresarial definido; a proposta separa a exclusão operacional da guarda financeira mínima e exige validação contábil antes da purga de comprovantes. O primeiro Lighthouse desta rodada terminou em `NO_FCP`, sem nota ou métricas válidas; não foi usado como evidência de melhora ou regressão nem justificou encerrar a issue de desempenho.

## Continuidade

A execução, as medições e os critérios restantes foram conciliados em [26/10/2026](./evolucao-ecossistema-2026-10-26.md). O registro desta página descreve a rodada de 25/10, não o estado final da fila.
