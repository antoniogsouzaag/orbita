# Evolução do ecossistema — 28/10/2026

## Escopo e evidências

Rodada solicitada por Antonio para fechar lacunas de consistência, desempenho e qualidade dos agentes. Leituras do MCP da Órbita entre 13h47 e 14h, America/Sao_Paulo: manual 2026-10-27.2, contexto operacional sem sondagens, fila da Empresa, diagnóstico de integrações, operação, automações, eventos e fichas do vault. Código conferido a partir de `origin/main` e869bc6; o checkout principal local estava 59 commits atrás e tinha alteração prévia em tsconfig.json, por isso o trabalho foi isolado.

O inventário contém 87 notas, 13 agentes, 20 aplicações e 46 automações documentadas. Isto é cobertura do inventário, não auditoria integral das jornadas ou dos runtimes.

## Situação encontrada

| Fonte | Evidência | Limite |
| --- | --- | --- |
| Disponibilidade | 35/35 endereços no ar, três monitores com batida recente | Há um incidente aberto; HTTP não valida jornadas |
| Produtos | Barberias, Members, VibeKit, MeCard, AG LABS App e Viajeki retornaram agregados via CRM | Contrato e data válidos não certificam receita ou todos os indicadores |
| n8n | VPS-01: 16/72 ativos e quatro falhas recentes; VPS-03: 17/33 ativos e nenhuma falha recente retornada | Contagens referem-se à consulta, não a todo o histórico |
| Barberias | Execução 56941 de QqfYPGW20aghaUDJ falhou em 28/10 às 13h, no nó Enviar texto; resposta indica HTTP 400 e destinatário não registrado | Sinal do provedor não comprova a causa de cadastro; não houve reenvio, alteração do workflow ou mensagem de teste |
| GitHub | Órbita e CLI retornaram zero itens abertos na organização consultada antes desta rodada | Não prova acesso a todos os privados; conta pessoal da Órbita fica fora da busca por organização |
| Empresa | fila_empresa retornou fila vazia | Não significa inexistência de backlog em outras fontes |
| OpenClaw | Último relato do Tom descrevia atualização em validação e versão instalada 2026.10.7 | Relato não é verificação independente de atualização concluída |

## Correções desta rodada

### Fonte GitHub consumida pelo painel e pelos agentes

Uma atualização forçada que falhava devolvia `stale`, mas deixava o cache de sucesso intacto. Outra leitura dentro de cinco minutos podia apresentar o mesmo snapshot como atual. O fallback também descartava uma última consulta válida vazia. A implementação passa a preservar o estado de falha e a data da origem, inclusive para listas vazias; novas tentativas comuns aguardam um minuto e a atualização explícita continua disponível. Recusa de acesso não reapresenta snapshot antigo.

Consultas simultâneas da mesma organização e credencial compartilham a atualização em andamento no processo. Três chamadas simultâneas passam a fazer duas buscas HTTP no teste, em vez de seis; não é benchmark de latência em produção nem cache distribuído.

O contrato da resposta é validado antes de aceitar um snapshot. Somente erros tipados gerados pelo adaptador podem fornecer mensagens ao consumidor; prefixo de texto externo não basta para considerá-lo seguro. Redirecionamentos são recusados.

### Conhecimento canônico

A ficha da Órbita ainda descrevia histórico apenas em sessionStorage e tokens na página Agentes. O [PR 12 do vault](https://github.com/aglabs-core/ag-labs-knowledge/pull/12), integrado em `cb8b708`, corrige essas informações com base no manual em produção e no código: conversas no servidor, memória por espaço e Integrações → Acessos MCP. Não altera política de retenção, responsabilidades ou permissões. A primeira tentativa de escrita pelo MCP falhou e a releitura confirmou que nada havia mudado; a atualização foi feita pelo GitHub com SHA e revisão do diff.

## Próximas verificações com critério de conclusão

1. **Barberias — envio de lembretes:** a leitura do workflow ativo confirmou que Enviar texto não possui tratamento de erro e só conecta sua saída normal a Registrar resultado do envio. Quando o nó lança erro, esse registro não é executado; a reserva já havia marcado o item como processing. Conferir reconciliação/expiração da fila e tratar rejeição explícita separadamente de envio com resultado desconhecido, sem converter timeout em autorização para reenviar. Validar com fixtures de rejeição, timeout e sucesso antes de publicar. Não usar mensagem a cliente como teste nem inferir o estado atual da linha no banco apenas pela execução.
2. **OpenClaw — atualização:** verificar versão efetivamente instalada e saúde posterior ao relato de canário; não afirmar conclusão pelo evento intermediário.
3. **ORBE — qualidade de saída:** executar a matriz supervisionada de `orbe-qualidade.md`, incluindo falha de fonte, snapshot antigo, ausência versus zero e separação Pessoal/Empresa. Testes de código não certificam resposta factual do modelo.
4. **Procedimentos de revisão:** comparar as rotinas realmente instaladas com `triagem-evolucao.md`. O inventário ainda descreve propostas/aprovações por categoria em rotinas antigas; a divergência precisa de confirmação no procedimento executor antes de alterar automações.
5. **Cobertura GitHub:** conciliar repositórios esperados com os visíveis ao token, incluindo conta pessoal. Uma lista vazia não deve ser usada para declarar todo o ecossistema sem pendências.

Esses itens são continuidade desta análise; não representam tarefas atribuídas a outros agentes, despachos ou automações habilitadas. Estado de publicação da correção de código e resultados dos gates ficam no PR correspondente.

## Validação local

Com instalação própria pelo lockfile (`npm ci`) e Node 24.22.1: typecheck aprovado, 81 arquivos/437 testes aprovados (16 da integração GitHub), build de produção aprovado e ESLint dos dois arquivos TypeScript alterados aprovado. A tentativa anterior de build com node_modules vinculado fora do checkout falhou pela restrição de raiz do Turbopack; a instalação local resolveu. Nenhum ajuste de configuração de produção foi necessário. Não foram executados despachos a agentes, inferências para certificar qualidade factual ou mensagens a clientes.
