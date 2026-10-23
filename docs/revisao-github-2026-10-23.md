# Revisão GitHub — 23/10/2026

## Resultado e limites

Inventário consultado na organização aglabs-core: oito PRs abertos e 52 propostas com etiqueta proposta. Também foi examinada a issue de segurança Viajeki #32. As propostas abaixo continuam abertas; triagem não equivale a defeito reproduzido ou correção publicada. Nenhum PR foi mesclado, nenhum gate foi removido e nenhuma proposta foi encerrada por inferência.

Os oito heads estão sem conflito de merge, mas todos têm check FAILURE. Em todos os jobs, a anotação oficial informa que o job não iniciou por pagamentos recentes falhos ou limite de gastos do GitHub Actions. Não há logs de compilação para atribuir estas falhas ao código. Antonio confirmou a causa: os minutos gratuitos do Actions se esgotaram. A decisão é aguardar a renovação mensal e então executar os gates no SHA atual. Não há ação de pagamento ou aumento de limite pendente.

## Ordem de revisão

1. Viajeki [#32](https://github.com/aglabs-core/viajeki/issues/32): atualização do Next.js e auditoria de segurança da base. A issue relata advisories novos e gate local reprovado; precisa de checkout, lockfile, check/audit e smoke próprios. Isso é independente do bloqueio financeiro do Actions.
2. Cobrança, acesso e créditos: Members #33/#35/#21, AG LABS #104/#107, Viajeki #26/#19/#13, Barberias #92 e MeCard #32. Reproduzir em sandbox antes de mudar regras. Não são decisões que devem ser delegadas ao Jev.
3. PRs pequenos: AG LABS #112; Members #39/#31; Viajeki #24. Diffs e testes de regressão foram lidos. Não apresentam uma razão observada para contornar o gate. Reexecutar CI após a renovação dos minutos.
4. Lotes maiores: Members #32/#38, AG LABS #113 e Viajeki #25. Revisão dos diffs e da evidência declarada não substitui execução integrada e smoke autenticado. Viajeki #25 também precisa atualizar a base vulnerável antes de publicação.

## PRs e heads consultados

| PR | Head | Resultado observado |
|---|---|---|
| [aglabs #112](https://github.com/aglabs-core/aglabs/pull/112) | `82d17921efcbf860a6b1b268bca262bcc2401d32` | Sem conflito; CI não iniciou por Billing |
| [aglabs #113](https://github.com/aglabs-core/aglabs/pull/113) | `92a65e0df0e2f6dd502fb0b24db5a31cbf45ae58` | Sem conflito; CI não iniciou por Billing |
| [members #31](https://github.com/aglabs-core/members/pull/31) | `8eb4d7b31e0689eb234fd563750439770aa0b203` | Sem conflito; CI não iniciou por Billing |
| [members #32](https://github.com/aglabs-core/members/pull/32) | `488d097b077ec9f4fe29dfcd3401aceddd6736ee` | Sem conflito; CI não iniciou por Billing |
| [members #38](https://github.com/aglabs-core/members/pull/38) | `cecdd83c0696fc4ff95272c8c2901add849888e0` | Sem conflito; CI não iniciou por Billing |
| [members #39](https://github.com/aglabs-core/members/pull/39) | `9daf7dffbd0d15446ff8df4e67c74807502204d5` | Sem conflito; CI não iniciou por Billing |
| [viajeki #24](https://github.com/aglabs-core/viajeki/pull/24) | `9233f8f2d841d312a08b2d2895151ecaf2c62151` | Sem conflito; CI não iniciou por Billing |
| [viajeki #25](https://github.com/aglabs-core/viajeki/pull/25) | `7d07a3d0018d6ac26ee9f85cb9e136fa64604dc1` | Sem conflito; CI não iniciou por Billing |

## Propostas por produto

As ações abaixo continuam no GitHub como fonte operacional. Evitar copiar o backlog para o vault ou criar uma segunda tarefa para cada issue. Uma tarefa na central acompanha o desbloqueio do CI e outra a segurança do Viajeki.

### aglabs-core/aglabs

- [#103 — Proposta: excluir a conta de verdade (assinatura, dados e recadastro com o mesmo e-mail)](https://github.com/aglabs-core/aglabs/issues/103)
- [#104 — Proposta: nenhum crédito debitado sem geração entregue ou estornada](https://github.com/aglabs-core/aglabs/issues/104)
- [#105 — Proposta: gerenciar e cancelar a assinatura pelo app, sem assinatura em duplicidade](https://github.com/aglabs-core/aglabs/issues/105)
- [#106 — Proposta: criar conta com e-mail, não só com Google](https://github.com/aglabs-core/aglabs/issues/106)
- [#107 — Proposta: estorno e chargeback feitos fora do app retiram os créditos](https://github.com/aglabs-core/aglabs/issues/107)
- [#109 — Proposta: extrato de créditos e status do reembolso visíveis no app](https://github.com/aglabs-core/aglabs/issues/109)
- [#110 — Proposta: home abre mais rápido no celular (bundle inicial e Clerk sob demanda)](https://github.com/aglabs-core/aglabs/issues/110)
- [#114 — Proposta: pedido de música ou narração na home não vira imagem cobrada](https://github.com/aglabs-core/aglabs/issues/114)
- [#115 — Proposta: login com Google nunca cai em tela do Clerk em inglês](https://github.com/aglabs-core/aglabs/issues/115)
- [#116 — Proposta: Favoritos mostra todas as criações curtidas, não só as 100 do topo do Inspire](https://github.com/aglabs-core/aglabs/issues/116)

### aglabs-core/barberias

- [#92 — Proposta: falha no registro de fatura paga não pode travar a reativação da assinatura](https://github.com/aglabs-core/barberias/issues/92)
- [#94 — Proposta: imagens de promoção só da mídia da plataforma e removidas do R2 ao trocar](https://github.com/aglabs-core/barberias/issues/94)
- [#107 — Proposta: recuperação de sessão da equipe não pode travar super-admin e barbeiro sem cadastro](https://github.com/aglabs-core/barberias/issues/107)
- [#108 — Proposta: operadores de caixa criados no teste do Básico ficam sem uso depois do teste](https://github.com/aglabs-core/barberias/issues/108)

### aglabs-core/mecard

- [#8 — Proposta: selo "Feito com MeCard" clicável nos cartões publicados](https://github.com/aglabs-core/mecard/issues/8)
- [#9 — Proposta: permitir assinar o Pro durante o teste grátis](https://github.com/aglabs-core/mecard/issues/9)
- [#10 — Proposta: estados de carregamento e erro confiáveis na página de planos](https://github.com/aglabs-core/mecard/issues/10)
- [#11 — Proposta: excluir a conta e definir senha pelo Perfil](https://github.com/aglabs-core/mecard/issues/11)
- [#12 — Proposta: aposentar os resquícios da Vercel (inclui webhook de pagamento duplicado)](https://github.com/aglabs-core/mecard/issues/12)
- [#31 — Proposta: zerar a cota de IA quando o teste vira assinatura paga](https://github.com/aglabs-core/mecard/issues/31)
- [#32 — Proposta: retomar checkout pendente e reativar assinatura cancelada sem cobrança duplicada](https://github.com/aglabs-core/mecard/issues/32)
- [#33 — Proposta: IA não deve travar cartões criados com recurso de plano superior](https://github.com/aglabs-core/mecard/issues/33)
- [#34 — Proposta: fazer www.mecard.com.br redirecionar para mecard.com.br](https://github.com/aglabs-core/mecard/issues/34)
- [#35 — Proposta: aviso de upgrade da IA falar de IA e oferecer Pro e Negócios](https://github.com/aglabs-core/mecard/issues/35)
- [#44 — Proposta: cartão público e Estúdio sem o código da home](https://github.com/aglabs-core/mecard/issues/44)
- [#45 — Proposta: confirmar antes de remover o domínio próprio](https://github.com/aglabs-core/mecard/issues/45)
- [#46 — Proposta: manter o modelo escolhido ao confirmar o cadastro por e-mail](https://github.com/aglabs-core/mecard/issues/46)

### aglabs-core/members

- [#20 — Proposta: contar cartões recusados no limite de tentativas do checkout](https://github.com/aglabs-core/members/issues/20)
- [#21 — Proposta: AWAITING_CHARGEBACK_REVERSAL não deve revogar o acesso](https://github.com/aglabs-core/members/issues/21)
- [#22 — Proposta: Pix pendente recuperável em /compra e ao voltar ao checkout](https://github.com/aglabs-core/members/issues/22)
- [#23 — Proposta: esconder do aluno as aulas marcadas como "Oculto"](https://github.com/aglabs-core/members/issues/23)
- [#24 — Proposta: mensagens de autenticação para link expirado, e-mail não confirmado e senha redefinida](https://github.com/aglabs-core/members/issues/24)
- [#33 — Proposta: preço digitado com ponto decimal grava a oferta 100× mais cara](https://github.com/aglabs-core/members/issues/33)
- [#34 — Proposta: limite de tentativas do checkout não deve ser gasto ao testar cupom ou reabrir Pix](https://github.com/aglabs-core/members/issues/34)
- [#35 — Proposta: saque recusado pelo Asaas com tela, histórico e e-mail coerentes](https://github.com/aglabs-core/members/issues/35)
- [#36 — Proposta: explicar ao comprador quando o upsell de 1 clique é recusado](https://github.com/aglabs-core/members/issues/36)
- [#37 — Proposta: voltar à página pedida depois do login (/produtor, /denunciar e área logada)](https://github.com/aglabs-core/members/issues/37)

### aglabs-core/viajeki

- [#12 — Proposta: não reaproveitar Pix pendente perto de expirar](https://github.com/aglabs-core/viajeki/issues/12)
- [#13 — Proposta: garantir o período pago do Pro mesmo sem o webhook de fatura](https://github.com/aglabs-core/viajeki/issues/13)
- [#14 — Proposta: caminho direto para assinar o Pro a partir da home e do paywall](https://github.com/aglabs-core/viajeki/issues/14)
- [#15 — Proposta: exclusão de conta cancela Pix pendente e avisa perda de passe e período pago](https://github.com/aglabs-core/viajeki/issues/15)
- [#16 — Proposta: tratar sessão expirada e verificação de dispositivo no login](https://github.com/aglabs-core/viajeki/issues/16)
- [#19 — Proposta: tratar status failed e charged_back do Mercado Pago e notificação de order inexistente](https://github.com/aglabs-core/viajeki/issues/19)
- [#20 — Proposta: atualizar maplibre-gl para a 6.x antes do vencimento da exceção (31/10)](https://github.com/aglabs-core/viajeki/issues/20)
- [#21 — Proposta: completar roteiro com IA em blocos para viagens longas](https://github.com/aglabs-core/viajeki/issues/21)
- [#22 — Proposta: remover EXIF/GPS de todas as fotos e alinhar o texto da exclusão de conta](https://github.com/aglabs-core/viajeki/issues/22)
- [#23 — Proposta: assinatura suspensa promete "reativar", mas o botão cria uma assinatura nova](https://github.com/aglabs-core/viajeki/issues/23)
- [#26 — Proposta: assinatura suspensa pode virar "já ativa" sem nova cobrança](https://github.com/aglabs-core/viajeki/issues/26)
- [#27 — Proposta: falha da IA e reabrir o Pix não devem gastar cota nem limite](https://github.com/aglabs-core/viajeki/issues/27)
- [#28 — Proposta: ver e remover todos os participantes (hoje só os 5 primeiros)](https://github.com/aglabs-core/viajeki/issues/28)
- [#29 — Proposta: reenviar convite ou mudar o papel não pode tirar o acesso de quem já participa](https://github.com/aglabs-core/viajeki/issues/29)
- [#30 — Proposta: parada protegida (cadeado) não pode travar adicionar, editar horário e arrastar](https://github.com/aglabs-core/viajeki/issues/30)

## Relações que não são duplicatas

Viajeki #23 trata a promessa/rótulo de reativação; #26 trata possível liberação de período sem cobrança. Estão relacionadas, mas têm critérios de aceite distintos. Não foram encerradas como duplicadas. PR aberto também não comprova que uma proposta já chegou à produção.

## Próximo passo operacional

Depois da renovação dos minutos: executar CI no head, revisar resultados e atualizar a base de cada lote; primeiro integrar correções pequenas independentes, depois os lotes de checkout/onboarding/roteiro. Preservar testes de pagamento em sandbox e validação de publicação como etapas separadas.
