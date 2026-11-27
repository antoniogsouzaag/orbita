# Plugin Órbita: conexão OAuth MCP

O servidor continua em `https://orb.aglabs.api.br/api/mcp`. Tokens individuais `orb_…` continuam válidos para clientes com header. O OAuth acrescenta login/consentimento e renovação para o plugin; instalar localmente não instala na conta web.

## Publicar o servidor

1. Aplicar a migration `0007_mcp_oauth.sql` pelo procedimento normal (`npm run db:migrate`) e publicar o código.
2. Confirmar a origem `ORBITA_PUBLIC_URL` (padrão `https://orb.aglabs.api.br`). Não usar hostname de uma requisição para construir issuer ou audience.
3. Conferir `/.well-known/oauth-authorization-server` e `/.well-known/oauth-protected-resource/api/mcp`: JSON público, sem redirecionamento para login. `/api/mcp` sem token deve responder 401 com `WWW-Authenticate` apontando para os metadados.

## Instalar na conta web

Em <https://chatgpt.com/plugins>, adicionar um servidor MCP personalizado (nome Órbita, URL acima), selecionar OAuth com cadastro dinâmico/DCR. Não fornecer client ID/secret nem colar token na descrição. Se houver rascunho antigo, verificar sua URL e autenticação antes de substituir a conexão. Nenhum ID `plugin_asdk_app…` é inventado neste repositório.

Começar com `contexto status` para leitura. O challenge HTTP anuncia esses escopos iniciais explicitamente, evitando que clientes usem todo o catálogo de permissões como padrão. Os metadados continuam publicando todos os escopos suportados. Para administração, a conexão deve solicitar `admin`, e o proprietário deve marcar Administrador na tela de consentimento. O pacote em `plugins/orbita/mcp.json` solicita todos os escopos; o consentimento deixa Administrador desmarcado.

Entrar na Órbita com a senha e o 2FA existentes, selecionar as permissões e autorizar. Instalar/conectar na conta desejada. Abrir um novo chat, selecionar o plugin com @ e testar `documentacao`, seguido de uma consulta de tarefas. Confirmar a conexão em **Integrações → Acessos MCP**, inclusive último uso. Um plugin configurado/instalado não comprova consulta executada.

## Pacote e Codex

`plugins/orbita/plugin.json` e `mcp.json` formam um pacote portátil sem credenciais. Ele não equivale a publicação no catálogo web. Após criar a conexão web, o ID técnico real pode ser associado ao pacote conforme a documentação OpenAI. Distribuição pública não é necessária para uso pessoal.

Para conectar diretamente o Codex via OAuth:

```shell
codex mcp add orbita --url https://orb.aglabs.api.br/api/mcp --oauth-resource https://orb.aglabs.api.br/api/mcp
codex mcp login orbita --scopes contexto,status
```

Conferir as opções em `codex mcp add --help` e `codex mcp login --help` da versão instalada antes de executar. Se já houver uma entrada `orbita`, conferir `codex mcp get orbita` e executar apenas o login, preservando a configuração existente. OAuth local e conexão web têm autorizações próprias. Não é necessário cadastrar um client ID/secret para DCR.

Configuração manual equivalente em `~/.codex/config.toml`, com uma única entrada:

```toml
[mcp_servers.orbita]
url = "https://orb.aglabs.api.br/api/mcp"
oauth_resource = "https://orb.aglabs.api.br/api/mcp"
scopes = ["contexto", "status"]
startup_timeout_sec = 30
```

Executar `codex mcp login orbita`, concluir o consentimento na Órbita e abrir um novo chat. Confirmar com `documentacao({secao:"inicio"})`. `codex mcp list` identifica configuração/autenticação armazenada; a resposta da ferramenta comprova conexão e execução. O endereço exibido pela Órbita usa `ORBITA_PUBLIC_URL`, a mesma origem dos metadados OAuth.

## Recuperar uma conexão

O log interno do servidor registra `[mcp-http]` com método, status HTTP, autenticação reconhecida e presença dos formatos Accept/versão do protocolo. `[mcp-oauth-token]` registra somente status e código de resultado da troca ou renovação. Esses registros não incluem tokens, códigos de autorização, headers completos, nomes de agentes, corpos ou argumentos das ferramentas. Não gravam eventos no banco nem alteram a política de retenção dos logs da plataforma. Um HTTP 200 isolado não comprova descoberta nem execução bem-sucedida; confirmar a resposta MCP e o catálogo efetivo no cliente.

