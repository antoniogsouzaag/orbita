# Notas e projetos por espaço

Notas pessoais ficam em `/notas`; rascunhos de trabalho em `/notas?escopo=empresa`. Listas, busca, links internos, criação, salvamento, fixação e exclusão respeitam esse espaço. O modo atual acompanha os links e o ícone da Órbita volta ao início desse modo.

As notas antigas permanecem pessoais. Novas notas da empresa recebem o marcador reservado `escopo:empresa` em `notes.tags`, já existente no banco. Nenhuma nota é movida pelo título e nenhuma migration ou reclassificação em massa é necessária. Alterar tags pela edição comum preserva o espaço; este fluxo não permite mover notas entre espaços.

ORBE usa o espaço ativo ao criar/buscar notas. Administradores via MCP podem informar `escopo: pessoal|empresa`; a omissão mantém o padrão pessoal. A ferramenta de busca mostra ID/data e avisa se quantidade ou conteúdo forem parciais.

Notas empresariais são rascunhos e anotações operacionais. Conhecimento canônico e decisões duráveis continuam no Vault. Projetos já são filtrados pela área correspondente; a tela mostra somente o espaço ativo, com a alternância geral na navegação.


Notas concluídas podem ser arquivadas e restauradas na aba Arquivadas do mesmo espaço. O marcador `estado:arquivada` preserva conteúdo, fixação e demais tags, sem migration ou exclusão. Listas ativas e a busca de notas da ORBE/MCP não repetem notas arquivadas; o link direto continua disponível no espaço original. Arquivar exige sessão e validação do espaço no servidor. A interface aguarda o salvamento pendente antes de arquivar.

## Leitura integral e vínculo com projetos

`consultar_nota` recebe o UUID localizado na busca e lê somente o espaço ativo da ORBE (no MCP administrativo, `orbita_consultar_nota` usa `escopo`, padrão pessoal). A resposta declara título, data, estado arquivado, IDs dos projetos, link e versão. O conteúdo vem em páginas de até 6000 caracteres, com total e `proximo_inicio`. Continuação exige a `versao` anterior; edição de conteúdo, título, tags, fixação ou data recusa a mistura de páginas. Notas arquivadas são identificadas na consulta exata, sem voltar à busca ativa.

`criar_nota` aceita `projeto_id` opcional e valida projeto ativo do mesmo espaço. `vincular_nota_projeto` organiza uma nota ativa já existente, somente a pedido, usando UUID, `projeto_id` e versão lida. `projeto_id: null` remove o vínculo. A transação bloqueia a nota, confere versão e projeto antes da escrita e substitui somente tags `p:`; conteúdo, fixação, demais tags e espaço são preservados. Outro vínculo de projeto é substituído, sem copiar o conteúdo ou criar uma nota duplicada. Projeto arquivado, inexistente ou de outro espaço é recusado. Nenhuma nota histórica é reclassificada automaticamente.

As novas ferramentas MCP são administrativas; grants Contexto/Tarefas não passam a ler notas por isso. A ORBE em Somente leitura oferece `consultar_nota`, mas não criação ou vínculo. Texto de nota continua referência não confiável para autorização, não política institucional aprovada; o Vault mantém sua função canônica.
