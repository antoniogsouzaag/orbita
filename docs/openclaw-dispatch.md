# Saída Órbita → OpenClaw (Tom, VPS-02)

Pedidos escolhidos pelo proprietário em **Integrações** chegam ao Tom, diretor do VPS-02, que executa com os agentes do OpenClaw e devolve o resultado à central pelo MCP. Nada é despachado automaticamente.

## Por que webhook, e não WebSocket

- A Órbita roda na Vercel: funções curtas, sem conexão persistente. Manter um WebSocket exigiria um processo próprio sempre ligado.
- O WebSocket do gateway OpenClaw é o protocolo de operador (controle total do gateway). Entregar essa credencial à central daria poder muito acima do necessário.
- O gateway já publica uma rota de webhooks autenticada (`/hooks`). Uma rota mapeada com lista fechada de ações limita o que a central consegue pedir.

## Contrato

`POST https://tom.aglabs.ia.br/hooks/orbita`

Headers: `Content-Type: application/json`, `Authorization: Bearer <OPENCLAW_HOOK_TOKEN>`, `Idempotency-Key: <id>`, `X-Request-Id: <id>`.

Corpo exato: `{ version: 1, source: "orbita", request_id: <uuid v4>, action, params }`.

| Ação | Parâmetros | O que o Tom faz |
| --- | --- | --- |
| `diagnostics.read` | `{}` | Diagnóstico somente leitura do VPS-02 (gateway, memória, disco, containers, rotinas com falha). |
| `incident.diagnose` | `{ assunto ≤200, detalhe? ≤2000, evento_id? uuid }` | Diagnóstico somente leitura de um incidente escolhido; aponta o gestor responsável se for de outro VPS. |
| `request.tom` | `{ texto 3–2000 }` | Pedido livre de Antonio, executado dentro da autoridade normal do Tom. Envio externo, ação financeira, destrutiva ou em outro VPS continuam exigindo confirmação. |

No gateway, o mapping `orbita` só aceita `source: "orbita"`, roda um transform (`~/.openclaw/hooks/transforms/orbita.mjs`) que valida versão, UUID, ação e parâmetros exatos, e abre um turno **isolado** do agente `main` com `deliver: false`. Contrato inválido retorna **204** sem execução. `hooks.allowedAgentIds = ["main"]`; o token da rota é dedicado (`OPENCLAW_HOOKS_TOKEN` no ambiente do gateway).

## Estados

A central grava o pedido (`dispatches`) **antes** do envio e nunca repete sozinha.

| Estado | Origem | Significado |
| --- | --- | --- |
| `sending` | Órbita | Gravado, envio em curso. |
| `accepted` | Gateway | HTTP 200 com `ok` e `runId`: turno admitido. Não comprova execução. |
| `rejected` | Gateway | HTTP 204: contrato recusado pelo transform. Nada executou. |
| `unknown` | Órbita | Sem ativação, timeout, rede ou resposta inesperada. Conferir antes de reenviar. |
| `running` | Tom | `registrar_resultado` com `em_execucao`. |
| `completed` / `failed` | Tom | `registrar_resultado` com resumo e evidência. Estado final. |

Pedido `accepted` ou `running` sem atualização por mais de 2 horas aparece como **sem retorno** (cálculo na leitura; o registro não muda).

## Consistência do retorno

O callback do agente pode chegar antes da resposta HTTP de admissão. A atualização do transporte só muda pedidos ainda em `sending`; preserva resultado, evidência e horário já registrados pelo agente, mesmo diante de timeout posterior. Resultados concorrentes usam comparação do estado anterior e não sobrescrevem um estado final vencedor. Retry idêntico exige resumo **e evidência** iguais.

## Retorno pelo MCP

- `registrar_resultado` (escopo `eventos`): `pedido_id`, `estado` (`em_execucao` · `concluido` · `falhou`), `resumo` e `evidencia`. Repetição idêntica é aceita; pedido encerrado não reabre.
- `pedidos_recebidos` (escopo `eventos`): pedidos ainda abertos, para retomar se o webhook falhar.
- `eventos_recentes` (escopo `status`): conferir eventos e relatos registrados.

## Ativação

1. Gateway (feito pelo Tom no VPS-02): `hooks.token = "${OPENCLAW_HOOKS_TOKEN}"`, `allowedAgentIds: ["main"]`, mapping `orbita` com o transform, restart do gateway para carregar a variável.
2. Vercel, somente Production: `OPENCLAW_HOOK_URL=https://tom.aglabs.ia.br/hooks/orbita`, `OPENCLAW_HOOK_TOKEN` (Sensitive; valor obtido no VPS-02 com `bash /root/.openclaw/workspace/scripts/orbita-hook-token.sh --mostrar`) e, por último, `OPENCLAW_DISPATCH_ENABLED=true`.
3. Deploy com a migration `0004_despachos`.
4. Prova: `diagnostics.read` em Integrações → `accepted` → o Tom registra `em_execucao` e `concluido` com evidência. Sem token, a rota responde 401.

Rotacionar: `orbita-hook-token.sh --rotacionar` no VPS-02, atualizar a variável na Vercel e reiniciar o gateway.

## Limites

- A rota direta `/hooks/agent` do gateway aceita o mesmo token; por isso ele é tratado como credencial de confiança total da entrada de webhooks e fica só na Vercel e no VPS-02.
- O Hermes Oracle continua com o receptor HMAC próprio e o histórico em `settings` (`hermes-dispatch.md`). Migrá-lo para `dispatches` é a próxima etapa da unificação.
