# Retenção e exclusão de contas

## Política adotada — 26/10/2026

Antonio confirmou em 26/10/2026 que o prazo já estava definido e pediu a implementação. Regra aplicada nos dois produtos:

- **Comprovantes financeiros** (pagamentos, reembolsos, ledger): guardados sem nome nem e-mail até **1º de janeiro do 6º ano após o último fato**, ou seja, 5 exercícios completos (CTN arts. 173, I e 174; CC art. 206, §5º, I; LGPD art. 16, I). Ex.: compra em 2026 → apagar em 2032-01-01. Depois disso, uma rotina apaga automaticamente.
- **Disputa ou mediação aberta**: `legal_hold` suspende só esses registros até a resolução.
- **Perfil, conteúdo, arquivos e publicações**: apagados no encerramento.
- **Hash do e-mail**: 12 meses, só para negar um segundo bônus ou teste grátis (LGPD art. 7º, IX).

Implementação: AG LABS em [aglabs-core/aglabs#128](https://github.com/aglabs-core/aglabs/pull/128) (`docs/exclusao-de-conta.md`) e MeCard em [aglabs-core/mecard#62](https://github.com/aglabs-core/mecard/pull/62) (`docs/conta-senha-exclusao.md`). A matriz abaixo continua valendo como fundamento.

## Desenho de referência

| Categoria | Tratamento no encerramento | Regra de retenção |
|---|---|---|
| Perfil, avatar, cartões, rascunhos e mídia do usuário | Retirar conteúdo público e bloquear novas operações; apagar por fila retomável, com confirmação de cada storage | Eliminar quando encerrada a finalidade. Prazo operacional e cópias de segurança precisam ser explicitados ao titular |
| Assinatura e cobranças pendentes | Cancelar a renovação ou cobrança conforme o contrato e confirmar no provedor antes de concluir o processo | Guardar somente a prova necessária do cancelamento e eventuais direitos remanescentes |
| Transações e documentos fiscais | Isolar do cadastro ativo; remover dados não necessários e restringir acesso à função financeira | Prazo aplicável ao documento e à obrigação. Cinco anos é uma referência tributária, não uma regra universal contada da exclusão da conta |
| Registros de acesso à aplicação | Preservar sob sigilo e acesso controlado, separados das métricas de marketing | Seis meses nas condições do art. 15 do Marco Civil, ressalvadas hipóteses de extensão previstas na lei |
| Disputa, ordem judicial ou fiscalização específica | Suspender a purga somente dos registros relevantes, com motivo, responsável e revisão | Até cessar a necessidade/fundamento; não manter toda a conta por existir um único registro sujeito a guarda |
| Marketing e segmentação | Remover das ativações e segmentações dependentes da finalidade encerrada; preservar somente o mínimo necessário para respeitar descadastro | Retenção específica, sem reusar o arquivo financeiro para campanha ou treinamento |

## Contrato técnico dos registros retidos

O registro financeiro mínimo deve conter identificador da transação/provedor, produto, valores/moeda, datas, situação, documento fiscal ou sua referência e prova necessária de cancelamento/reembolso. Dados pessoais entram somente quando necessários ao documento ou fundamento aplicável. CPF, nome e e-mail não devem ser copiados automaticamente para todos os eventos.

Cada categoria precisa de `retention_basis`, `retention_until`, responsável e eventual `legal_hold` com motivo e data de revisão. O job de purga só remove o que tem prazo validado e vencido, sem bloqueio de guarda. Ausência de prazo vira uma pendência de revisão com responsável; não pode ser traduzida silenciosamente como retenção perpétua ou exclusão imediata.

A exclusão operacional é uma máquina de estados: solicitado → identidade confirmada → operações bloqueadas → cobrança conciliada → conteúdo retirado → storage limpo → cadastro anonimizado/encerrado. Cada passo possui chave idempotente e resultado persistido. Falha de rede não leva o cliente a repetir uma cobrança ou a declarar limpeza inexistente.

O histórico mínimo fica separado do perfil/cartões e não pode depender de uma chave estrangeira que o apague em cascata ao remover o usuário de autenticação. O e-mail deixa de bloquear recadastro; histórico e créditos antigos não são transferidos ao novo identificador. A regra de bônus de boas-vindas precisa de controle antifraude proporcional e revisão própria, sem reter o perfil inteiro indefinidamente.

No MeCard, a FK atual de pagamentos para `auth.users` impede excluir o usuário com segurança antes dessa separação. No AG LABS, apagar somente o usuário Clerk não cancela contratos nem retira mídias. As issues permanecem abertas até existir implementação completa e prova de isolamento/repetição, inclusive no ambiente de teste dos provedores.

## Fundamentos consultados

- [LGPD, arts. 6, 15, 16 e 18](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm): necessidade, término, conservação autorizada e direitos do titular.
- [CTN, arts. 150, 173, 174 e 195](https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm): regras de decadência/prescrição e conservação de comprovantes até a prescrição aplicável. A contagem depende da obrigação e de eventos que alterem seu curso.
- [Marco Civil da Internet, art. 15](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm): guarda de registros de acesso à aplicação nas condições legais.

A contabilidade/jurídico deve confirmar a matriz aplicável à AG LABS antes de automatizar a destruição de comprovantes. Isso não exige manter publicações, arquivos ou perfil ativos durante a guarda financeira.
