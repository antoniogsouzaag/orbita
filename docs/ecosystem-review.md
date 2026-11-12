# Revisão contínua do ecossistema

## Fontes e responsabilidade

O vault mantém manual, inventário, responsabilidades e regras aprovadas. Issues/PRs mantêm implementação e testes. A Órbita coordena tarefas internas, despachos e incidentes. O CRM mantém clientes, atividades e pendências comerciais. Cada gestor conserva a responsabilidade do próprio ambiente.

Relatórios de rodada não são notas canônicas. A tarefa de coordenação aponta à issue/PR autoritativa; não cria uma cópia editável do backlog técnico.

## Ciclo operacional

1. Consultar origem, versão, cobertura e atualidade. Falha de acesso é lacuna, não ausência de problema.
2. Reproduzir e classificar: defeito, lacuna de homologação, decisão ou hipótese. Urgência do problema não é o mesmo que risco da alteração.
3. Buscar item existente por ambiente, recurso e regra violada. Reusar a issue canônica antes de abrir outra.
4. Reservar um único executor e definir aceite observável. Trabalho em outro ambiente passa ao gestor do destino, com recebimento confirmado.
5. Corrigir um lote coerente, testar e preparar reversão. Outro revisor verifica o diff e a evidência da origem; autoavaliação do autor não é revisão independente.
6. Integrar e publicar conforme a autorização vigente. Merge, processo iniciado e mensagem aceita não comprovam efeito concluído.
7. Conferir resultado na origem e versão publicada. Timeout ou efeito incerto exige reconciliação antes de retry.
8. Registrar resultado e bloqueios na operação. Somente conhecimento durável confirmado atualiza a nota canônica pertinente.

## Automação estrutural disponível

O repositório `aglabs-core/ag-labs-knowledge` contém `scripts/check_vault.py` e o workflow `knowledge-quality.yml`: push/PR, execução manual e agenda diária às 9h30 de São Paulo. O workflow é de leitura, sem credenciais de negócio ou permissão para escrever conteúdo. Produz JSON com commit, cobertura e fingerprints estáveis dos achados, retido como artefato por 14 dias.

A agenda só roda a partir da configuração presente na branch padrão e depende de Actions habilitado/cota disponível; conferir o recibo do run. O artefato não é integração automática na fila da Órbita, revisão semântica por IA, envio de alertas, correção, merge ou deploy. A revisão periódica existente do Claude, os revisores de produto do Codex e a Sys continuam distintos; este verificador fornece evidência estrutural a eles.

## Autonomia e decisões

Leitura, reprodução, correções reversíveis e manutenção dentro do escopo seguem a autonomia já autorizada. Mudanças de grande impacto devem trazer solução concreta, evidência, alcance, teste e reversão para a decisão de Antonio. Preço, política, promessa, orçamento, ampliação de acesso, finalidade/retenção e ação irreversível sobre dados reais exigem decisão específica. Este procedimento não altera escopos, ativa despachos nem concede acesso a outro ambiente.

Uma revisão pode abrir PR ou registrar um bloqueio, mas não concluir uma tarefa sem satisfazer o aceite. Problemas de credencial, cota ou infraestrutura permanecem identificados com condição de retomada; não justificam desligar gates ou testar em clientes reais.

## Próximas homologações nas origens

Pagamentos, classificação de leads, backup/restauração, canais de despacho e deploy exigem verificação pelos gestores nos sistemas correspondentes. Uma execução deve preservar identidade autenticada, idempotência, evidência sanitizada e releitura. Não automatizar retry de cobrança, envio ou publicação a partir de ausência de resposta.

Antes de ampliar a autonomia ou trocar modelos, medir cobertura, duplicação, reincidência, falsa conclusão, tempo até assunção e resultado, intervenção humana, latência e custo. A existência de testes de contrato não certifica a qualidade factual das respostas da ORBE.
