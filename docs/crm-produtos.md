# Comercial por produto (CRM MCP #41)

Extensão de ativação (25/10/2026): `metricasProduto` e o painel de negócio aceitam
`activationFunnel` opcional do Barberias via CRM. Campos cumulativos: profissional,
catálogo, pronta para agendar e agenda iniciada. Validação exige contagens
inteiras não negativas, limitadas pelas contas, última etapa igual a ativadas.
Projeção remove campos extras. Snapshot antigo continua válido; não se presume
etapa ausente. O detalhe fica recolhido, com resumo de prontas sem reserva.
ORBE recebe as mesmas definições: estoque atual com filiais consolidadas,
sem inferir conversão de campanha ou atribuir causa ao abandono. Requer publicação
da origem e do CRM; publicação só da Órbita não comprova coleta dessa extensão.

- A tela existente Empresa → Negócios → Barberias consulta somente `barberias`, em Server Components/Suspense; o CRM geral da Empresa continua intacto.
- Consultas independentes: `crm_resumo({ produto? })` e `crm_funil_emails({ produto?, dias?, categoria? })`. A tela usa 30 dias/todas as categorias. A IA aceita 1–365 dias e as cinco categorias do CRM.
- IA da Empresa; MCP admin: `orbita_crm_resumo` e `orbita_crm_funil_emails`. Não amplia permissões de outros agentes. Sem produto, o resumo global continua compatível com CRM antigo.
- Campos novos são opcionais. Resposta filtrada precisa confirmar o produto; CRM antigo que ignore o filtro, ferramenta ausente, erro ou resposta vazia mostram indisponibilidade, nunca zero/global como substituto. As duas fontes podem falhar separadamente.
- Contas trial/trial_encerrado/ativo/cancelado são independentes da etapa Cliente (classificação comercial, não prova de pagamento ou cobrança atual). Receita é líquida registrada, não MRR.
- Fonte e horário da consulta são exibidos. O contrato não informa atualização da origem; `updatedAt: null` não é substituído pelo horário da consulta. `hoje` é data de referência, não atualização.
- E-mails contam mensagens registradas, não pessoas únicas. Entrega/enviados; demais taxas/entregues; sem denominador: null/—. Abertura por pixel pode ser automática e não comprova leitura humana. Agendados e datas futuras ficam fora de enviados, campanhas e taxas (CRM #42).
- Somente agregados validados/permitidos saem para UI/IA/MCP. Rótulos legados sem slug válido não derrubam o resumo global: ficam fora da divisão, com quantidade em agrupamentos_sem_slug; não são renomeados automaticamente. Campos desconhecidos, textos livres, contatos e origens livres são descartados. Sem envios, automações, credenciais novas ou SQL direto no CRM.

Validação local: Vitest com 1 worker, tsc e ESLint. Build e smoke autenticado de produção ficam para o pipeline/operador (build local omitido por RAM).
