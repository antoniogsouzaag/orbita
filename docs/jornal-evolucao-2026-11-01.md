# Jornal, MCP e qualidade operacional — revisão de 01/11/2026

## Cobertura

Leitura do projeto empresarial Jornal da Órbita e da tarefa “base design”, manual MCP, fontes locais do bom dia, ingestão, CRM, métricas, navegação e vault. Fichas canônicas consultadas: Jornada Comercial e Follow-up, Arquitetura de Suporte por E-mail e inventário operacional. Consulta autenticada de integrações e agregados comerciais em 01/11/2026; números transitórios ficam na página privada e nas notas do projeto, não neste relatório público.

O diagnóstico respondeu para banco, vault, CRM, n8n, monitores, agenda, Postiz e agregados dos seis produtos. Resumo diário, MCP de contexto e canais dos gestores distinguem configuração de execução; não houve envio de Telegram, e-mail, publicação social, despacho ou execução de workflow como teste.

## Lacunas confirmadas e encaminhamento

| Frente | Evidência/limite | Evolução com critério de conclusão |
| --- | --- | --- |
| Conteúdo das rotinas | Resumos operacionais existiam sem editoria, fonte estruturada ou recibo idempotente | Nova entrada do Jornal com origem autenticada, UUID, data, fontes e replay concorrente testado; conectar cada produtor na rotina de origem e conferir recibo real |
| Bom dia crescente | Títulos limitados individualmente ainda permitiam crescimento do conjunto | Orçamento de mensagem único, exceções operacionais primeiro e link datado; teste de limite sem cortar HTML |
| Saúde de caixa vs e-mails | CRM mede registros de envio; triagem empresarial e suporte são operações distintas | Declaração de cobertura por fonte. Monitor de atraso exige primeiro confirmar agenda/expectativa na origem |
| Próxima ação comercial | Consulta atual retorna oportunidades sem tarefa e testes encerrados; são conjuntos potencialmente sobrepostos | Revisar histórico e critério de qualificação no CRM; decidir o próximo passo necessário, sem gerar cadência ou tarefas em massa por contagem |
| Classificação por produto | O CRM informa agrupamentos legados sem slug válido fora do detalhamento | Aviso visível preservando totais globais; reconciliar cada origem/identidade antes de reclassificar registros reais |
| Resultado dos e-mails | Entrega técnica não demonstra leitura humana, resposta ou compra | Separar transacional, automação, campanha e suporte; acompanhar entrega, falha, resposta e opt-out sem tratar abertura por pixel como pessoa |
| Usuários e vendas do dia | Contratos existentes oferecem janelas mensais/30 dias e snapshots, não uma série diária comum | Adicionar agregados diários na origem, por negócio, com fuso e estornos; depois criar edição fixada e coortes consistentes |
| Lead e material gratuito | O vault distingue prospecção, intenção e cliente; inventário do classificador de comentários indica divergência a conferir | Verificar fluxo vigente antes de alterar classificação; um pedido de material não basta para promover contato a Lead |
| Alertas de suporte | Uma ficha descreve WhatsApp; inventário descreve Telegram e Órbita | Conferir nós, publicações e recibos reais do fluxo antes de corrigir a descrição do canal |
| Facilidade de uso do MCP | Manual único é extenso; algumas exceções eram indistinguíveis ou poderiam expor mensagem de provedor | Entrada curta e guia temático, scopes/annotations consistentes, recibos estruturados, erro desconhecido sanitizado e erros conhecidos do vault orientando o próximo passo |
| Leitura de conteúdo recebido | Artigos podem incluir HTML, links ativos e imagens de rastreamento | Markdown no servidor sem HTML/imagens remotas; URLs executáveis e credenciais recusadas, mantendo a capa local e citações verificáveis |

## Operação incremental proposta

1. **Receber:** produtores mantêm sua rotina atual e enviam síntese apropriada; a pesquisa de IA e a triagem precisam informar fontes/cobertura e guardar o recibo. Credencial conectada não comprova rotina configurada.
2. **Ler:** o bom dia leva ao Jornal. A edição de hoje combina relatos recebidos e consultas identificadas; o arquivo contém matérias, sem inventar indicadores de um dia passado.
3. **Decidir:** sinais comerciais levam ao CRM; pendências internas ficam na Órbita. Não duplicar clientes ou filas. Ideias e impactos entram como hipóteses, sem se tornarem automaticamente política, tarefa ou campanha.
4. **Executar e verificar:** usar o responsável e o canal já autorizados, com recibo e readback. Configuração, recebimento, início e efeito comprovado continuam distintos.
5. **Revisar:** em uma rodada acordada, escolher poucas melhorias com baseline, indicador, critério de aceite e fonte. Medir latência/erros, conferir cobertura editorial e reconciliar pendências já resolvidas. Nenhuma agenda nova foi criada por este relatório.

## Limites da primeira versão

O Jornal não configura a rotina do Claude nem a do OpenClaw. Não há monitor de execução desses produtores, snapshot financeiro diário, caixa de e-mail replicada, consulta pública, campanha automática ou retenção ampliada. Matérias usam a retenção operacional existente, descrita em [jornal-orbita.md](./jornal-orbita.md). Edição/retirada de matéria, busca histórica e políticas de arquivo são evoluções separadas.

A validação cobre código, escopos, formato, replay concorrente, segurança do conteúdo e publicação. A primeira remessa real de cada produtor e o próximo bom dia agendado precisam de seu próprio recibo; não foram simulados como se tivessem acontecido.
