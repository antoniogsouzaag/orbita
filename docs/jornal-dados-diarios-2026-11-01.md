# Dados diários do Jornal — 01/11/2026

O Jornal usa fatos do dia civil de São Paulo, desde 00h até o horário de coleta. O app é a origem; o CRM valida e transporta os agregados; a Órbita seleciona notícias positivas para a edição de hoje. Não há comparação de snapshots mensais nem exportação de cadastros.

| Origem | Cadastros de hoje | Movimento comercial de hoje | Limite |
| --- | --- | --- | --- |
| AG LABS App | `users.created_at`, interpretado em UTC | Créditos pagos no ledger, sem bônus, estornos, disputas abertas/perdidas ou revisão pendente | Falha em consulta opcional retorna null; compras são registros pagos, não liquidação |
| Members | Perfis criados hoje, por contagem exata | Transações confirmed/received, positivas, por paid_at | Legados sem data de aprovação não são atribuídos ao dia |
| MeCard | Contas auth criadas hoje | Pagamentos approved por approved_at, sem valor reembolsado | Nova migration da RPC administrativa; service_role continua obrigatório |
| Viajeki | Usuários criados hoje | Pix trip_ai e faturas de assinatura aprovadas no dia | Inclui renovações pagas; exclui tentativas e estornos |
| Barberias | Equipe com login, vínculo vigente e exclusões atuais | Não informado | Não chamar clientes finais de usuários da equipe; ledger de faturas não concilia estornos |
| VibeKit | Não aplicável | Compras live registradas no dia | Rótulo próprio, sem afirmar vendas líquidas nem receita liquidada |

## Contrato e compatibilidade

`daily`: `{ date, timeZone: "America/Sao_Paulo", from, to, newUsers, sales, registeredPurchases? }`. `to` corresponde a `generatedAt`; `from` é meia-noite de São Paulo. Contagens são inteiros não negativos ou null. O CRM e a Órbita validam janela, fuso e coerência dos cadastros com o total. Só campos explícitos atravessam a integração. Ausência de `daily` mantém compatibilidade com a origem anterior.

A página esconde zeros, ausências, dados desatualizados e de outra edição. Barberias recebe a expressão “usuários de equipe”; VibeKit, “compras registradas”. A consulta de métricas do AG LABS App usa `aglabs-app`, separada da chave comercial `aglabs`.

## Implementação local

Os aplicativos foram preparados em worktrees isoladas em `D:/projetos github/orbita/.data/jornal-daily/`: `aglabs`, `members`, `viajeki`, `barberias`, `vibekit`, `crm` e `mecard-ready`. As alterações anteriores do Jornal permanecem no checkout principal da Órbita. `mecard` é a preparação inicial; `mecard-ready` contém a versão para validação/publicação com instalação independente de dependências.

## Publicação e conferência

1. Publicar CRM e Órbita com o contrato opcional, preservando compatibilidade com as origens antigas.
2. MeCard: aplicar `20261101193853_journal_daily_metrics.sql`, que apenas estende a RPC existente, com search_path vazio e grants exclusivos de service_role. Publicar o Worker que projeta o novo bloco.
3. Publicar os demais produtores. Reutilizar os coletores autenticados e segredos existentes; não expor nem substituir credenciais por suposição.
4. Conferir uma coleta autenticada de cada produto: data local, início do dia, horário, valores e comparação com a fonte. Nenhum zero supre falha de acesso.
5. Conferir o Jornal autenticado: somente fatos positivos, rótulos corretos, sem totais mensais, cartões vazios ou dados de outra edição.

Não houve envio de e-mail, WhatsApp/Telegram, cobrança, geração paga, mudança de autenticação ou operação financeira como teste. Validação local de SQL/HTTP não comprova deploy, aplicação remota da migration nem jornada real em produção.

## Validação

Testes específicos cobrem limites do dia, exclusão de registros futuros e de teste, estornos/disputas, null versus zero, projeção sem identidades, transporte pelo CRM e seleção editorial na Órbita.

- Órbita: tipos, lint dos arquivos alterados e testes do Jornal/contrato passaram; build final e CI serão conferidos na publicação da revisão.
- MeCard: check com 584 testes/build, cf:check, test:sql e audit:gate passaram. O checkbase remoto também passou; E2E/auth do PR têm resultado próprio.
- Barberias: verify completo e audit:gate passaram; há um aviso preexistente de Fast Refresh.
- AG LABS App: 8 testes locais do coletor passaram; check remoto passou com instalação limpa. A instalação local reutilizada tinha dependências incompatíveis e não validou o verify completo.
- Viajeki: 181 testes, lint, tipos e verificação de 26 migrações passaram. O build local ficou impedido pelo node_modules externo à raiz hermética do Turbopack. Lockfile Linux corrigido e validado por instalação dry-run; conferir CI do novo SHA.
- CRM: lint, tipos e 153 testes de biblioteca passaram. A fixture mensal foi fixada para continuar válida após a virada do mês. Suíte de UI local teve timeout de inicialização de workers; resultado remoto necessário.
- VibeKit: 11 testes da API, tipos e build passaram. Patch de qs atualizado para 6.16.1 após o gate de auditoria identificar GHSA-6pq8-jhm2-2vcw; auditoria passou sem avisos. Conferir CI no SHA atualizado.


## Revisões preparadas

- MeCard: https://github.com/aglabs-core/mecard/pull/69 — migration, projeção do Worker e testes.
- VibeKit: https://github.com/aglabs-core/LP-VibeKit-Templates/pull/10 — compras registradas por dia.
- AG LABS App: https://github.com/aglabs-core/aglabs/pull/156 — cadastros e pagamentos no dia.
- Members: https://github.com/aglabs-core/members/pull/62 — contagem exata de cadastros e vendas por data de pagamento.
- Viajeki: https://github.com/aglabs-core/viajeki/pull/42 — cadastros, Pix e faturas aprovadas no dia.
- Barberias: https://github.com/aglabs-core/barberias/pull/149 — novos usuários de equipe no dia.
- CRM: https://github.com/aglabs-core/crm-dash/pull/62 — validação e transporte do bloco diário.

Os PRs são rascunhos; merge e publicação não foram executados.
