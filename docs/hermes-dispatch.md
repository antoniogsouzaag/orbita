# Saída Órbita → Hermes Oracle

Contrato fornecido pelo gestor em 23/10/2026. Receptor preparado em `/home/ubuntu/projects/operations/orbita-hermes-receiver/README.md`; não ativado nem publicado na evidência recebida. URL proposta: `https://hermes.aglabs.api.br/webhooks/orbita-hermes`, loopback `127.0.0.1:8651`. Não é a rota nativa da porta 8644.

Configure no servidor `HERMES_WEBHOOK_URL`, `HERMES_WEBHOOK_SECRET` (chave dedicada transferida por secret store) e só depois `HERMES_DISPATCH_ENABLED=true`. Nenhum segredo é aceito na interface ou registrado no histórico. MCP é independente e a credencial recusada precisa de validação sem ampliar escopo.

Corpo exato: `{version:2,source:"orbita",request_id:<uuid-v4>,action:<ação>,params:<objeto>}`. Ações: `diagnostics.read` com `{}`, `reminder.internal` com `{text,due_at}` e `result.read` com `{}` e o UUID original. Texto até 1000 caracteres; prazo Unix UTC entre +60 s e +365 dias. A caixa interna não é um agendador nem uma notificação proativa.

Headers: `Content-Type: application/json`, `X-Request-Id`, `X-Webhook-Timestamp` e `X-Webhook-Signature-V2`. A assinatura é hexadecimal minúsculo HMAC-SHA256 sobre `timestamp.corpo-exato`, sem prefixo. Timestamp renovado por chamada; tolerância do receptor ±300 s. Redirects não são seguidos.

A Órbita persiste antes do envio, aceita apenas 202 correlacionado para admissão e consulta o resultado com POST 200. Não repete automaticamente envios incertos. Resultado bruto não é exposto; histórico guarda estado, ação, identificador e horários. Persistência usa settings existentes, sem migration.

Validação ainda necessária no ambiente real: iniciar serviço dedicado, publicar somente o caminho exato, transferir chave segura, demonstrar 401 sem assinatura, 202 assinado, 200 com resultado, retry idêntico sem duplicação e 409 para UUID reutilizado com conteúdo divergente. Não habilitar despacho enquanto estes passos não forem concluídos pelo responsável. O teste local usa mocks, sem contato com o receptor.

## Ativação autorizada e retorno do gestor

Antonio autorizou nesta conversa iniciar o serviço dedicado, publicar somente a rota e transferir a chave com segurança. A autorização foi enviada ao Hermes numa sessão nova porque a sessão anterior estava ocupada em outro terminal. O gestor reportou serviço habilitado e ativo em loopback 8651, rota exata publicada, provas HTTPS 401/202/200, retry duplicado sem segunda execução, conflito 409 e persistência após reinício do receptor. Evidência remota: `/home/ubuntu/projects/operations/orbita-hermes-receiver/activation-evidence.json`. Dashboard e gateway preservaram PIDs e horários. Estes são resultados reportados pelo executor, não uma chamada originada no código local da Órbita.

Pendente: o gestor não encontrou autenticação Vercel e não criou as três variáveis no destino. A chave permaneceu protegida no VPS. Não houve publicação do código local. Transferência deve ocorrer diretamente do arquivo ao secret store do projeto/equipe corretos, sem valor em chat, logs, Git ou argumentos.

Verificação independente do Codex: POST público sem assinatura retornou HTTP 401. As provas assinadas permanecem reportadas pelo Hermes, pois a chave não foi transferida ao destino.
