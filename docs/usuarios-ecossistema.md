# Usuários do ecossistema

A visão de negócios soma cadastros dos aplicativos com coleta administrativa válida. A mesma pessoa pode ter contas em vários apps: o resultado não é uma contagem de pessoas únicas na empresa. Contatos do CRM, compradores, produtores aprovados, assinaturas e estabelecimentos são medidas diferentes.

- Usuários totais: metrics.users da origem.
- Ativos: usuários com atividade autenticada no produto nos últimos 30 dias. Nunca derivar de assinatura ou estado de conta. O AG LABS App usa a união de gerações e eventos autenticados do painel administrativo.
- Novos no mês: cadastros entre o primeiro dia do mês em America/Sao_Paulo e a consulta. Nunca substituir por novos em uma janela móvel de 30 dias.

O bloco opcional audience v1 contém active30d e newMonth (inteiros não negativos ou null), monthFrom, activityFrom, to, timeZone e activityBasis. A janela ativa tem 30 dias; monthFrom é o início do mês de São Paulo; to coincide com generatedAt. As contagens não podem exceder metrics.users. activityBasis é authenticated_product_events quando há medida de atividade e null quando ela não é medida. CRM e Órbita fazem projeções fechadas, sem identidade, e validam o contrato. Snapshots legados continuam válidos; o ativo do bloco credits continua disponível.

Cada indicador exibe sua própria cobertura. Ausência, falha, snapshot acima de 24 horas ou mês anterior não viram zero nem entram como cobertura atual. Uma contagem confirmada de zero entra na soma. Produtos não são contados duas vezes. VibeKit vende acesso por compra única e não entra no denominador dos aplicativos com cadastro; seu card mostra compras, acessos provisionados e cliques, sem equiparar eventos a pessoas.

Produtos em acompanhamento lista todos os seis negócios do catálogo, com marca oficial, link para a página do negócio, status e horário do snapshot e métricas por produto. As oportunidades e clientes do CRM continuam identificados como comerciais, e AG LABS institucional não é associado ao AG LABS App.

Ampliação inicial: Members acrescenta novos no mês com HEAD/count=exact em profiles.created_at, sem ler perfis. Falha dessa medida opcional mantém newMonth=null e preserva o financeiro. Engajamento Members usa a união de criadores de produto, produtores com venda e alunos com reprodução qualificada, em 30 dias e no mês. A observação é independente da conclusão manual e informa playbackObservedFrom; a cobertura de aulas não é retroativa. O total não duplica pessoas em papéis diferentes. AG LABS App acrescenta novos no mês à consulta agregada de users e usa a atividade já existente. MeCard, Viajeki e os demais campos ausentes dependem de coleta na origem; não inferir a partir do CRM.

A apresentação e o transporte não exigem novos tokens, delegação ou mudança de cobrança. A observação de aulas requer a migração própria do Members, validada em PostgreSQL isolado, e a publicação do player. Até essa ativação, atividade Members permanece desconhecida; não declarar coleta ativa apenas pelo merge.
