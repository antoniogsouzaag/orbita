# Refinamentos da central — 24/10/2026

Base atualizada em origin/main 78059b2, preservando os refinamentos locais. Tom já possui adaptador OpenClaw e prova registrada em docs/openclaw-dispatch.md; não foi repetido despacho em produção nesta rodada.

## Interface

- Shift+Tab alterna espaços fora de campos e modais. Tarefas seguem o espaço ativo, sem seletor duplicado; consolidação CRM/internas permanece futura.
- Agentes reúne diretoria, pedidos manuais em modais, históricos e atividade agrupada por agente. Integrações concentra diagnóstico e /integracoes/mcp configura acessos.
- Operação remove contexto documental duplicado. Revisão mostra diário recolhido e usa o dia atual. Academia apresenta posições inicial/final juntas. Redes soma últimos pontos de seguidores/inscritos com cobertura e datas, sem representar pessoas únicas.
- Login usa o EarthBlaze fornecido pelo proprietário, sem controle pelo mouse, com movimento suave e preferência por movimento reduzido.

## IA, administradores e documentação

A IA usa as ferramentas disponíveis no espaço atual; administradores MCP reutilizam o catálogo da IA sem filtro de espaço e também têm ferramentas de contexto/status/eventos conforme o servidor. Não foi ampliada permissão nesta rodada. Ambos podem editar notas canônicas com controle de versão; o manual do sistema é código em src/lib/agent-handbook.ts e precisa acompanhar a funcionalidade no repositório.

Corrigida instrução contraditória no prompt da IA que dizia que o vault era somente leitura apesar de salvar_nota_vault existir. A escrita continua condicionada à ferramenta disponível, SHA atual e solicitação autorizada. Não foi efetuada escrita no vault externo.

Cópias sincronizadas do vault nos ambientes continuam úteis para leitura e manutenção local. A Órbita não é uma passagem obrigatória e não sincroniza automaticamente esses checkouts. Sempre conferir commit e alterações locais antes de editar.

Nome da IA (Mia ou Orbe), papel definitivo, modelo conversacional e novos casos de JEV permanecem em discussão. Nenhuma automação nova foi habilitada.

## Próxima etapa implementada: acompanhamento dos diretores

Tom e Oracle agora compartilham uma visão de pedidos, com filtros por agente e por atenção/em aberto/concluídos. Datas, evidências e identificadores ficam nos detalhes. Os históricos dos cards são ocultados nesta composição para evitar repetição; envios e consultas atualizam a mesma visão.

A consolidação é de leitura. OpenClaw continua na tabela dispatches; Hermes mantém settings e seu contrato HMAC. Recebido/agendado não vira concluído. Pedidos incertos, falhas, recusas, interrupções, vencidos no Oracle e silêncio informado pelo OpenClaw ficam em Atenção. A lista informa que contagens são da amostra de até 30 registros por origem. Não há reenvio, sondagem ou execução automática.

O atalho Shift+Tab também passa a ignorar composição de texto (IME), com cobertura de campos, modais e atalhos do navegador.

## Sequência restante

1. Revisar visualmente desktop/mobile e fechar build desta rodada; a execução anterior teve lentidão de filesystem e falha de download das fontes Google.
2. Publicar a rodada com os checks registrados; validação de Preview/produção deve ser registrada separadamente da local.
3. Definir regras da futura visão conjunta CRM/internas (responsável, negócio, prazo, origem e ações na fonte), antes de consolidar dados comerciais com a operação interna.
4. Avaliar migração do histórico Hermes para dispatches em uma rodada própria, com preservação dos registros e do receptor já validado.
5. Só depois definir nome e papel da IA e casos de JEV; manter acionamento de diretores manual até decisão explícita.
