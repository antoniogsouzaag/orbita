# Academia, negócios e redes sociais — 23/10/2026

## Implementação

- Hábitos: modelos continuam disponíveis depois do primeiro cadastro; base de musculação com meta editável de três dias por semana. Cadastro de modelo não inventa presença. O calendário existente continua permitindo marcar dias anteriores.
- Academia: três fichas educativas, criação/edição/exclusão de fichas persistentes, séries, repetições, carga, pausa, execução e demonstração opcional por vídeo do YouTube. A URL é validada no servidor e incorporada no domínio youtube-nocookie. Os modelos não contêm vídeos inventados nem cargas personalizadas. A seleção de vídeos e a adaptação da rotina continuam manuais.
- Salvar uma ficha não grava treino, nem altera o hábito. A conclusão explícita cria o registro realizado. Datas futuras e impossíveis são recusadas. Os totais consultam todos os registros válidos, independentemente dos 120 itens exibidos no histórico.
- Negócios: primeira visão dedicada ao Barberias, com páginas de entrada, aquisição, canais do grupo explícito no Postiz, monitoramento por domínio, PRs/propostas do repositório e tarefas internas com tag barberias. A própria página permite criar uma próxima ação e abrir o detalhe da tarefa.
- Redes sociais: seleção por grupo/canal, janelas de 7 e 30 dias, cartões com último ponto e data, pequenos gráficos, série original recolhida, erros específicos e atualização manual. Não soma seguidores, alcance ou visualizações de canais diferentes. A variação é identificada como informada pelo Postiz.
- GitHub: calendário e pendências carregam de forma independente, calendário com atualização manual, credencial vazia não impede fallback, erros do calendário não entram no cache longo. Uma falha ao atualizar a lista conserva a última resposta válida com aviso explícito.
- Início: mensagem do treino orienta para fichas e frequência; Personalizar descarta mudanças não salvas ao reabrir. Conclusão de hábito não considera dias anteriores à criação; registros futuros não completam metas semanais.

As fichas usam registros individuais na tabela settings existente, com prefixo training-plan:. Não há migration, alteração de permissões, credencial criada ou modificação de política de acesso. As ações exigem autenticação e validam o conteúdo com Zod.

## Defeito real do Postiz

Na produção, a lista de 14 canais respondia e o canal Instagram do Barberias mostrava erro de métricas. A API pública respondeu HTTP 200 com oito séries e pontos total numéricos. O schema anterior exigia string e rejeitava a resposta inteira. A correção aceita número finito ou texto, preservando o valor normalizado. A sondagem também demonstrou recusa HTTP 403 com o user-agent padrão do Python e sucesso com orbita; a leitura da aplicação agora declara user-agent e Accept.

Fonte do contrato: https://docs.postiz.com/public-api/analytics/platform . Não houve publicação, agendamento, rotação de chave ou reconexão de canal.

## Limite comercial confirmado

O contrato atual em aglabs-core/crm-dash/lib/mcp-server.ts expõe crm_resumo sem parâmetros e crm_tarefas sem filtro por produto. A página não usa totais gerais da empresa como se fossem do Barberias. Leads, ativação e receita por produto ficam identificados como indisponíveis, com acesso à origem. Falta uma evolução do contrato comercial por produto e uma fonte de eventos de ativação do Barberias; não foi implementada em outro repositório nesta etapa.

## Verificações e limites

- GitHub em produção respondeu com calendário e 59 pendências visíveis durante a reprodução. A indisponibilidade relatada não foi reproduzida nessa consulta. O bloqueio financeiro de Actions documentado anteriormente não é o mesmo que a integração de leitura da Órbita, e não foi alterado.
- As seis páginas públicas usadas pelo painel do Barberias responderam HTTP 200 sem redirecionamento: /sobre, /planos, /signup, /b/barber-ag, /ajuda e /barbearias. Nenhum cadastro, agendamento ou pagamento foi efetuado.
- O banco de QA é separado do banco do usuário. Dados de demonstração e registros de verificação permanecem nesse banco local.
- A revisão automática recusou carregar a chave real do Postiz em um servidor de desenvolvimento acessível pela rede. A alternativa usada na verificação visual não contém credenciais externas. A sondagem direta autenticada da API foi concluída separadamente, sem mostrar ou persistir a chave.
- O lint global tem passivo preexistente em outras telas (efeitos, refs, pureza e componentes dinâmicos). Não se declara todo o ecossistema livre de falhas, nem validação de clientes, pagamentos ou entrega de mensagens.
- A validação inicial foi local. A publicação foi autorizada posteriormente pelo usuário e é acompanhada no PR desta revisão.

### Diagnóstico de produção — 15h34 (São Paulo)

Onze sondagens verificadas: Postgres, 87 notas do vault, GitHub com 59/59 pendências visíveis, CRM (resumo/tarefas), duas instâncias n8n com 33/105 workflows ativos, três monitores recentes, Telegram (bot/destino, sem envio), duas fontes de agenda sem erro ou sincronização pendente, OpenRouter (credencial, sem inferência), 14 canais Postiz e Unsplash. As outras três integrações continuam apenas configuradas: agendador diário, contexto/MCP dos agentes e IA. Esse diagnóstico não comprova execução de cron, conexão ativa de agente, resposta de modelo ou entrega de mensagem.

Na verificação de navegador em QA: ficha salva manteve zero treinos; conclusão explícita criou um registro; criação de próxima ação do Barberias apareceu vinculada na página e no detalhe de Tarefas. O primeiro build Webpack foi descartado da validação visual porque a configuração atual de Tailwind é específica do Turbopack; o build canônico foi usado em seguida.

### Resultado final de código

Suíte final: 28 arquivos e 113 testes aprovados. Lint dos módulos alterados, TypeScript e build canônico Next/Turbopack aprovados. As requisições diretas do Node deste ambiente tiveram timeout de transporte; a consulta autenticada por Python respondeu e seu payload foi validado pelo schema atual, sem carregar a chave real no servidor de QA. Essa separação não equivale a validar a nova página de métricas em produção após publicação.

Última regressão: registros de hábitos lançados para antes do cadastro também iniciam o período acompanhado para o cálculo de adesão. Os oito testes de hábitos passaram após esse ajuste, e o build canônico final também passou. A suíte completa anterior havia passado com 113 testes.

### GitHub Actions: bloqueio externo ainda presente

Consulta atual do PR aglabs-core/aglabs #112: aberto, head 82d17921efcbf860a6b1b268bca262bcc2401d32. Check 116879574491 (check) com failure. A anotação oficial informa que o job nem começou por pagamentos recentes falhos ou necessidade de aumentar o limite de gastos, e pede revisão de Billing & plans. Essa mensagem não distingue sozinha as duas causas. Isso é diferente da integração de leitura da Órbita, que respondeu normalmente. Não foi alterado faturamento, limite ou proteção de merge; o bloqueio do Actions continua pendente da conta GitHub.
