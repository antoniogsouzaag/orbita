# Retenção e exclusão de contas

## Desenho recomendado — prazos sujeitos à validação contábil

Antonio informou em 25/10/2026 que a empresa ainda não possui prazo próprio definido para retenção financeira. A orientação técnica é separar o encerramento da conta da guarda de documentos obrigatórios. Este texto é uma proposta de implementação e revisão; não declara uma política jurídica já aprovada nem habilita uma purga.

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
