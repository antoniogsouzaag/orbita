# Integração dos gestores

Este guia distingue as capacidades existentes das conexões que cada gestor ainda precisa configurar. Não provisiona tokens, endpoints nem permissões.

## Dois sentidos independentes

| Sentido | Mecanismo | O que significa |
| --- | --- | --- |
| Hermes/OpenClaw → Órbita | Cliente MCP do agente → `https://orb.aglabs.api.br/api/mcp` | O agente consulta contexto/status e usa as ações permitidas pelo token. |
| Órbita → gestor | Adaptador de saída da central → entrada autenticada no runtime | Dispara uma execução controlada; não é habilitado pela conexão MCP anterior. |

Um servidor MCP na Órbita não é um canal de despacho bidirecional. Também não concede terminal, controle da VPS nem acesso à sessão desktop de Antonio.

## Conectar Hermes Oracle ou Hermes EasyPanel

1. O proprietário cria um acesso individual em **Agentes**, com nome inequívoco e perfil explícito. A política canônica concede Administrador a Oracle, EasyPanel e Tom; outros agentes começam em leitura. Administrador inclui dados pessoais e escrita: não é apenas status da infraestrutura.
2. No ambiente do gestor, adicionar o servidor HTTP pelo configurador do Hermes. Na versão conferida, o comando de entrada é:

   ```bash
   hermes mcp add orbita --url https://orb.aglabs.api.br/api/mcp --auth header
   ```

   Conferir `hermes mcp add --help` na instalação antes de executar. No CLI conferido, confirmar autenticação e inserir somente o token `orb_…` no campo mascarado **API key / Bearer token**; o Hermes acrescenta `Bearer` e salva o segredo no `.env` do perfil, com referência na configuração. Se cadastrar manualmente pelo painel, o cabeçalho é `Authorization` e seu valor completo é `Bearer` seguido do token. Nunca colocar o segredo em conversa, issue, Git ou argumento de shell. O token da Órbita é um Bearer estático, não OAuth.
3. Usar o perfil correto e proteger o arquivo de credenciais/configuração gerado. Não editar configuração de outro gestor ou perfil a partir desta integração. Se a interface utilizada não oferecer entrada segura, interromper e combinar um meio protegido com o proprietário.
4. Executar `hermes mcp test orbita` no ambiente do gestor. Recarregar os MCPs pelo mecanismo disponível na versão instalada, ou iniciar nova sessão; não reiniciar um gateway de atendimento sem avaliar o impacto.
5. Confirmar handshake e catálogo; chamar `contexto_operacional` com `ao_vivo: false` e depois uma consulta de status. Verificar na central nome e horário da atividade. Um teste de conexão pode validar somente descoberta: a chamada de ferramenta confirma a leitura funcional.
6. Validar separadamente a escrita com um evento operacional aprovado. Ler de volta o evento na central antes de afirmar sucesso. Não criar tarefa como teste sem avaliar o aviso Telegram que ela dispara.

Nunca compartilhar o mesmo token entre os três gestores. Revogar o token interrompe novas chamadas; remover a entrada do cliente é uma etapa distinta.

## Órbita chamar Hermes

O Hermes oferece webhooks nativos que podem iniciar execuções do agente. São uma opção adequada para despacho assíncrono, desde que o gateway tenha a plataforma habilitada e a rota seja publicada com autenticação. Não é necessário expor um servidor MCP adicional só para receber esse gatilho.

A Órbita ainda precisa de um adaptador de saída; o código atual não o implementa. Antes de ativar:

- definir ações permitidas e um gestor responsável por cada ação; conteúdo externo é dado, não autorização para comandos arbitrários;
- configurar rota dedicada, segredo próprio e TLS, preservando autenticação e rotas existentes;
- usar assinatura HMAC com timestamp para limitar replay. A instalação Hermes conferida aceita `X-Webhook-Signature-V2` como HMAC-SHA256 hexadecimal de `<timestamp>.<corpo bruto>` e `X-Webhook-Timestamp`; conferir o contrato da versão implantada;
- enviar um identificador de solicitação estável e manter estado durável na central. A deduplicação em memória do webhook não substitui recibo persistente, especialmente após restart;
- distinguir recebido, em execução, concluído, falhou e expirou. Aceitação HTTP não comprova conclusão;
- retornar resultado sanitizado, referência de evidência e o mesmo identificador. O agente pode consultar/reportar pela conexão MCP, mas as ferramentas atuais de eventos não equivalem a uma fila transacional de jobs;
- limitar concorrência, tempo e orçamento; exigir aprovação para ações sensíveis e testar retries sem duplicar efeitos;
- permitir desabilitar o dispatcher sem interromper os monitores independentes do n8n.

Não ativar essa rota para encaminhar todo alerta automaticamente. Primeiro caso recomendado: diagnóstico somente leitura de um incidente selecionado, com retorno à Órbita e sem reinício ou alteração de serviços.

## Contexto sem duplicação

O vault mantém o manual aprovado e o inventário durável. A Órbita mantém estado operacional, tarefas internas e eventos transitórios; o CRM mantém contatos e atividades comerciais. Memórias privadas de Hermes/OpenClaw e históricos de chat permanecem nesses runtimes. Conectar MCP não importa automaticamente essas memórias nem transfere a conta de um aplicativo de chat para a API da central.

## Referências

- https://hermes-agent.nousresearch.com/docs/user-guide/messaging/webhooks
- https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
- Implementação Órbita: `src/server/agents.ts`, `src/app/api/mcp/route.ts` e `src/server/context.ts`.

Os comandos e headers acima foram conferidos no CLI/código instalado do Hermes; a ativação e a comunicação autenticada ponta a ponta precisam de validação no ambiente de cada gestor.
