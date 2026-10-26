# Métricas MeCard e Viajeki — continuação da tarefa existente

Tarefa da Empresa `ac3433d4-217d-47a0-b2b6-c6a68837dcfa`, em andamento e atribuída ao Codex por solicitação de Antonio. As partes pendentes são MeCard (indicadores e ativação) e Viajeki (contrato/endpoint). O diagnóstico técnico foi removido da página Integrações na PR56 e disponibilizado apenas internamente pelo MCP/API; as métricas ficam nas páginas dos negócios.

## Implementação coordenada

- [MeCard PR63](https://github.com/aglabs-core/mecard/pull/63): RPC agregada de leitura restrita a service_role, sem impersonar administrador. Usuários, páginas publicadas/no ar, proprietários que publicaram, acesso por plano e pagantes Pro/Negócios por intervalo. Deduplica pagamentos por usuário; separa trial/admin, reembolso e expiração. Migration nova e teste PostgreSQL com todas as migrations do projeto.
- [Viajeki PR40](https://github.com/aglabs-core/viajeki/pull/40): GET autenticado por token dedicado e um único statement de leitura; usuários/viagens, acesso por assinatura e Pro anual com fatura BRL aprovada no ciclo vigente, além de compras Pix de roteiro aprovadas em 30 dias. Sem alteração de cobrança, acesso ou schema. Usuários/viagens/pagamentos vinculam somente usuários existentes; compras são transações, não viagens ou pessoas únicas.
- [CRM PR57](https://github.com/aglabs-core/crm-dash/pull/57): projeção fechada freemium, origem Viajeki HTTPS fixa e tokens dedicados por produto sem reconstruir as listas Secret existentes. Duplicidade falha antes de consultar a origem. Sem configuração nova, mantém o comportamento anterior.
- Órbita: validação fechada do mesmo bloco, visualização por modelo nas páginas MeCard e Viajeki, contagens datadas e nulos sem inferir zeros. Nenhuma superfície de saúde ou diagnóstico em Integrações.

## Definições

Acesso ao plano não é pagamento. MeCard reutiliza account_plan e publication_online; pagante tem pagamento aprovado, sem reembolso e com paid_until vigente. Viajeki preserva a regra de acesso authorized/cancelled com período vigente, mas pagante exige fatura aprovada para a assinatura anual e dentro do ciclo vigente. Cancelamento não elimina período já pago. Valores Pix são brutos aprovados registrados, sem afirmar liquidação. As contagens são snapshots e transações, não coorte de conversão.

## Validação e bloqueio externo

Órbita: 378 testes/73 arquivos, build e lint aprovados. CRM: 144 testes de lógica e 44 de UI, tipos/lint, build sem variáveis e auditoria zero avisos. Viajeki: 176 testes, lint/tipos, 24 migrations verificadas, build e auditoria zero avisos. MeCard: 562 testes unitários, build, cf:check, todas as suítes SQL (59 migrations no teste completo) e auditoria zero avisos; suites de navegador são registradas no PR conforme concluídas. O auth encontrou uma expectativa antiga de solicitação de exclusão, anterior ao fluxo de fechamento já existente: o teste foi alinhado para exigir confirmação/senha sem acionar exclusão; o cenário corrigido passou. Nenhuma lógica de autenticação ou fechamento foi alterada por isso.

MeCard checkbase/check e Viajeki check não iniciaram por billing/spending limit do GitHub, conforme anotações dos checks dos SHAs 65ccfa7 e 04b1da9. Preview Cloudflare aprovado não substitui o check agregado obrigatório do MeCard. A implementação não equivale à publicação/ativação dos aplicativos.

A tarefa só se encerra após gates exigidos, merges/publicações, aplicação da migration do MeCard, tokens próprios configurados nos apps/CRM, 401 sem token e 200 autenticado/no-store, comparação com os painéis administrativos e recepção válida no CRM/Órbita. Não foram aplicados novos tokens ou migration de produção, nem usados pagamentos, geração paga, contas reais ou mensagens como teste.


## Autorização de merge e compactação da disponibilidade

Antonio confirmou nesta continuação que quer os PRs mesclados agora, sem aguardar renovação da cota. Integração normal após os gates locais, sem alterar workflows, cobrança ou proteções; o CI que não iniciou continua registrado como indisponível. A decisão elimina novas perguntas repetidas sobre a mesma cota nesta rodada.

A lista de disponibilidade passa a usar quatro colunas no desktop amplo, três no desktop menor, duas no tablet e uma no mobile. Cada endereço ocupa uma linha compacta com nome e status; domínio completo, erro e metadados ficam no tooltip acessível. A mudança é de apresentação, sem nova consulta, monitor ou alteração das regras de disponibilidade.
