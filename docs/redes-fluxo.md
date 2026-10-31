# Fluxo de redes sociais

O Órbita é a central de controle: fila, aprovação, checklist, entregas, calendário e métricas.
A produção continua onde já está: AG LABS no repo `marketing`; Members, MeCard e Barberias com o Fred (OpenClaw).
O Órbita registra o post, mas não renderiza nada.

## Etapas

| Etapa | Quem move | O que precisa ter |
|---|---|---|
| Ideia | rotina de pesquisa, Fred, Claude, Antonio | título e referência |
| Briefing → Rascunho | quem produz | gancho, formato, CTA |
| Revisão | quem produz, com a mídia anexada | link da mídia (http) |
| **Aprovado** | **só o Antonio, na tela** | checklist obrigatório completo |
| Agendado | Claude (Postiz) | data e entregas do CTA concluídas |
| Publicado | fechamento diário | link publicado e `media_id` do Instagram |

Os agentes usam as ferramentas MCP `redes_listar_posts`, `redes_criar_post` e `redes_atualizar_post`.
Pelo MCP, um agente cria posts no máximo até a etapa Revisão. A ferramenta recusa o pedido de aprovar.

## Entregas por palavra-chave (AG LABS)

Quando o CTA pede para comentar uma palavra, a palavra vai em **Entregas do CTA**, no post. Enquanto as entregas abaixo não estiverem marcadas, o post não pode ser agendado:

1. **Página do conteúdo gratuito** publicada em `conteudo.aglabs.ia.br/conteudos/<slug>`. O processo está no README do repo `conteudos-gratuito`.
2. **Linha na tabela do n8n `MSG POR POST AGLABS`** com:
   - `codigo`: a mesma palavra da legenda (ex.: `PROMPT`);
   - `media_id`: o id do post no Instagram, que fica no `POSTIZ-AGENDAMENTO.json` em `channels.instagram.releaseId`;
   - `mensagem`: o texto com o link da página **deste** post.
   - Sem `media_id`, o n8n usa a `MSG INSTAGRAM AGLABS` (busca pelo código) e entrega a mensagem genérica. Com `PROMPT`, isso significa mandar a biblioteca inteira em vez da página do post.
3. **Biblioteca do app AG LABS**: quando o conteúdo é de imagem ou motion, um exemplo é adicionado à biblioteca.

### Erros que já aconteceram, e como são pegos agora

| Erro | Como é pego |
|---|---|
| Post sem `media_id` na tabela, entregando o link genérico | auditoria: `so_fallback` |
| Palavra-chave da legenda diferente da tabela | auditoria: `keyword_errada` / `keyword_ausente` |
| Página misturada (mesma página em posts diferentes) | auditoria: `pagina_repetida` |
| Link de conteúdo fora do ar | auditoria: `link_quebrado` |

A auditoria é a ferramenta MCP `redes_auditar_entregas`, que só lê dados. Ela deve rodar todo dia depois do fechamento dos publicados.

## Conciliação de 30/10/2026

- 34 das 35 pastas da `fila/` foram publicadas. `site6x1` estava agendado para 01/11 às 20h.
- Falhas só em canais secundários: Facebook (argon24, santoro) e LinkedIn (dicionario-motion, nano21, reuniao-agentes).
- Faltavam linhas por post para bolsa, potes, splash e vigia (todos com `PROMPT`). As 4 linhas foram adicionadas com o `media_id` do Instagram.
- `motion2` pede `MOTION` e recebe a página `/conteudos/motion` (6 prompts), mas o post fala em 5. É preciso confirmar se essa é a página certa.
