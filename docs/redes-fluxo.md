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

## Produção: do briefing à capa (AG LABS)

1. **Briefing aprovado** (vem da rotina das 6h ou do Antonio) → quem produz move o post para Rascunho.
2. **Foto da capa:** gerada pelo `gerar-imagem.mjs` do repo `marketing`.
   - Rosto do Antonio: `gpt25` com as 4 referências de `_sistema/marca/avatar Antonio`, passadas como caminho local (viram data URI; não dependem de bucket).
   - Produto ou cena: `nano`.
   - O prompt pede o assunto nos 2/3 de cima e o terço de baixo mais calmo, para o texto.
3. **Capa:** `producao/<slug>/build/slides.html` no padrão das capas recentes (foto sangrada, degradê escuro embaixo, título condensado em caixa alta, linha laranja em itálico e o selo @ag_labs). Render com `render.mjs`.
4. **Envio para a Órbita:** botão **Enviar** no campo "Mídia principal" do post. Agentes usam `redes_anexar_midia` (por link) ou `POST /api/redes/midia` (multipart, token de agente com escopo tarefas/admin). O arquivo fica guardado na própria Órbita (tabela `social_media`) e o card mostra a prévia.
5. **Revisão:** Antonio vê a capa no card. Aprovada a capa, seguem os slides internos, a página gratuita e a linha no n8n.

### Armazenamento e limpeza
- **Neon Object Storage (preferido):** projeto Neon `orbita-midia` (org ag labs, us-east-1, porque o storage ainda não existe em São Paulo), bucket `redes` com leitura pública. Na Vercel: `MEDIA_S3_ENDPOINT`, `MEDIA_S3_REGION`, `MEDIA_S3_BUCKET` e, como Sensitive, `MEDIA_S3_ACCESS_KEY_ID` (token_id) e `MEDIA_S3_SECRET_ACCESS_KEY`, de uma credencial com escopo storage:read/write. O post recebe o link público (`endpoint/redes/<arquivo>`), que o Postiz e o OpenClaw abrem direto. Grátis até 5 GB.
- **Sem essas variáveis:** o arquivo fica na própria Órbita (tabela `social_media`) e só abre com sessão ou token de agente.
- **Limpeza diária** (`/api/cron/midia`, 07h30 UTC): apaga a mídia de post **publicado há mais de 7 dias** e o arquivo **avulso com mais de 3 dias**. Apagar o post apaga as mídias dele. O link continua no post como registro.
- O bucket `carrosseis` do Supabase antigo não existe mais (o DNS não resolve desde 30/10).

## Quem faz o quê (automação)

| Etapa | Quem | Quando | Gatilho |
|---|---|---|---|
| Pesquisa e 3 briefings | Rotina na nuvem "Redes AG LABS: pesquisa e briefings" | seg–sáb, 6h | horário |
| Aprovar a ideia | Antonio, no Órbita | quando quiser | move de Briefing para Rascunho (ou exclui) |
| Produção (capa, miolo, legenda, página gratuita) | Claude Code: AG LABS com o Claude; Members, MeCard e Barberias com o Fred | ao aprovar a ideia | card em Rascunho |
| Revisão da arte | Antonio, no Órbita | quando quiser | Aprovado (ou volta com comentário nas notas) |
| Agendamento no Postiz | **o próprio Órbita** | no clique em Aprovar | ver abaixo |
| Fechamento e métricas | rotina diária | 7h30 | publicados do dia anterior |

### Por que a produção não é uma segunda rotina (ainda)
A produção roda na máquina: render em Chrome, Remotion, Replicate e as fontes da marca. Numa rotina na nuvem, cada execução teria que instalar tudo isso e receber as chaves. O plano:
1. **Agora:** produção sob demanda, comigo, seguindo `marketing/_sistema/pipeline/PRODUCAO-PADRAO.md`.
2. **Depois de cerca de 10 posts** passando pelos portões sem retrabalho: rotina de produção na nuvem às 8h, que pega os cards em Rascunho, produz e entrega em Revisão.

### Aprovar = agendar (desenho)
Ao mover para **Aprovado** no Órbita:
1. Valida o checklist e as entregas do CTA (já existe).
2. Envia as mídias do post para o Postiz (upload por URL) e cria o post no canal certo, na data marcada, com a legenda.
3. Guarda o id do Postiz no post e muda para **Agendado**. Se o Postiz falhar, o post volta para Aprovado com o erro nas notas.
4. O fechamento diário marca como **Publicado**, preenche o link e o `media_id` (vem do `releaseId` do Postiz) e roda a auditoria de entregas.
Sem data marcada, o Órbita sugere o próximo horário livre da grade. Nada é publicado sem o seu clique em Aprovar.

### Implementado (aprovar = agendar)
- **Aprovar** no Órbita agenda no Postiz:
  1. valida o checklist, a data e as entregas;
  2. sobe as mídias do post na ordem do carrossel (`…-01`, `…-02`…);
  3. cria o post no canal da marca e guarda o id em `checks.postiz`;
  4. muda a etapa para **Agendado**.
- **Se faltar algo**, o post fica em Aprovado com o motivo na notificação. O botão **Agendar no Postiz** tenta de novo.
- **Fechamento** (`/api/cron/redes`, todo dia às 00h15 de Brasília): post publicado vira **Publicado**, com link e `media_id` (o `releaseId`); erro vira **Falhou**, com o motivo nas notas.
- **Mudanças depois de agendado** não vão para o Postiz. Para trocar algo, edite no Postiz ou cancele e reaprove.
- **Agentes** não marcam Agendado nem Publicado: esses estados vêm só do Postiz.

## Piloto automático (31/10/2026)
- **Sem checklist manual.** A aprovação do Antonio é o único ponto humano. O sistema confere sozinho: gancho, legenda, CTA e mídia; com palavra-chave, também se a legenda pede a palavra, se há página e se a mensagem da DM tem o link.
- **1 post por dia por marca, às 20h.** A data entra sozinha na criação (próximo dia livre). Ao aprovar, se a data já passou, estiver a menos de 2 h ou o dia estiver ocupado, vai para o próximo dia livre.
- **Ao aprovar:** o sistema confere se a página gratuita está no ar (precisa responder 200), agenda no Postiz e muda para Agendado.
- **n8n:** o workflow "Órbita → entregas AG LABS" consulta `GET /api/redes/entregas` (Bearer `OPS_TOKEN`) a cada 30 min. Grava a linha do código em MSG INSTAGRAM (ao agendar; PROMPT não entra, porque é sempre por post) e a linha com `media_id` em MSG POR POST (ao publicar), e confirma com `POST /api/redes/entregas`.
