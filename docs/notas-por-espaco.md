# Notas e projetos por espaço

Notas pessoais ficam em `/notas`; rascunhos de trabalho em `/notas?escopo=empresa`. Listas, busca, links internos, criação, salvamento, fixação e exclusão respeitam esse espaço. O modo atual acompanha os links e o ícone da Órbita volta ao início desse modo.

As notas antigas permanecem pessoais. Novas notas da empresa recebem o marcador reservado `escopo:empresa` em `notes.tags`, já existente no banco. Nenhuma nota é movida pelo título e nenhuma migration ou reclassificação em massa é necessária. Alterar tags pela edição comum preserva o espaço; este fluxo não permite mover notas entre espaços.

ORBE usa o espaço ativo ao criar/buscar notas. Administradores via MCP podem informar `escopo: pessoal|empresa`; a omissão mantém o padrão pessoal. A ferramenta de busca mostra ID/data e avisa se quantidade ou conteúdo forem parciais.

Notas empresariais são rascunhos e anotações operacionais. Conhecimento canônico e decisões duráveis continuam no Vault. Projetos já são filtrados pela área correspondente; a tela mostra somente o espaço ativo, com a alternância geral na navegação.


Notas concluídas podem ser arquivadas e restauradas na aba Arquivadas do mesmo espaço. O marcador `estado:arquivada` preserva conteúdo, fixação e demais tags, sem migration ou exclusão. Listas ativas e a busca de notas da ORBE/MCP não repetem notas arquivadas; o link direto continua disponível no espaço original. Arquivar exige sessão e validação do espaço no servidor. A interface aguarda o salvamento pendente antes de arquivar.
