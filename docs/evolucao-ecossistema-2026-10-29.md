# Evolução do ecossistema — 29/10/2026

## Cobertura desta rodada

Leitura do manual MCP 2026-10-28.4, contexto operacional, diagnóstico de integrações, disponibilidade, fila Empresa, issues e comentários atuais; fichas da Órbita, Hermes Oracle, Registro de Agentes, Registro de Aplicações e Base de Conhecimento da Maia. Código analisado a partir de `origin/main` em `4ab0f5f`, em checkout isolado. O checkout principal estava desatualizado e continha alteração prévia em `tsconfig.json`, preservada.

O inventário retorna 87 notas, 13 agentes, 20 aplicações e 46 automações documentadas. A disponibilidade consultada às 13h36 de Brasília informou 36/36 endereços com verificação recente e três monitores atualizados. Os agregados de Barberias, Members, VibeKit, MeCard, AG LABS App e Viajeki responderam via CRM. Isso confirma essas consultas, sem certificar login, cobrança, entrega de mensagens ou qualidade factual das respostas dos modelos.

## Correções na fonte de conhecimento dos agentes

- **Cache local:** a chave anterior usava somente tamanho e mtime, permitindo colisão entre arquivos diferentes. A versão da árvore usava quantidade e maior mtime: editar outra nota podia manter o índice antigo. As chaves passam a incluir caminho, tamanho, mtime e ctime; a versão deriva do manifesto ordenado completo. São identificadores de metadados locais, não hashes do conteúdo nem prova de sincronização com GitHub.
- **Cobertura do GitHub:** uma árvore truncada ou com formato inválido passa a ser recusada. Uma atualização forçada que falha invalida a validade temporal do snapshot anterior, evitando reapresentá-lo como saudável na leitura comum seguinte. A resposta parcial não é usada para concluir ausência de notas. Não foi implementada paginação de árvores grandes; a indisponibilidade exige tratar a cobertura na origem.
- **Erros de origem:** respostas brutas HTTP e exceções de rede/JSON não entram na saúde do vault ou no log emitido por `getVaultIndexSafe`. Somente mensagens construídas pelo adaptador podem sair dessa fronteira. Dicas de autenticação continuam disponíveis. Isso não é sanitização universal do conteúdo institucional e de todas as rotas.
- **Busca:** consulta vazia retorna sem carregar o vault. Título, corpo e tags normalizados são reutilizados por nota enquanto aquele objeto do índice existir; a contagem de ocorrências para pontuação para em dez, evitando `split` de todo o corpo por termo. Novo índice reconstrói esses dados sob demanda. Não há cache compartilhado entre processos nem benchmark de latência em produção.
- **Transporte:** requisições GitHub recusam redirecionamentos; blobs imutáveis continuam com `force-cache` e a árvore corrente com `no-store`.

Os testes isolados usam diretórios temporários e respostas sintéticas, sem dados empresariais, mensagens ou alteração do vault canônico. Incluem colisão local, edição de nota antiga, árvore truncada/inválida, falha de rede, JSON inválido, proteção do corpo de erro e renovação da busca após alteração.

## Continuidade com critérios verificáveis

| Frente | Estado confirmado | Critério para concluir |
| --- | --- | --- |
| [Credencial OPS — Órbita #78](https://github.com/antoniogsouzaag/orbita/issues/78) | Comentário atual registra correção da credencial gerenciada, migração de dois fluxos e leitura sintética HTTP 200 na execução 57105 | Comprovar rotação coordenada do segredo anterior e funcionamento dos consumidores; leitura não comprova entrega real de alerta |
| [Lembretes — Barberias #145](https://github.com/aglabs-core/barberias/issues/145) | Registro normal de resultados corrigido e publicado; issue informa PR #146 integrado e CI impedido por cobrança | Tratar exceção em Enviar texto sem perder itens posteriores; preservar unknown sem reenvio automático; validar falha parcial e concorrência entre sessões independentes |
| Comissão Members | Monitoramento ainda retorna alerta de divergência entre 10% registrado e 6,99% exposto | Conferir política aprovada, código e site atuais; não escolher percentual por inferência ou pelo alerta |
| Revisores locais do Codex | Os arquivos `automation.toml` dos dois revisores consultados estão PAUSED, em acordo com o inventário | Se houver retomada autorizada, conferir o prompt executor contra `triagem-evolucao.md` e manter gates; esta rodada não reativou rotinas |
| ORBE e agentes | Manual distingue fonte, evidência, escopo, execução e decisão | Executar a matriz supervisionada de `orbe-qualidade.md` no runtime correspondente; testes de software não certificam resposta factual do modelo |
| Conhecimento dos agentes | Maia tem índice próprio e precedência explícita de política/produto/processo; status de agente não comprova disponibilidade | Conferir a montagem e versão realmente utilizadas por cada runtime antes de alegar alinhamento integral |

Não foram criadas responsabilidades, novas políticas comerciais, despachos, tarefas duplicadas ou mensagens a terceiros. Este relatório fica no repositório por conter evidências transitórias e continuidade técnica; não foi copiado para o vault canônico. Resultados finais de validação, revisão e publicação ficam no PR desta alteração.

## Continuação após o PR #79

A [avaliação supervisionada e reconciliação](./orbe-avaliacao-2026-10-29.md) atualiza o estado acima: Barberias #147 já está integrado e a versão do fluxo foi conferida publicada. A ORBE foi avaliada em somente leitura e uma lacuna de consulta das notas de tarefas foi confirmada e corrigida. O relato de correção do Members foi encontrado na tarefa concluída, preservando a distinção entre relato e leitura independente da base. Os pontos já implementados não devem ser retomados como bugs novos com base na tabela inicial desta rodada.
