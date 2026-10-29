# Avaliação supervisionada da ORBE — 29/10/2026

## Ambiente e método

Produção `orb.aglabs.api.br`, espaço Empresa, checkbox Somente leitura marcado antes do envio. Interface indicava `gpt-6-luna`. Base publicada: `cd03508` (PR #79). A conversa foi iniciada por esta revisão técnica, sem gravar tarefas, notas institucionais, pedidos a agentes ou alterar dados comerciais. O histórico normal da conversa é persistido pela aplicação; isso é distinto de execução operacional.

Pergunta: consultar fontes atuais da taxa Members, explicar 6,99% sobre o líquido após tarifas do Asaas e distinguir o comprovado do não comprovado sobre um alerta de 10% em `public.produtos`.

## Resultado observado antes da melhoria

Conversa `3d6fd8c6-3faf-4843-b254-92f0102c26f7`, resposta concluída com 39 segundos indicados pela interface. A ORBE buscou fontes, leu notas do vault, consultou resumo CRM, métricas do produto, tarefas e notas empresariais. Não apareceu recibo de escrita.

- Identificou a ficha `04 - Produtos e Projetos/Produto - Members.md`, atualizada em 28/10, como fonte comercial canônica.
- Explicou corretamente a separação das tarifas do Asaas e a taxa padrão sobre o líquido, com exemplo explicitamente ilustrativo.
- Encontrou tarefas concluídas relativas à divergência e recusou tratar título/status como prova independente de alteração do banco.
- Não deduziu percentual configurado a partir de métricas sem vendas observadas.
- Declarou que o valor atual de `public.produtos` não estava exposto pelas ferramentas consultadas. Não prometeu correção, despacho ou atualização de registros.

Isso exercita partes dos casos 14 e 21 de `orbe-qualidade.md`, além da distinção entre fonte, relato e efeito verificado. Não equivale a aprovar todos os casos nem certifica o modelo em geral. Não foram forjadas falhas ou adulterados snapshots de produção para testar os casos 02–05.

## Lacuna confirmada e mudança

A lista de tarefas devolve título/status, mas não notas. A inspeção autenticada da tarefa `b210f63c-6e57-46ee-b47c-9b7a38833cb6` mostrou histórico do Tom com relato de alteração em `public.produtos` e referência ao commit do vault `e06a2af`. Portanto, a resposta estava conservadora, mas não conseguia consultar uma evidência operacional já disponível ao proprietário na interface.

`consultar_tarefa` acrescenta leitura por UUID e espaço, com responsável, conclusão e notas paginadas. Continuação exige a versão da primeira leitura; mudança da tarefa recusa a mistura de páginas. A ORBE mantém o espaço ativo; o MCP expõe `orbita_consultar_tarefa` somente a Administrador. `consultar_minha_tarefa` continua restrita ao executor autenticado e não muda seu contrato.

Notas são dados não confiáveis para autorização. O resultado e a instrução do modelo distinguem relato registrado de verificação independente; o acesso ao relato do Tom não comprova o valor atual da tabela do VPS-02. Esta rodada não alterou comissão nem consultou diretamente essa base.

## Estado reconciliado das demais frentes

- **Barberias:** o remoto `origin/main` já contém o PR #147 (`2dc7c77`). O n8n confirmou versão ativa `85e82f49-a063-4c9c-b00f-949b261ad55a`, igual ao draft, `continueErrorOutput` em Enviar texto e retry desativado. A correção da continuidade, reconciliação imediata e alerta já está implementada e publicada. Permanecem classificação de rejeição comprovada e confirmação de notificação real; não foram feitas reexecuções ou mensagens a clientes nesta rodada.
- **Members:** vault, fonte em `members master f0c2487` e página pública `/politica-de-taxas` consultada por HTTP 200 concordam em 6,99% sobre o líquido pós-Asaas. O histórico do Tom relata correção do registro legado. Isso não comprova, de forma independente, o valor atual de `public.produtos` nem autoriza reescrever percentuais de produtos.
- **OPS #78:** comentários atuais comprovam teste sintético de autenticação de leitura com a credencial gerenciada. Rotação do segredo anterior e entrega real de alertas continuam sem comprovação nesta revisão.
- **Alertas de agentes:** a interface anterior só encerrava `workflow_error`; relatos de agentes podiam continuar abertos mesmo após uma correção. O painel passa a destacar esses alertas e permitir resolução pelo proprietário com evidência, preservando histórico e sem encerrar tipos controlados por coletores. Nenhum alerta real foi encerrado como teste.

Validação final, implantação e avaliação após a mudança são registradas no PR correspondente. O documento não transforma leitura de código, relato de agente, teste determinístico ou HTTP saudável em validação integral dos runtimes.
