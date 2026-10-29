# Organização de notas e projetos — 29/10/2026

## Problema confirmado

O projeto empresarial Redes sociais — operação e evolução foi criado a pedido de Antonio. A proposta estava em uma nota avulsa e a tarefa de discussão continha seu link. A interface suporta notas de projeto pelo marcador `p:<UUID>`, mas `criar_nota` no MCP/ORBE não expunha esse vínculo e não havia operação para organizar uma nota existente. Copiar a proposta criaria duas versões concorrentes. Além disso, `buscar_notas` entrega até 2000 caracteres por nota; os agentes não tinham leitura integral de uma nota da Órbita, embora o proprietário pudesse abri-la na interface.

## Entrega

- Leitura por UUID com paginação, versão e identificação de arquivo, escopo e projetos.
- Criação com projeto explícito opcional e vínculo de nota existente por versão.
- Preservação de conteúdo e metadados; transação impede sobrescrever edição concorrente ao vincular.
- Nenhuma migration, nova automação, publicação social, atribuição de agentes ou mudança do Vault.

O uso concreto após publicação é vincular a nota `88cab7d0-f29d-4aa2-9487-613454a3407e` ao projeto `e59c9ab4-f011-4550-955b-d934b217c4d9`, com releitura e versão atuais. A existência deste documento não comprova que o vínculo já foi aplicado. Evidência final fica no PR da alteração.

## Frentes preservadas

Consulta da Órbita em 29/10: 35/36 endereços no ar, Pack Canva com falha DNS; nenhum workflow_error na amostra das últimas 24 h. A fila já inclui tarefa empresarial `364b7982-c14d-4c74-acdf-a90b9f8734c8` com o pedido de atualizar Cortes e Pack para os domínios `cortes.lojalabs.com.br` e `pack.lojalabs.com.br`, monitoramento, vault e backlinks. Antonio havia reservado essa frente para o primeiro caso real do Oracle. Esta rodada não a assume nem despacha, não modifica domínios e não trata a ausência de falhas como prova de autonomia ou jornada validada.

OPS #78 permanece aberta para rotação comprovada e entrega real de alertas; a migração de credenciais e a coleta natural de disponibilidade já foram verificadas na rodada anterior. Nenhuma dessas pendências é reclassificada como concluída pela entrega das ferramentas de notas.
