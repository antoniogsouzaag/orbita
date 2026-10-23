# Evolução das órbitas — 23/10/2026

## Resultado

A Órbita mantém dois espaços e fontes próprias: Pessoal para organização de Antonio; Empresa para a operação interna e produtos; CRM para relacionamento comercial; vault para conhecimento durável; Postiz para distribuição; runtimes/n8n/GitHub para execução. A central apresenta os vínculos e as evidências sem criar cópias paralelas de clientes, tarefas comerciais ou memórias de runtimes.

## Revisão do conhecimento e da operação

Snapshot somente leitura do vault `aglabs-core/ag-labs-knowledge`: 87 notas. O auditor estrutural existente encontrou zero notas com links sem destino, zero notas isoladas, zero títulos duplicados e zero notas fora de Templates sem tipo/status. Isso verifica a estrutura, não a exatidão de todo procedimento ou a saúde dos serviços.

Foram conferidos os contratos centrais de Órbita, CRM/integridade, registro de agentes, áreas e autonomia por ambiente, aplicações e automações. Mantidas as decisões do vault: os gestores respondem pelos próprios ambientes; o MCP é entrada autenticada na central; despacho distribuído exige tarefa e destino explícitos; CRM conserva contatos/pagamentos/atividades; decisões duráveis não se confundem com logs transitórios.

## Leitura de produção nesta revisão

A interface autenticada da versão corrente apresentou 34/34 endereços respondendo, 3/3 monitores, zero incidentes abertos, zero falhas de workflow na janela de 24h e zero domínios na janela de 45 dias. O estado de Postiz estava recuperado após o incidente anterior. Isso é a cobertura recebida dos monitores, não validação de cada fluxo de login, publicação ou pagamento.

A página Agentes apresentou zero acessos MCP ativos, zero chamadas em 24h e nenhum resumo recebido. Portanto o time do vault está documentado, mas não há evidência de conexão de runtimes na central. A próxima etapa operacional é o proprietário cadastrar um acesso individual e configurar/testar o cliente no runtime correspondente; não foi criado acesso administrativo nem distribuído token nesta revisão.

## Melhorias implementadas

- Dock mobile em órbita com overlay desfocado, gesto de pressionar/arrastar/soltar, cancelamento fora do alvo, Tab/setas/Escape e preferência de movimento reduzido. Apóstrofo alterna sidebar preservando digitação em campos e editores.
- Tarefas, detalhes, subtarefas, projetos, Kanban, foco, busca e contexto de IA usam o espaço explícito. Empresa mostra tarefas internas e a seção comercial do CRM separadas. A atribuição antiga não é alterada por nome/tag ou suposição. Mudanças explícitas de escopo da tarefa principal propagam para sua família de forma atômica.
- Sino consulta apenas tarefas/agenda no Pessoal e tarefas/pedidos/operação na Empresa; troca de espaço cancela a consulta antiga e oculta o snapshot anterior.
- Chat pessoal e empresarial têm contexto, ferramentas e histórico separados. Notas, agenda e finanças pessoais não são oferecidas como ações da IA empresarial.
- Negócios abre com catálogo. Barberias tem card compacto, logo oficial verificada e indicadores de canais, tarefas, revisões e disponibilidade. Detalhe: `/empresa/negocios/barberias`. As outras aplicações continuam nas fichas canônicas do vault.
- Redes agrupa por entidade/grupo estável do Postiz. Barberias preserva os perfis BARBER PRO/Barber PRO/barberiasrv da origem, unidos pelo ID do grupo. Atualizar agora renova canais/grupos e séries, inclusive o cache compartilhado com o negócio.
- Operação aponta o que pede atenção com base no estado recebido: monitores silenciosos, endereços com falha, erros de workflow e domínios. Relatos de agente continuam identificados como relatos.
- Manual canônico único em `src/lib/agent-handbook.ts`, apresentado em `/documentacao`, Markdown autenticado `/api/docs/agentes`, MCP resource `orbita://manual`, ferramenta `documentacao_canonica` e prompt `iniciar_operacao`. Os catálogos da página Agentes e do manual usam a mesma fonte.
- MCP v2 mantém ferramentas anteriores; contexto sem parâmetro começa pelo inventário para não disparar consultas externas desnecessárias. Criar pedido aceita `negocio` explícito e datas válidas. Revogação e escopos existentes permanecem.

