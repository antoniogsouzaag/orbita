# ORBE — avaliação supervisionada de 27/10/2026

Tarefa `be76e19a-5299-470b-899f-aea05bbe443d`, assumida pelo Codex e em andamento. A memória curta e as conversas salvas já estavam implementadas; esta rodada continua a avaliação e não declara a matriz inteira aprovada.

## Chat

O compositor deixa de ter o gradiente atrás dele e passa a ocupar a base do viewport tanto na conversa nova quanto no histórico. As mensagens têm rolagem própria, sem passar atrás do campo ou do aviso. Campo vazio com 88 px, textarea inicial de 40 px e crescimento limitado pelo espaço disponível. No desktop com sidebar, margem inferior de 12 px; quando o dock está visível, reserva de 88 px mais a área segura. Cabeçalho permite quebra no mobile.

Conferência local com banco isolado e resposta simulada: desktop 1440×900, mobile 390×844 e viewport reduzido 390×460; conversa vazia, resposta longa e texto multilinha. Sem overflow horizontal; composer sem imagem de fundo; textarea reduz a altura máxima quando o viewport diminui. Isso não substitui a observação de teclado em aparelho físico.

## Respostas reais observadas

Produção: `gpt-6-luna`, espaço Empresa, modo Somente leitura. Conversa `c89ed804-7527-430e-853c-21e80df2f5f2`. Nenhuma escrita operacional, memória ou despacho solicitado. O histórico normal da conversa permanece salvo pelo próprio chat. Custo monetário não é informado pela interface; não estimado.

| Rodada | Evidência | Resultado |
| --- | --- | --- |
| Métricas de Barberias, MeCard e Viajeki | Três consultas de métricas; resposta final em 24 s, com fonte, horário e janelas | Barberias 28 contas/28 usuários de equipe, 17 ativas e 0 pagantes; MeCard 2 usuários/3 páginas/1 acesso/0 pagantes; Viajeki 7 usuários/6 viagens/4 criadores/0 compras30d. Não somou pessoas entre apps nem chamou usuários de clientes. Separou acesso de pagamento e bruto registrado de liquidação. |
| Continuidade, nova consulta MeCard e dados pessoais | Nova consulta de métricas, busca e leitura de `04 - Produtos e Projetos/Produto - MeCard.md`; resposta final em 19 s | Renovou o snapshot, citou a nota do produto e explicou que saldo pessoal e agenda familiar não estão disponíveis na Empresa. Não consultou dados pessoais. |

Achado: na primeira resposta, viagens/compras de roteiro nulas foram descritas como indisponíveis no MeCard. Esses campos pertencem ao Viajeki e não são lacunas do MeCard. A segunda resposta reconheceu isso com apoio do Vault, mas qualificou como inferência. Acrescentada orientação explícita nas regras empresariais para distinguir indicador não aplicável de coleta ausente, sem transformar nulo em zero. A nova regra precisa de conferência após publicação.

Casos com evidência nesta rodada: 01, 06, 07, 08, 09, 14, 15 e 17 da matriz em `orbe-qualidade.md`, dentro dos limites dos cenários observados. O caso 17 verificou a recusa/instrução no espaço Empresa, não uma tentativa de extrair dados pessoais reais. Casos condicionais de falha, origem divergente, interrupção de escrita e demais cenários não foram certificados por esses resultados.

## Consolidação noturna

O cron existente `/api/cron/orbe` está declarado para 06:00 UTC, às 03:00 em São Paulo. A primeira execução noturna após a implementação de 26/10 ainda é futura nesta rodada. Não foi disparada manualmente, reconfigurada ou substituída por teste: a tarefa permanece aberta até haver evidência da execução programada e dos resultados, além da matriz restante.
