# Revisão Órbita e ecossistema — 23/10/2026

## Alterações desta rodada

- Navegação: removida legenda da sidebar; tema claro/escuro ao lado do nome; manual no menu de conta. Escape respeita diálogos e outras camadas abertas. Bolhas do primeiro arco mais espaçadas.
- GitHub: uma atualização para calendário e pendências; cartões de contagem dentro do quadro de atividade à direita em telas largas e abaixo em telas menores. Contagens continuam derivadas da consulta, sem fixar 7/5/50.
- Diário: registro diário existente preservado, agora com data explícita, confirmação de salvamento, Enter/blur para reflexão e abertura de dias anteriores na revisão. Datas futuras ou impossíveis recusadas. Revisão preserva centavos e usa data local na criação de hábitos; reflexões do período não são truncadas antes de filtrar.
- Barberias: removidos catálogo de páginas, título duplicado e etapas ilustrativas de aquisição. Visão concentra dados atuais já conectados: ações, vencimentos, PRs, monitores e canais. Leads, ativação, clientes e receita por produto continuam sem uma fonte verificada e não foram inventados.
- Academia: sessão guiada por exercício/série, carga editável, descanso com relógio, progresso, demonstração esquemática local ou vídeo escolhido pelo instrutor, gravação explícita ao completar séries. Fechar descarta a sessão não salva; modelos não contam como treino.
- Integrações: Hermes recebe espaço de operação real; diagnóstico existente recolhido. Adaptador dedicado HMAC V2 e histórico persistente preparados. Ver `hermes-dispatch.md` para contrato, estados e limites.

## Vault consultado

Cópia local `E:/AGENTS/AGLABS/ag-labs-knowledge`: 86 notas Markdown, todas com type/status, nenhum wikilink sem arquivo-alvo na checagem estrutural (nome de nota, sem verificar âncoras). Esta cópia não comprova sincronização com o remoto. Leitura das fichas de Barberias, Oracle, registros de aplicações, diretrizes comerciais e automações. Nenhuma política empresarial foi reescrita e não houve escrita no vault externo.

Foi removida uma repetição literal da referência de ativação do Oracle na documentação local da Órbita.

## Lacunas prioritárias

1. **Dados por produto:** estabelecer contrato canônico no CRM com id explícito `barberias`, período, denominador, data de consulta e origem. Adicionar fonte de ativação/assinatura do app; receita deve vir de ledger positivo reconciliado. Não fazer associação por nomes nem usar teste iniciado como ativação. Bloqueio atual: o schema confirmado de resumo não tem parâmetro de produto; descoberta ao vivo relatada pelo Oracle recusou a credencial.
2. **Hermes:** serviço dedicado e rota pública ainda não ativados segundo evidência recebida. Segredo dedicado precisa de transferência segura. Resultado 202 não comprova conclusão. Caixa interna não é notificação proativa. Após ativação, verificar 401 → 202 → 200 antes de afirmar funcionamento.
3. **Lembretes proativos:** definir canal, janela, silêncio quando não há mudança e confirmação de entrega; persistir prazo e tentativa antes de habilitar um agendador. Não introduzido nesta rodada.
4. **Academia:** substituir progressivamente esquemas por acervo de vídeos/fotos selecionados por exercício e orientação profissional; manter variantes e equipamentos explícitos. Próxima evolução: recuperar sessão interrompida e acompanhar progressão de cargas.
5. **Hábitos saudáveis:** adiar recomendações individuais até definir objetivo e consentimento. Caminho recomendado: sugestões opcionais e curtas a partir de frequência registrada, sem diagnóstico, prescrição clínica ou punição por sequência perdida. Antonio pediu avaliar depois; não foi habilitado envio ou recomendação automática.
6. **Governança do vault:** registrar evidência e última revisão separadamente de status ativo/configurado; manter cron/job, credencial válida, execução e entrega como fatos distintos. Revisão estrutural não certifica políticas, preços ou saúde dos serviços.

## Limite de publicação

Alterações locais sem deploy ou merge da Órbita. A ativação externa foi autorizada posteriormente e executada pelo Hermes, como registrado abaixo. Transferência ao secret store da Órbita permanece pendente.

## Evidência local de QA

- TypeScript e lint dos módulos verificados aprovados. Dezessete testes focados aprovados. Suíte geral: 144/150 inicialmente; nova execução isolada dos quatro arquivos afetados por falhas resultou em 13/14, restando timeout no streaming OpenAI. Não se declara suíte integral verde.
- Navegador em banco separado `.data/qa-revisao-out23`, sem credenciais externas: Enter salvou reflexão; o texto reapareceu na Revisão; Escape fechou o modal e manteve a sidebar; sessão de oito séries percorreu descanso/avanço, salvou e reapareceu após reload; modal conferido em 390×844. GitHub apresenta um único botão de atualização e distingue falta de conexão de zero; Hermes permanece desabilitado sem configuração.
- Build inicial parou na compilação; QA revelou falha de download de fontes Google por restrição de rede. Servidor de QA utiliza diretório de build independente via ORBITA_DIST_DIR para não disputar artefatos.
- Ativação externa posterior autorizada e executada pelo Hermes: ver `hermes-dispatch.md`. Transferência ao secret store Vercel permanece pendente por falta de autenticação no executor.

Build de produção permanece inconclusivo: tentativa com rede também não concluiu a compilação e foi interrompida. Não se declara pronto para deploy. POST público sem assinatura conferido pelo Codex retornou 401; provas assinadas são do executor Hermes.

TypeScript final aprovado após todos os ajustes. Servidores e builds de QA foram encerrados; os dados de QA permanecem somente no banco separado e ignorado pelo Git. Nenhum segredo real foi carregado no QA.

## Verificação antes do merge (Claude Code, 23/10/2026)

- `next build` concluído com sucesso em diretório separado; TypeScript aprovado.
- Lint sem erros nos arquivos desta rodada; `.next-*/**` passou a ser ignorado pelo ESLint para não varrer builds de QA. Restam 11 erros antigos em arquivos não tocados.
- Suíte: 149/150; o teste de streaming OpenAI só estoura o tempo sob carga e passa isolado, igual ao main.
- Corrigida acentuação corrompida em `src/components/shell/interactions.ts`.
- Pendente fora do código: criar `HERMES_WEBHOOK_URL`, `HERMES_WEBHOOK_SECRET` e `HERMES_DISPATCH_ENABLED` na Vercel. Sem elas o despacho segue desabilitado.