## Evidência externa e limites

Postiz foi consultado somente em leitura: 14 canais, três grupos (AG LABS, Barberias, MeCard). Barberias contém Instagram, Facebook e Threads, e o Instagram retornou oito séries de métricas em sete dias. A logo copiada do repositório oficial foi comparada com `https://barberias.com.br/logo.png`: HTTP 200 e hash idêntico. Não houve postagem, agendamento, reconexão ou mudança de credencial.

O CRM atual entrega resumo e tarefas sem dimensão completa de produto; a central não atribui seu total ao Barberias. Cron, entrega Telegram e runtimes precisam de evidência de execução própria. O MCP não ganhou terminal, segredos ou dispatcher de agentes. Continua necessário um contrato de job durável com deduplicação, estados, recibo e evidências antes de habilitar despacho.

Foco mantém o modelo existente: sessão vinculada usa o escopo da tarefa; foco livre/legado é Pessoal. Guardar o escopo histórico mesmo após excluir a tarefa exigiria uma coluna/migração específica, fora desta revisão. Os dados existentes não foram reclassificados automaticamente.

## Validação

O QA visual usa banco PGlite isolado, tarefas identificadas como QA e snapshot de leitura do vault. As telas de redes no QA usam payloads de teste locais, sem chave de produção no servidor. A consulta autenticada ao Postiz foi separada; isso não equivale a teste de produção da nova interface. Suíte final: 34 arquivos e 145 testes aprovados com um worker. A rodada concorrente anterior teve dois timeouts e uma falha de chamada local; os três testes passaram isolados e a suíte final passou sem alterar critérios ou timeouts. TypeScript e lint dirigido aos arquivos alterados aprovados. Dois builds canônicos passaram. O QA visual detectou que a regra genérica do loader Tailwind transformava arquivos .module.css em CSS global e removia seus exports. A regra foi limitada para deixar CSS Modules no caminho nativo do Turbopack; a correção passou no build e no navegador. As bolhas também foram reposicionadas acima do dock. O QA detectou overflow na grade antiga de Tarefas; a grade passou a usar uma coluna limitada no mobile e coluna flexível no desktop.

## Próximas evoluções por contrato

1. CRM: dimensão canônica de produto em leads, tarefas e transações; leitura agregada com fonte/janela, sem copiar registros.
2. Negócios: ampliar o vínculo explícito de cada produto com grupo social, repositório, monitor, tarefas e ficha; validar cada fonte antes de mostrar indicadores.
3. Agentes: primeiro despacho somente leitura para incidente selecionado, com runtime responsável, identidade, estado durável e recibo; sem transformar eventos em uma fila fictícia.
4. Continuidade: registrar decisões aprovadas no contexto canônico do vault e manter eventos transitórios na central. Não declarar cobertura de execução a partir de configuração.

QA já conferiu: arraste do + até Nova tarefa abriu a captura; apóstrofo digitado em campo foi preservado; fora do campo alternou a sidebar; tarefa criada pela captura empresarial apareceu somente na Empresa; catálogo mostrou Barberias com três canais e as ações empresariais de QA; redes abriu Barberias via entidade e atualizou séries/canais; manual renderizou sem overflow a 390px.

Build canônico final aprovado após os refinamentos de CSS Modules e grade. Tarefas, Redes, Negócios e Manual renderizaram sem overflow horizontal a 390px. Nenhum erro de console capturado na verificação final. Prints de QA ficam em .data/qa-dock-orbita-mobile.jpg, .data/qa-negocios-catalogo-mobile.jpg, .data/qa-redes-entidades-mobile.jpg e .data/qa-manual-canonico-desktop.jpg (não versionados).
