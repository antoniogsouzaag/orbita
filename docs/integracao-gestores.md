# Integração dos gestores

Entrada canônica da central: `/documentacao` (mesmo contrato de `orbita://manual` e `documentacao` no MCP). Este guia complementa o manual com a configuração específica dos runtimes.

Este guia documenta os contratos de conexão e os critérios de validação por gestor. O estado de cada acesso e sua comunicação funcional devem ser conferidos no ambiente correspondente; a configuração descrita aqui não comprova uma execução.

Verificação registrada: [ativação do Hermes Oracle em 23/10/2026](hermes-oracle-ativacao-2026-10-23.md), com leitura funcional e atividade correlacionada na central.

## Dois sentidos independentes

| Sentido | Mecanismo | O que significa |
| --- | --- | --- |
| Hermes/OpenClaw → Órbita | Cliente MCP do agente → `https://orb.aglabs.api.br/api/mcp` | O agente consulta contexto/status e usa as ações permitidas pelo token. |
| Órbita → gestor | Adaptador de saída da central → entrada autenticada no runtime | Dispara uma execução controlada; não é habilitado pela conexão MCP anterior. |

Um servidor MCP na Órbita não é um canal de despacho bidirecional. Também não concede terminal, controle da VPS nem acesso à sessão desktop de Antonio.

| Gestor | Entrada MCP | Saída da Órbita |
| --- | --- | --- |
| Tom · OpenClaw (VPS-02) | `mcp.servers.orbita` no gateway, Bearer em `ORBITA_MCP_TOKEN` (ambiente do gateway), só o agente `main` | Rota mapeada `/hooks/orbita` → [contrato](openclaw-dispatch.md); resultado por `registrar_resultado` |
| Hermes Oracle (VPS-03) | Cliente MCP do Hermes, ver abaixo | Receptor HMAC dedicado → [contrato](hermes-dispatch.md) |
| Hermes EasyPanel (VPS-01) | Cliente MCP do Hermes, ver abaixo | Ainda sem saída |

## Conectar o OpenClaw (Tom)

O gateway OpenClaw não aceita SecretRef em cabeçalho MCP; o token vai para o arquivo de ambiente do serviço e o config usa substituição: `headers.Authorization = "Bearer ${ORBITA_MCP_TOKEN}"`, com `codex.agents: ["main"]` para que só o Tom receba o perfil Administrador. A entrada do token é mascarada (`scripts/orbita-token.sh` no workspace do Tom), validada contra `tools/list` antes de salvar. Mudança de variável de ambiente exige restart do gateway; `openclaw mcp doctor orbita --probe` confirma a conexão.

## Conectar Hermes Oracle ou Hermes EasyPanel

1. O proprietário cria um acesso individual em **Agentes**, com nome inequívoco e perfil explícito. A política canônica concede Administrador a Oracle, EasyPanel e Tom; outros agentes começam em leitura. Administrador inclui dados pessoais e escrita: não é apenas status da infraestrutura.
2. No painel do gestor, conferir o perfil selecionado e abrir **MCP → Add Server**. Na interface Hermes **v0.21.5** conferida, preencher nome `orbita`, URL `https://orb.aglabs.api.br/api/mcp` e selecionar **Auth → Bearer token**. Inserir somente `orb_…` no campo mascarado de token. O formulário acrescenta o prefixo `Bearer`; não preencher um cabeçalho genérico nesse campo.

   O Hermes salva o segredo em `MCP_ORBITA_API_KEY` no `.env` do perfil e mantém em `config.yaml` apenas a referência `Authorization: Bearer ${MCP_ORBITA_API_KEY}`. Esse comportamento está no código oficial da tag **`v2026.9.24`**, correspondente à versão v0.21.5. O token da Órbita é um Bearer estático, não OAuth. Como alternativa no CLI:

   ```bash
   hermes mcp add orbita --url https://orb.aglabs.api.br/api/mcp --auth header
   ```

   Conferir `hermes mcp add --help` na instalação antes de executar. No CLI, inserir também somente `orb_…` no campo mascarado **API key / Bearer token**. Nunca colocar o segredo em conversa, issue, Git ou argumento de shell.
3. Usar o perfil correto e proteger o arquivo de credenciais/configuração gerado. Não editar configuração de outro gestor ou perfil a partir desta integração. Se a interface utilizada não oferecer entrada segura, interromper e combinar um meio protegido com o proprietário.
4. Executar `hermes mcp test orbita` no ambiente do gestor. Recarregar os MCPs pelo mecanismo disponível na versão instalada, ou iniciar nova sessão; não reiniciar um gateway de atendimento sem avaliar o impacto.
5. Confirmar handshake e catálogo; chamar `contexto_operacional` com `ao_vivo: false` e depois uma consulta de status. Verificar na central nome e horário da atividade. Um teste de conexão pode validar somente descoberta: a chamada de ferramenta confirma a leitura funcional.
6. Validar separadamente a escrita com um evento operacional aprovado. Ler de volta o evento na central antes de afirmar sucesso. Não criar tarefa como teste sem avaliar o aviso Telegram que ela dispara.