- **401 ou credencial expirada/revogada:** executar `codex mcp login orbita`. O prazo absoluto do refresh é de 30 dias.
- **Cliente ou callback não cadastrado:** iniciar um novo login no aplicativo; não reutilizar uma URL antiga de autorização. O Codex pode escolher outra porta local em cada tentativa.
- **Permissão insuficiente:** conferir o consentimento e o catálogo efetivo. Para solicitar mais permissões, executar novo login com `--scopes` e consentir explicitamente. Configurar escopos no cliente não concede acesso por si só.
- **Sem ferramentas depois de autorizar:** conferir `codex mcp list`, a URL e abrir um novo chat. Um plugin conectado na conta web não autoriza automaticamente a conexão local.

## Contrato e limites

- Authorization code + PKCE S256, código de uso único com validade de cinco minutos, vinculado a client ID, callback efetivamente usado na autorização e resource. No pedido de autorização, callbacks HTTP de loopback cadastrados aceitam variação somente da porta (RFC 8252 §7.3); host, caminho, protocolo e ausência de query/fragment continuam obrigatórios. Na troca do código, o callback deve ser idêntico ao usado na autorização, inclusive a porta.
- DCR aceita apenas os callbacks oficiais `https://chatgpt.com/connector_platform_oauth_redirect`, `https://chatgpt.com/connector/oauth/{id}` e loopback `/callback` (com ID opcional) do Codex. Nomes declarados pelo cliente não são prova de identidade OpenAI. Outros clientes exigem revisão explícita da política.
- Não há busca de URLs arbitrárias, client secret, password grant ou client credentials.
- Novos cadastros DCR têm limite global persistente de 100 por hora; repetir a configuração de um cliente existente não cria outro registro nem consome essa cota.
- Access token opaco de uma hora; refresh token rotativo com prazo absoluto de 30 dias. Replay do refresh revoga a família. Renovação não amplia escopos.
- Só hashes ficam no banco; access/refresh tokens nunca vão para página, URL ou logs. State e issuer retornam no callback; callback inválido não recebe redirecionamento.
- Cada consentimento cria um acesso OAuth revogável na lista existente. Revogação e perfil atual são verificados em cada uso. As permissões efetivas são limitadas também pelo consentimento original; aumentar o perfil não amplia silenciosamente o grant OAuth.
- O endpoint inteiro exige autenticação pelo esquema `Authorization: Bearer …`; não se aceita token solto no header nem se anuncia catálogo administrativo anônimo. A conexão não ativa despachos, automações ou comunicações por conta própria.
- Após expirar o prazo absoluto, refazer a conexão. A disponibilidade depende do servidor e da instalação/autorização do plugin em cada ambiente.

## Homologação após deploy

Testar login sem sessão, consentimento negado, leitura restrita, consentimento administrativo explícito, consulta autenticada via plugin web, renovação e revogação. Comparar `tools/list` com as permissões concedidas. Não usar dados reais para testar escrita ou despachos. Registrar separadamente código, migration, publicação, instalação e chamada autenticada.

Referências: [MCP no Codex](https://developers.openai.com/codex/mcp), [callbacks nativos (RFC 8252)](https://www.rfc-editor.org/rfc/rfc8252#section-7.3), [autenticação](https://developers.openai.com/plugins/build/auth), [pacote](https://developers.openai.com/plugins/build/plugins), [conectar e testar](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## Validação automatizada

`npm run check` executa lint, tipos, testes e build. `tests/db/mcp-oauth.test.ts` cobre descoberta, porta dinâmica do callback nativo, PKCE, vínculo exato do código, rotação/revogação, isolamento de escopos e handshake do cliente HTTP oficial do SDK até a execução de `documentacao`. O banco desses testes é PGlite em memória e não usa credenciais reais. `tests/unit/mcp-oauth-consent.test.ts` cobre a exigência de sessão e o consentimento.

A validação local não comprova publicação nem autorização de uma conta real; conferir essas etapas separadamente conforme a homologação acima.
