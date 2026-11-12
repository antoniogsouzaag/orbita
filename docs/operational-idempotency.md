# Recibos de execução e indicadores comerciais

## Rotinas diárias

Chamadas agendadas reservam atomicamente `cron-claim:<rotina>@<dia UTC>` em
`settings` antes de executar trabalho. A reserva persistente cobre concorrência
e reinícios. Sucesso bloqueia repetição. Falhas explicitamente `retryable`, antes
de efeitos externos, permitem nova tentativa. Resultado incerto fica reservado
para conferência; não há expiração automática que possa repetir um envio.

Falha ao ler ou gravar recibos é explícita. A rota não executa trabalho se não
conseguir reservar. Se o efeito ocorreu e a gravação final falhou, preserva a
reserva e informa resultado para conferência. Isso não promete exatamente uma
entrega externa quando o provedor não oferece idempotência. Uma chamada manual
continua sendo repetição deliberada: verificar o provedor antes de fazê-la.

## Falhas do n8n

Quando há `executionUrl`, a ingestão cria uma chave SHA-256 sobre fonte e
execução e usa índice único em `ops_events.receipt_key`. Entregas concorrentes
produzem uma ocorrência; mudanças de nome do workflow e reenvios após 24 horas
não criam outra. Registros legados são preservados e consultados. Sem identidade
de execução não há deduplicação presumida. A migration é aditiva e roda no start.

## Comercial

Distribuição por etapa representa o estoque atual; não é conversão de uma
coorte. Ausência de alguma etapa impede calcular participações no total.
Recebimentos após estornos são anteriores a taxas/tributos e não comprovam
liquidação bancária. Fonte indisponível continua diferente de zero.

## Publicação

`npm run check` valida o código. Publicar no VPS aplica a migration antes de
abrir a aplicação. Conferir `GET /api/health` e comparar o commit com a versão
aprovada; merge ou CI aprovado não comprovam atualização do servidor.
