# ORBE e coleta operacional do ecossistema

ORBE é a assistente da Órbita. O catálogo existente de ferramentas e os limites Pessoal/Empresa permanecem; o nome não cria privilégios. JEV permanece opcional e sob demanda, sem novos procedimentos automáticos nesta rodada.

## Responsabilidade por dado

- Apps: usuários, estabelecimentos/contas, ativação real, assinatura vigente, cortesia e uso. Cada indicador precisa de critério documentado e período.
- CRM: contatos e estágios, tarefas comerciais, contas espelhadas, mensagens e campanhas. E-mail enviado não muda estágio; abertura não comprova leitura. Resposta depende da captura e correlação do inbound.
- Ledger: pagamentos com produto, valor líquido positivo e data. Pagantes do mês contam contatos distintos identificados; não representam assinatura vigente. Pagamentos sem contato são mostrados separadamente.
- Órbita: operação interna, visão agregada, cobertura, decisões e pedidos manuais aos diretores. Nenhuma lista de usuários ou dados de clientes é importada.

## Integração dos apps

Não é obrigatório criar um MCP em cada aplicação. Começar com endpoint HTTPS de agregados, autenticado com Bearer dedicado somente leitura, é suficiente para a Órbita. MCP pode reutilizar o mesmo serviço quando agentes precisarem descobrir e consultar ferramentas. Não duplicar a definição do indicador entre API e MCP.

Contrato implementado no consumidor: GET /api/integrations/orbita/metrics. Configuração somente no servidor da Órbita: APP_METRICS_SOURCES, JSON com product, url e token dedicado com no mínimo 32 caracteres. A primeira origem permitida é barberias.com.br; outros produtos precisam de inclusão explícita de domínio e validação do contrato. Não encaminhar uma chave de superadmin nem expor dados pessoais.

JSON v1: version=1; product; generatedAt; window={from,to}; metrics={users,accounts,activeAccounts,trialAccounts,payingAccounts,complimentaryAccounts,canceledAccounts,activatedAccounts}. Todas as métricas são contagens >=0 ou null quando não houver critério/coleta disponível. Datas em ISO UTC. Um snapshot com mais de 24h é marcado desatualizado. Resposta de outro produto, janela invertida ou data futura além da tolerância é rejeitada.

A implementação do endpoint e sua credencial no Barberias ainda não estão configuradas nesta rodada. O painel mostra indisponível em vez de inferir usuários e assinantes a partir do CRM. Próxima validação exige confirmação dos critérios no app, endpoint autenticado e comparação com o superadmin.

## E-mails e tarefas

CRM MCP mantém consultas somente leitura por produto e categoria. Acrescentados consultado_em, pagamentos/pagantes do mês e pagamentos sem contato. Funil de e-mail apresenta pendências de entrega, entregues sem resposta registrada, agendamentos dentro da janela e última mensagem observada. Agendamentos futuros não contam como envio.

CRM UI permite filtrar origens com respostas ou falhas/descadastros, mantendo falha distinta de opt-out. A Órbita exibe categorias e origens sem e-mails, nomes ou corpos. Tarefas comerciais de Antonio são lidas na tela Empresa em uma seção própria; edição continua no CRM, sem duplicar tarefas locais.

## Diretores e persistência

Novos pedidos Oracle usam dispatches com target=hermes, mesma assinatura HMAC e consultas manuais. Legados settings permanecem legíveis; consulta migra para o registro comum sem apagar o original. Estados finais não regridem e o callback MCP do OpenClaw não altera pedidos Hermes. Não existe replay ou execução automática.

## Publicação

Validar TypeScript, testes, lint dos arquivos alterados, build e telas autenticadas. Publicação autorizada por Antonio nesta conversa. Registrar os commits, PRs e deployments efetivamente prontos; dados locais não comprovam produção.

## ORBE estratégica e conversacional

Pergunta de prioridade não se limita a urgência. A assistente cruza identidade, portfólio, produtos, jornada comercial, metas e projetos, preservando a continuidade dos últimos três turnos do usuário na recuperação do Vault. Seleção de até 8 notas e até 30 mil caracteres, com diversidade de fontes, SHA, data declarada e caminho para aprofundar. Contexto empresarial exclui a pasta pessoal do Vault e dados pessoais da Órbita.

Metas empresariais e contexto de projetos/tarefas entram no resumo inicial. Dados agregados do CRM ajudam a orientar a investigação, sem confundir disponibilidade técnica com resultado de negócio. Quando necessário, buscar_no_vault, ler_nota_do_vault, crm_resumo e crm_funil_emails permitem aprofundar. Hipóteses e metas sugeridas devem ser apresentadas como propostas; gravar ou despachar continua dependendo do pedido de Antonio.

Novas ferramentas listar_metas e criar_meta respeitam o espaço da conversa. Criação inicia progresso em zero, sem inventar medições. O esforço de raciocínio na conversa Empresa sobe de low para medium no provedor atual; não foi trocado o modelo nem habilitado JEV. Qualidade de resposta real do modelo exige validação conversacional; testes locais verificam contexto, ferramentas e isolamento usando provedor simulado.
