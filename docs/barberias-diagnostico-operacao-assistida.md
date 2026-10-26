# Barberias: diagnóstico e operação assistida

Desenho técnico de 26/10/2026 para a tarefa `15125c1a-7e45-4df9-912f-ed94b79f31c7`. A entrega desta tarefa é o plano: nenhuma rota, ferramenta MCP, credencial, conta ou concessão de acesso foi criada. Implementação e ativação exigem uma entrega posterior com os critérios abaixo.

## Base conferida

Fonte: `aglabs-core/barberias`, commit `6e7379d50b475fe2ca163a93b3ed93e81297cb6e`, consultado em cópia isolada, sem alterar o checkout do proprietário.

| Regra existente | Fonte no commit conferido | Consequência para o desenho |
| --- | --- | --- |
| Autenticação, vínculo ativo, papel, suspensão e gates de escrita | [backend/auth.cjs](https://github.com/aglabs-core/barberias/blob/6e7379d50b475fe2ca163a93b3ed93e81297cb6e/backend/auth.cjs) | O banco confirma vínculo e papel; e-mail da barbearia ou `barberShopId` fornecido pelo agente não prova autorização. |
| Acesso efetivo por assinatura, trial, cortesia e vitalício | [backend/subscription-access.cjs](https://github.com/aglabs-core/barberias/blob/6e7379d50b475fe2ca163a93b3ed93e81297cb6e/backend/subscription-access.cjs) | Reutilizar `resolveSubscriptionAccess`, sem reconstruir a política no MCP ou na Órbita. |
| Profissional, serviço, horário e primeira reserva | [backend/admin-activation.cjs](https://github.com/aglabs-core/barberias/blob/6e7379d50b475fe2ca163a93b3ed93e81297cb6e/backend/admin-activation.cjs) | Reutilizar `loadAdminActivationStatus` e sua projeção por tenant. |
| Guia revisado no navegador e continuidade do onboarding | [src/lib/setup-review.ts](https://github.com/aglabs-core/barberias/blob/6e7379d50b475fe2ca163a93b3ed93e81297cb6e/src/lib/setup-review.ts), [onboarding-continuity.ts](https://github.com/aglabs-core/barberias/blob/6e7379d50b475fe2ca163a93b3ed93e81297cb6e/src/lib/onboarding-continuity.ts) | Dados existentes não comprovam revisão manual; esse histórico é local ao navegador. |
| Agregado por conta, filiais consolidadas e exclusão de demonstração | [backend/orbita-metrics.cjs](https://github.com/aglabs-core/barberias/blob/6e7379d50b475fe2ca163a93b3ed93e81297cb6e/backend/orbita-metrics.cjs) | Não misturar diagnóstico de uma unidade com funil consolidado da conta. |
| Detalhe superadmin e alteração de assinatura | [server.cjs](https://github.com/aglabs-core/barberias/blob/6e7379d50b475fe2ca163a93b3ed93e81297cb6e/server.cjs) (`/api/super/barbearias/:id`, `/:id/subscription`) | O detalhe atual devolve o objeto amplo. Não encaminhar essa resposta inteira ao agente. |

Há duas assinaturas diferentes: a assinatura SaaS do dono usa Stripe; os clubes/mensalidades dos clientes da barbearia são internos (`backend/subscriptions.cjs`). O diagnóstico inicial trata apenas do acesso SaaS da conta.

## Primeira fatia: somente diagnóstico

Extrair um serviço interno `backend/account-diagnostics.cjs` com autorização já resolvida, relógio injetável e projeção fechada. Ele consulta somente os campos necessários, chama as funções existentes e produz o mesmo DTO para o painel e os adaptadores futuros. Não manter uma segunda regra de cobrança no CRM, na Órbita ou no modelo de linguagem.

Rotas **propostas**, ainda inexistentes:

| Superfície | Autorização e alvo | Resultado |
| --- | --- | --- |
| `GET /api/admin/diagnostico` | Dono autenticado; tenant derivado do vínculo validado no servidor. Não aceitar outro tenant no corpo/query. | Diagnóstico da sua unidade e checklist. |
| `GET /api/super/barbearias/:id/diagnostico` | Superadmin confirmado pelo fluxo atual, com identificador validado e alvo explícito. | Mesmo DTO; pode explicar suspensão sem conceder acesso à unidade. |
| `barberias_diagnosticar_conta` | Adaptador MCP futuro; identidade e escopo próprios confirmados no servidor. | Projeção da rota correspondente, nunca SQL, token ou uma credencial global do app. |

A primeira implementação pode entregar somente o painel interno. Expor o MCP fica condicionado à identidade delegada e escopos; o token agregado `CRM_METRICS_TOKEN` não autoriza diagnóstico de conta nem operações em clientes. Não reutilizar os diagnósticos de infraestrutura `/api/diagnostic/auth` e `/api/diagnostic/database` como ferramentas públicas.

### Cuidado com efeitos indiretos

`requireAuth` pode recuperar metadados ausentes no Clerk e atualizar o tenant/papel durante a autenticação, inclusive em uma requisição GET. Chamar `/api/auth/me` ou envelopar o middleware inteiro não garante leitura sem efeitos.

Separar a resolução/validação de identidade das ações de reparo, compartilhando as mesmas verificações de segurança. O diagnóstico não executa reparo, vínculo por e-mail, troca de unidade, criação de conta ou sincronização. Identidade ambígua ou vínculo revogado produz bloqueio e orientação para o fluxo humano de recuperação existente. Preservar o comportamento dos fluxos atuais; testar a separação antes de usá-la no novo adaptador.

### DTO e definições

| Campo | Conteúdo permitido |
| --- | --- |
| `version`, `status`, `checkedAt`, `sources` | Versão, `ok/partial/unavailable`, instante da consulta e disponibilidade por seção. |
| `account` | Identificador do alvo, estado da conta e vínculo de unidade/cobrança quando conhecido. Sem nome, contato, endereço ou notas livres. |
| `access` | Estado local da assinatura, resultado/origem de `resolveSubscriptionAccess`, expirações necessárias e bloqueio por suspensão. Não afirmar autorização de outro usuário. |
| `activation` | Contagens e flags já calculadas pelo serviço existente; ausência de seção aparece como `null`, nunca zero presumido. |
| `checklist` | Códigos finitos, estado `complete/missing/unknown`, destino interno permitido e explicação determinística. Sem HTML ou URL fornecida pelo agente. |

Regras que o consumidor deve preservar:

- `stripe_active` é o estado local usado pela política de acesso; não comprova pagamento ou liquidação. Trial, cortesia e vitalício também não são pagamento.
- Cortesia expirada pode coexistir com assinatura ativa: seguir a precedência do serviço existente. Data ausente/inválida de trial não abre acesso. Vitalício e concessão sem expiração devem manter suas classificações atuais.
- Conta suspensa e assinatura vigente são informações distintas. Assinatura ativa não remove suspensão nem substitui a autorização por papel/vínculo.
- Pronta para agendar = profissional ativo, serviço e horário utilizável na mesma unidade. Ativação completa do serviço atual inclui primeira reserva. Uma reserva histórica não comprova atendimento concluído, pagamento ou aquisição de cliente.
- Contato e identidade visual são opcionais. Não recolocar uma conta operacional no guia por falta desses campos. A revisão manual do guia permanece `unknown` no servidor, sem ler armazenamento do navegador.
- Mostrar unidade e conta de cobrança separadamente quando houver `subscriptionOwnerId`. Não combinar profissional de uma filial com serviço/horário de outra para declarar prontidão, nem inferir acesso herdado fora da regra vigente.

Autenticar e validar o alvo antes de consultar ou servir cache. Resposta HTTP com `Cache-Control: no-store`; eventual cache interno limitado por alvo e contexto autorizado, com horário real de geração e invalidação após mudanças. Falha de autorização retorna 401/403 sem seções; alvo inexistente, 404. Falha de banco/Clerk não vira conta vazia nem desbloqueio. Seções independentes podem ficar parciais, explicitamente identificadas. Não prometer snapshot transacional consistente sem implementá-lo.

O registro técnico de consulta contém identificador de requisição, ator verificado, alvo, escopo, resultado e horário. Não registrar Bearer, e-mail, telefone, agenda, clientes ou a resposta bruta do provedor. Auditoria operacional é distinta de criar contato/alterar etapa no CRM.

## Fase posterior: operação assistida

Fora da primeira fatia e desta tarefa. Provisionamento, cortesia, alteração de plano e cobrança não serão ferramentas genéricas de escrita.

1. Extrair o comando do painel para um serviço único, preservando autorização, isolamento e regras atuais. A cortesia existente usa `gift_months`, de **1 a 120 meses**; não oferecer dias. O contrato novo deve validar inteiro estrito, sem truncar entradas ambíguas com `parseInt`.
2. Prévia no servidor com ator, tenant, operação, motivo, plano/período, estado anterior, versão e validade. O servidor calcula a data; o agente não escolhe o resultado. Vitalício não pode ser rebaixado silenciosamente para cortesia.
3. Confirmação humana proporcional à ação, vinculada à prévia e ao alvo. A prévia não é execução. Identidade ou estado divergente invalida a confirmação. Cancelamento local não interrompe uma assinatura Stripe; preservar o bloqueio existente e encaminhar ao fluxo de cobrança correto.
4. Chave idempotente persistida, escopada por ator/alvo/operação e hash do payload. Repetição idêntica retorna o resultado anterior; chave com payload diferente retorna conflito. Atualização e recibo/auditoria na mesma transação. Chave ausente ou inválida impede execução.
5. Timeout significa resultado desconhecido até consultar o recibo. Nunca repetir automaticamente `gift_months`: a rota atual acumula meses e uma segunda execução prolongaria acesso. Recuperação deve usar estado persistido, inclusive após reinício.
6. Invalidar cache após commit. Sincronizações externas posteriores exigem outbox/reconciliação; falha no Clerk não dispara uma nova concessão. Efeitos externos não são atomicamente revertidos por uma transação local.

Não incluir exclusão, saque, estorno, cancelamento financeiro, troca de proprietário ou disparo de mensagens nessa primeira expansão. Essas ações precisam de desenho e autorização próprios.

## Critérios para a implementação futura

Esta matriz é especificação, **não evidência de testes executados no adaptador**, que ainda não existe.

| Área | Casos obrigatórios |
| --- | --- |
| Identidade/isolamento | Sem token, token inválido, papel insuficiente, vínculo revogado, tenant diferente, identidade ambígua, superadmin válido e unidade inexistente. Nenhuma leitura antes da autorização. |
| Leitura sem efeitos | Clerk indisponível ou metadados ausentes não executam reparo; espiões de create/update/upsert/delete, mensageria e concessão não recebem chamadas. |
| Acesso | Trial vigente/expirado/sem data, cortesia vigente/expirada/sem expiração, legado vitalício, Stripe ativo com cortesia vencida e conta suspensa. Comparar com a política atual. |
| Checklist | Sem profissional/serviço/horário, configuração pronta sem reserva, reserva histórica, opcionais ausentes e revisão manual desconhecida. |
| Redes/dados | Não combinar filiais; não expor contato/agenda/segredos; falha por seção é parcial/indisponível, sem zeros inventados. |
| Adaptadores | Painel e MCP entregam a mesma projeção; token de métricas não autoriza diagnóstico; `readOnlyHint` sozinho não substitui o gate do servidor. |
| Escrita futura | Meses inválidos, prévia expirada, mudança concorrente, alvo divergente, repetição da chave, conflito de payload, queda após commit e reconciliação de timeout. |

Ordem de entrega: serviço/DTO e projeção → painel interno com gates existentes → testes de isolamento/efeitos e comparação → identidade delegada/escopos → adaptador MCP somente leitura. Prévia e comandos assistidos ficam em PRs posteriores, sem habilitação automática junto ao diagnóstico.

## Verificação desta entrega de planejamento

As rotas, funções e limites acima foram conferidos no código fixado. Os 23 testes existentes de `backend/subscription-access.test.cjs`, `backend/admin-activation.test.cjs` e `backend/orbita-metrics.test.cjs` passaram localmente com `node --test`, sem conexão de produção, Clerk, Stripe ou envio de mensagens. Isso confirma as premissas cobertas pelas suítes, não a existência do serviço proposto nem homologação real.

O desenho fecha a tarefa de planejamento. Criar e ativar as superfícies propostas será trabalho distinto; esta conclusão não libera concessões de acesso ou escrita por agentes.
