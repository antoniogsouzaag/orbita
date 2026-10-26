# Memória da ORBE por escopo

Estado: implementado em 26/10/2026 (PR desta rodada). Substitui o desenho anterior desta página, que previa aprovação versionada fato a fato. Antonio escolheu um modelo mais leve, inspirado no Hermes: memória curta com limite, sempre presente, curada pela própria ORBE e visível para ele.

## Por que este modelo

O ecossistema já tem lugar para quase tudo:

| Onde | O que guarda |
| --- | --- |
| Vault | Conhecimento canônico da AG LABS: identidade, produtos, agentes, processos, decisões aprovadas |
| Manual da Órbita (`src/lib/agent-handbook.ts`) | Como o sistema funciona: fontes, escopos, ferramentas, contratos |
| Órbita, CRM e apps | Estado ao vivo: tarefas, metas, métricas, status, incidentes |
| MCP | Ferramentas, que funcionam quase como skills dos agentes |

Faltava só o que nenhuma dessas fontes guarda: **como trabalhar bem com Antonio** e **o que se aprende nas conversas** antes de virar decisão no Vault. Por isso a memória é pequena de propósito. Um limite de caracteres obriga a escolher o que importa, como no Hermes (`MEMORY.md`/`USER.md` com teto fixo), em vez de acumular um diário que vira ruído no contexto.

## Camadas

| Camada | Persistência | Uso |
| --- | --- | --- |
| Conversa atual | Servidor (`orbe_conversations`), por espaço | Continua em outro aparelho; Histórico na tela da ORBE |
| Conversas anteriores | 60 dias, até 50 por espaço | `buscar_conversas` quando Antonio se refere a algo já conversado |
| Memória curta | `orbe_memories`, sem expiração | Sempre nas instruções: blocos geral + espaço atual |
| Vault, manual, fontes ao vivo | Origem própria | Consultados como antes; a memória não substitui |

## Memória curta

- **Blocos e limites:** `geral` (como trabalhar com Antonio, vale nos dois espaços) 1.400 caracteres; `pessoal` 2.200; `empresa` 2.200. Cada anotação tem até 400 caracteres.
- **Ferramenta `memoria`:** `adicionar`, `substituir` (por trecho único) e `remover`. Bloco cheio recusa a adição e pede para juntar ou trocar. Trecho ambíguo não altera nada.
- **Quando a ORBE guarda sozinha:** ao ser corrigida ou ao ouvir uma preferência durável, sempre mostrando o recibo "Memória: guardou…". O resto só quando Antonio pede.
- **O que nunca entra:** segredos (barrados também no servidor), dados de clientes, saúde, finanças detalhadas, resumos de conversa, métricas, status, tarefas e o que já está no Vault ou no manual.
- **Escopo:** a conversa Pessoal vê `geral` + `pessoal`; a Empresa vê `geral` + `empresa`. A ferramenta recusa escrever no bloco do outro espaço.
- **Somente leitura:** a ferramenta de memória fica fora do catálogo nesse modo.
- **Antonio no controle:** ORBE → Memória mostra os blocos com o uso de cada um; dá para editar, apagar e adicionar à mão.
- **Não é autorização:** memória é contexto. Instruções e permissões continuam vindo de Antonio e dos contratos do sistema.
- **MCP:** `memoria`, `buscar_conversas`, `pedir_a_agente` e `status_agentes` são exclusivas da ORBE e não viram `orbita_*` para os agentes.

## Consolidação antes de apagar

Como o OpenClaw faz com a "dreaming" noturna, uma rotina diária (`/api/cron/orbe`, 06:00 UTC) revisa as conversas paradas há pelo menos 1 hora que mudaram desde a última passada:

1. Para cada conversa, o modelo recebe o texto (sem recibos nem marcadores) e a memória atual, com **apenas** a ferramenta `memoria` disponível e instruções para guardar só aprendizados duráveis. "Nada a guardar" é um resultado válido.
2. A conversa é marcada como consolidada somente se a revisão terminar. Falha volta na próxima rodada.
3. Conversas com mais de 60 dias, ou além das 50 mais recentes do espaço, são apagadas **apenas se já consolidadas** depois da última mudança.

### Custo da rotina

Só conversas novas ou alteradas entram, no máximo 20 por noite. Para gastar pouco:

- **Conversas curtas** (menos de 2 mensagens de Antonio) são marcadas como consolidadas sem chamar IA.
- **`ORBE_CONSOLIDATION_MODEL`**: modelo mais barato do mesmo provedor só para escrever a memória, com raciocínio mínimo. Vazio usa o modelo da conversa, também com raciocínio mínimo.
- **`ORBE_CONSOLIDATION_GATE=jev`** (opcional): o Jev, via OpenRouter, decide antes se há algo a guardar. Só um "nada" com confiança ≥ 0,8 pula o modelo que escreve; dúvida ou falha seguem o caminho normal. Isso envia o texto da conversa (até 12 mil caracteres) ao OpenRouter, por isso fica desligado por padrão.
- **`ORBE_CONSOLIDATION_ENABLED=false`** pausa a rotina inteira, inclusive a expiração das conversas.

A resposta da rotina informa quantas conversas foram revisadas, quantas foram puladas sem modelo e quantas mudanças de memória houve.

Apagar uma conversa pelo Histórico é imediato e não passa pela consolidação: é uma escolha explícita de Antonio.

## Limites conhecidos

- A Órbita tem um único usuário autenticado. Se passar a ter vários, conversas e memória precisam de dono derivado no servidor antes de qualquer compartilhamento.
- O texto das conversas fica no banco da Órbita por até 60 dias e segue a política de backup do provedor do banco. Apagar no Histórico remove da base ativa, não de backups antigos.
- A consolidação usa o mesmo provedor e modelo da ORBE, com uma chamada por conversa alterada. Não há medição de custo por conversa ainda.
- A matriz supervisionada de qualidade ([orbe-qualidade.md](./orbe-qualidade.md)) continua pendente; testes automatizados não certificam a qualidade do que o modelo decide guardar.
