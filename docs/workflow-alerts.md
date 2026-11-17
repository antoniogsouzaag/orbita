# Falhas de automação e lembretes WhatsApp

## Pendência e histórico

Automações une falhas recebidas pelo monitor e consultadas no n8n pela URL exata da execução. A lista principal e o total de pendências incluem somente ocorrências sem resolução registrada. Resolvidas ficam recolhidas em histórico; o gráfico de 14 dias distingue os dois estados. Idades antigas não comprovam correção, e um workflow pausado não equivale a execução bem-sucedida.

O proprietário registra a resolução com evidência na mesma tela. Para falhas vistas apenas na API, a ação confere a execução nas instâncias n8n configuradas antes de persistir o recibo. Não busca URLs recebidas do navegador. Resoluções já registradas são consultadas pelas URLs carregadas, mesmo fora da janela recente, e não reaparecem pela outra fonte. A indisponibilidade de uma API continua explícita. Nenhum sucesso posterior encerra automaticamente uma falha de outro destinatário.

## Resultado de um lembrete

O classificador em `src/lib/reminder-outcome.ts` é compilado por `node scripts/n8n/reminder-classifier.mjs` para o Code node **Classificar resultado do envio** no workflow `QqfYPGW20aghaUDJ` da VPS-01. Ambas as saídas de **Enviar texto** passam por esse classificador e pelo SQL versionado em `scripts/n8n/reminder-result.sql`.

- `accepted`: exige `success=true` e ID não vazio do provedor. Não comprova entrega.
- `canceled`: HTTP 400/422 com evidência estruturada `exists=false`. Destinatário indisponível não é pane da operação; encerra apenas aquele lembrete, sem alerta e sem supressão global do número.
- `unknown`: timeout, resposta sem recibo, autenticação, instância ausente, limite ou erro técnico. Mantém alerta operacional e proíbe retry automático.

O classificador só devolve estado, motivo fixo, ID de aceite e necessidade de alerta. Corpos de erro e telefones não seguem para o alerta. Uma resposta genérica de erro não é prova de número inválido.

Respostas com identificador `@lid` mantêm alerta técnico: a Evolution documenta incompatibilidades de mapeamento que também retornam `exists=false` ([releases oficiais](https://github.com/evolution-foundation/evolution-api/releases)). Esse caso não comprova telefone inexistente.

O SQL exige a reserva em `processing` do mesmo executor, grava o resultado e libera somente a trava daquele executor. Divergência interrompe a rodada; resultados já gravados não são sobrescritos. Alertas técnicos passam por um gate executado apenas para falhas técnicas: no máximo um por lote, correlacionado à URL da execução de envio. SAIR, revalidação de agendamento/loja/telefone, limite do lote, horário e pausa entre envios permanecem no workflow de origem.

Atualizar um workflow pausado não autoriza reativação ou reenvio histórico. Publicar o handler de erro já ativo mantém seus canais existentes. Testes locais usam respostas sintéticas e SQL PGlite, sem mensagens nem banco de clientes; não comprovam entrega WhatsApp ou conectividade da preparação com seu PostgreSQL.
