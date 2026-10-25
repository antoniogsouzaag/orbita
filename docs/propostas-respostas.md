# Propostas, respostas e continuidade

`/propostas` é uma caixa da Empresa. Reúne issues GitHub classificadas como
decisão e tarefas empresariais abertas por agentes. A sessão do proprietário
é exigida tanto na página quanto na ação de resposta. Tarefas pessoais e sem
agente não podem ser usadas como origem. O GitHub continua sendo a fonte da
issue: o corpo é lido somente para item encontrado na busca autorizada, por
host/caminho fixos. Markdown não executa HTML nem carrega imagens remotas.

Ao responder, o proprietário escolhe um agente com token ativo e escopo
tarefas/admin. A resposta fica nas notas de uma tarefa empresarial, com data,
origem e chave do envio. Pedido local reutiliza a tarefa; issue usa UUID estável
por origem, com upsert atômico. Reenvio da mesma chave não duplica texto nem
reabre trabalho concluído. Nova mensagem reabre a continuidade como `todo`.
Histórico existente, prioridade e vínculos do pedido local são preservados.
Histórico é limitado a 64 mil caracteres; mensagens a 4 mil.

`resposta:antonio` separa trabalho devolvido ao agente de pedido esperando o
proprietário. Uma atualização posterior na issue volta a destacá-la para nova
leitura. A UI mostra Aguardando você, Com os agentes e Concluídas, com limite
explícito de consulta (200 tarefas e cobertura informada pelo GitHub).
Responder não fecha a issue e não publica comentário no GitHub. O agente
deve reconciliar a origem ao executar e registrar a evidência na tarefa.

Pelo MCP, `minhas_tarefas` entrega estado e notas (últimos 6 mil caracteres) das
tarefas empresariais marcadas para o nome autenticado do agente. Para iniciar
ou concluir, `atualizar_minha_tarefa` recebe `id`, `registro_id` UUID, `estado`
doing/done e `resumo` com evidência. Reutilizar registro_id em retries. A escrita
filtra simultaneamente tarefa, espaço Empresa e agente. Não há webhook,
disparo automático ou permissão para escrever em outra identidade.

Uma tarefa concluída significa que o agente registrou conclusão, não validação
independente de deploy, pagamento ou entrega externa. O resumo diário e o
Aguardando você deixam de repetir os retornos que já estão com os agentes.