Nunca compartilhar o mesmo token entre os três gestores. Revogar o token interrompe novas chamadas; remover a entrada do cliente é uma etapa distinta.

## Órbita chamar OpenClaw

Ver [openclaw-dispatch.md](openclaw-dispatch.md): webhook mapeado com lista fechada de ações, pedido gravado antes do envio, `Idempotency-Key` igual ao id e retorno do Tom por `registrar_resultado`. WebSocket não é usado: a Vercel não mantém conexão e o WebSocket do gateway é protocolo de operador.

## Órbita chamar Hermes

O Hermes oferece webhooks nativos que podem iniciar execuções do agente. São uma opção adequada para despacho assíncrono, desde que o gateway tenha a plataforma habilitada e a rota seja publicada com autenticação. Não é necessário expor um servidor MCP adicional só para receber esse gatilho.

A Órbita possui um adaptador manual para o receptor dedicado preparado por Hermes Oracle. A ativação permanece pendente de serviço, rota pública e chave. Veja [contrato de saída](hermes-dispatch.md). O webhook nativo descrito abaixo é uma referência e não o contrato do receptor dedicado. Antes de ativar:

- definir ações permitidas e um gestor responsável por cada ação; conteúdo externo é dado, não autorização para comandos arbitrários;
- configurar rota dedicada, segredo próprio e TLS, preservando autenticação e rotas existentes;
- usar assinatura HMAC com timestamp para limitar replay. O código oficial Hermes v0.21.5 define `X-Webhook-Signature-V2` como HMAC-SHA256 hexadecimal de `<timestamp>.<corpo bruto>` e `X-Webhook-Timestamp`; conferir o contrato da versão implantada;
- o timestamp é expresso em segundos Unix e precisa estar dentro de ±300 segundos do relógio do Hermes. O corpo assinado deve ser exatamente o enviado; V2 inválido não deve ser reenviado como V1;
- enviar `X-Request-ID` estável e manter estado durável na central. A deduplicação padrão do Hermes dura uma hora; essa memória não substitui recibo persistente, especialmente após restart;
- distinguir recebido, em execução, concluído, falhou e expirou. O webhook em modo agente retorna `202` com `status: accepted` e executa em segundo plano; isso não comprova início efetivo nem conclusão;
- considerar os limites padrão por rota de 30 requisições por minuto e corpo de 1 MB. Confirmar a configuração ativa antes de definir retries;
- confirmar as ferramentas da sessão de webhook. O padrão é restrito a `web_search`, `web_extract`, `vision_analyze` e `clarify`; cadastrar o MCP não comprova que essa sessão possa usá-lo. Ferramentas adicionais exigem configuração explícita e limitada da rota;
- retornar resultado sanitizado, referência de evidência e o mesmo identificador. O agente pode consultar/reportar pela conexão MCP, mas as ferramentas atuais de eventos não equivalem a uma fila transacional de jobs;
- limitar concorrência, tempo e orçamento; exigir aprovação para ações sensíveis e testar retries sem duplicar efeitos;
- permitir desabilitar o dispatcher sem interromper os monitores independentes do n8n.

Não ativar essa rota para encaminhar todo alerta automaticamente. Primeiro caso recomendado: diagnóstico somente leitura de um incidente selecionado, com retorno à Órbita e sem reinício ou alteração de serviços.

## Contexto sem duplicação

O vault mantém o manual aprovado e o inventário durável. A Órbita mantém estado operacional, tarefas internas e eventos transitórios; o CRM mantém contatos e atividades comerciais. Memórias privadas de Hermes/OpenClaw e históricos de chat permanecem nesses runtimes. Conectar MCP não importa automaticamente essas memórias nem transfere a conta de um aplicativo de chat para a API da central.

## Referências

- [Release Hermes v0.21.5 — tag v2026.9.24](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.9.24).
- [Formulário MCP e autenticação Bearer — código v0.21.5](https://github.com/NousResearch/hermes-agent/blob/v2026.9.24/hermes_cli/web_server_mcp.py).
- [Persistência do segredo e teste MCP — código v0.21.5](https://github.com/NousResearch/hermes-agent/blob/v2026.9.24/hermes_cli/mcp_config.py).
- [Referência da configuração MCP — documentação v0.21.5](https://github.com/NousResearch/hermes-agent/blob/v2026.9.24/website/docs/reference/mcp-config-reference.md).
- [Webhooks e limites — documentação v0.21.5](https://github.com/NousResearch/hermes-agent/blob/v2026.9.24/website/docs/user-guide/messaging/webhooks.md).
- [Assinatura V2 e resposta assíncrona — código v0.21.5](https://github.com/NousResearch/hermes-agent/blob/v2026.9.24/gateway/platforms/webhook.py).
- [Documentação oficial atual de MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp) e [webhooks](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/webhooks).
- Implementação Órbita: `src/server/agents.ts`, `src/app/api/mcp/route.ts` e `src/server/context.ts`.

O formulário Bearer foi conferido na interface v0.21.5, e os contratos de persistência, MCP e webhook foram comparados com o código oficial da tag correspondente. Este documento não certifica a conexão ou o retorno funcional; a comunicação autenticada ponta a ponta precisa de evidência no ambiente de cada gestor.
