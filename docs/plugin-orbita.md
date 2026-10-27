# Plugin Órbita: conexão OAuth MCP

O servidor continua em `https://orb.aglabs.api.br/api/mcp`. Tokens individuais `orb_…` continuam válidos para clientes com header. O OAuth acrescenta login/consentimento e renovação para o plugin; instalar localmente não instala na conta web.

## Publicar o servidor

1. Aplicar a migration `0007_mcp_oauth.sql` pelo procedimento normal (`npm run db:migrate`) e publicar o código.
2. Confirmar a origem `ORBITA_PUBLIC_URL` (padrão `https://orb.aglabs.api.br`). Não usar hostname de uma requisição para construir issuer ou audience.
3. Conferir `/.well-known/oauth-authorization-server` e `/.well-known/oauth-protected-resource/api/mcp`: JSON público, sem redirecionamento para login. `/api/mcp` sem token deve responder 401 com `WWW-Authenticate` apontando para os metadados.

## Instalar na conta web

Em <https://chatgpt.com/plugins>, adicionar um servidor MCP personalizado (nome Órbita, URL acima), selecionar OAuth com cadastro dinâmico/DCR. Não fornecer client ID/secret nem colar token na descrição. Se houver rascunho antigo, verificar sua URL e autenticação antes de substituir a conexão. Nenhum ID `plugin_asdk_app…` é inventado neste repositório.

Se o formulário permitir escopos, solicitar `contexto status tarefas eventos admin`. Na ausência de escopos, o servidor oferece Contexto e Status. Para administração, a conexão deve solicitar `admin`, e o proprietário deve marcar Administrador na tela de consentimento. O pacote em `plugins/orbita/mcp.json` já solicita esses escopos; o consentimento deixa Administrador desmarcado.

Entrar na Órbita com a senha e o 2FA existentes, selecionar as permissões e autorizar. Instalar/conectar na conta desejada. Abrir um novo chat, selecionar o plugin com @ e testar `documentacao`, seguido de uma consulta de tarefas. Confirmar a conexão em **Integrações → Acessos MCP**, inclusive último uso. Um plugin configurado/instalado não comprova consulta executada.

## Pacote e Codex

`plugins/orbita/plugin.json` e `mcp.json` formam um pacote portátil sem credenciais. Ele não equivale a publicação no catálogo web. Após criar a conexão web, o ID técnico real pode ser associado ao pacote conforme a documentação OpenAI. Distribuição pública não é necessária para uso pessoal.

Para conectar diretamente o Codex via OAuth:

```shell
codex mcp add orbita --url https://orb.aglabs.api.br/api/mcp
codex mcp login orbita --scopes contexto,status,tarefas,eventos,admin
```

Conferir as opções em `codex mcp login --help` da versão instalada antes de executar. Se já houver entrada Orbita com Bearer, não sobrescrever sem conferir a configuração. OAuth local e conexão web têm autorizações próprias.

## Contrato e limites

- Authorization code + PKCE S256, código de uso único com validade de cinco minutos, vinculado a client ID, callback exato e resource.
- DCR aceita apenas os callbacks oficiais `https://chatgpt.com/connector_platform_oauth_redirect`, `https://chatgpt.com/connector/oauth/{id}` e loopback `/callback` (com ID opcional) do Codex. Nomes declarados pelo cliente não são prova de identidade OpenAI. Outros clientes exigem revisão explícita da política.
- Não há busca de URLs arbitrárias, client secret, password grant ou client credentials.
- Novos cadastros DCR têm limite global persistente de 100 por hora; repetir a configuração de um cliente existente não cria outro registro nem consome essa cota.
- Access token opaco de uma hora; refresh token rotativo com prazo absoluto de 30 dias. Replay do refresh revoga a família. Renovação não amplia escopos.
- Só hashes ficam no banco; access/refresh tokens nunca vão para página, URL ou logs. State e issuer retornam no callback; callback inválido não recebe redirecionamento.
- Cada consentimento cria um acesso OAuth revogável na lista existente. Revogação e perfil atual são verificados em cada uso. As permissões efetivas são limitadas também pelo consentimento original; aumentar o perfil não amplia silenciosamente o grant OAuth.
- O endpoint inteiro exige autenticação; não se anuncia catálogo administrativo anônimo. A conexão não ativa despachos, automações ou comunicações por conta própria.
- Após expirar o prazo absoluto, refazer a conexão. A disponibilidade depende do servidor e da instalação/autorização do plugin em cada ambiente.

## Homologação após deploy

Testar login sem sessão, consentimento negado, leitura restrita, consentimento administrativo explícito, consulta autenticada via plugin web, renovação e revogação. Comparar `tools/list` com as permissões concedidas. Não usar dados reais para testar escrita ou despachos. Registrar separadamente código, migration, publicação, instalação e chamada autenticada.

Referências: [MCP](https://learn.chatgpt.com/docs/extend/mcp), [autenticação](https://developers.openai.com/plugins/build/auth), [pacote](https://developers.openai.com/plugins/build/plugins), [conectar e testar](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## Evidência local desta implementação

Em 27/10/2026, a suíte completa passou com 402 testes (76 arquivos), incluindo a base atualizada da main. As verificações específicas do OAuth/consentimento/auditoria passaram com 20 testes. TypeScript, ESLint e build de produção passaram; uma execução inicial com concorrência irrestrita excedeu a memória do host, e a suíte completa foi executada novamente com `--maxWorkers=2`.

O teste HTTP + navegador headless Edge, com banco PGlite isolado e sessão local de teste, conferiu: descoberta pelo proxy real, retorno do login preservando o pedido, consentimento desktop/mobile sem overflow, Administrador desmarcado, erro sem seleção, cancelamento, autorização somente leitura, troca PKCE, `tools/list` sem ferramentas administrativas, renovação, presença na lista de acessos e 401 após revogação. O callback ChatGPT foi interceptado localmente; isso não é uma instalação nem autenticação real no ChatGPT web.

Migration de produção, deploy e conexão real da conta ChatGPT permanecem etapas posteriores. Nenhuma credencial real foi criada, distribuída ou modificada nesta validação.
