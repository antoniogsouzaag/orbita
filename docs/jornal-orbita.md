# Jornal da Órbita — primeira versão

## Leitura e bom dia

Página privada `/jornal`, no espaço Empresa; sessão do proprietário obrigatória, sem link público ou novo compartilhamento. Edições usam data de São Paulo, com navegação dos últimos 30 dias. A edição de hoje reúne pauta pessoal/empresarial, operação, matérias e consultas comerciais; dias anteriores mostram somente o arquivo editorial. Não há reconstrução de receita ou usuários históricos por inferência.

O bom dia já agendado passa a enviar um texto único com orçamento de 1900 caracteres de HTML, priorizando exceções operacionais e mantendo o link datado para a edição. Mesmo sem trabalho devido há um convite curto para o Jornal. Não foi criado outro agendador nem disparado Telegram para testar a mudança.

As matérias seguem a retenção operacional existente de `ops_events`: 30 dias após recebimento, inclusive a duração do recibo idempotente. Não há nova tabela, migração, retenção permanente ou política de conservação de e-mails. A capa é decorativa; nenhuma imagem representa uma notícia real.

## Entrada MCP para as rotinas existentes

Redescobrir `tools/list` após a atualização. O nome autenticado identifica o remetente; o payload não escolhe autor, identidade, privilégio ou destino.

| Interface | Permissão | Efeito |
| --- | --- | --- |
| `documentacao({secao:"inicio"})` | qualquer token válido | Roteiro curto, preservando o manual integral sem argumentos ou com `secao:"completo"` |
| `documentacao({secao:"jornal"})` / `orbita://jornal/guia` | qualquer token válido | Contrato de recebimento, sem dados privados |
| `enviar_materia_jornal` | eventos ou admin | Registra matéria interna e devolve recibo, sem mensagens ou execução |
| `consultar_jornal` | status ou admin | Resumos paginados, autoria, fontes e links; sem dados pessoais ou agregados do CRM |
| `preparar_materia_jornal` | prompt, sem escrita | Roteiro de preparação; não envia automaticamente |
| ORBE Empresa → `consultar_jornal` | sessão; inclusive somente leitura | Consulta o mesmo serviço, sem gerar ferramenta MCP duplicada |

Exemplo de **formato**, não de notícia real e não destinado a produção:

```json
{
  "registro_id": "11111111-1111-4111-8111-111111111111",
  "data": "2026-11-01",
  "secao": "ia",
  "titulo": "Título factual da pesquisa",
  "resumo": "Síntese fiel do que a fonte anunciou e por que merece atenção.",
  "conteudo": "## O que aconteceu\nSíntese atribuída à fonte.\n\n## Impacto possível\nHipótese para discutir, não uma decisão aprovada.",
  "destaque": false,
  "pontos": ["Consequência prática ou pergunta a investigar"],
  "fontes": [{ "titulo": "Anúncio original", "url": "https://example.com/anuncio" }]
}
```

Cada rotina deve gerar **outro UUID por matéria**, persistindo UUID e payload antes de enviar. Em retry/timeout, reutilizar os mesmos valores; não gerar novo UUID. A chave primária determinística combina identidade do token e UUID, protegendo inserções concorrentes entre instâncias. Outro conteúdo com o mesmo UUID é recusado. Retorno: `{id,registro_id,data,repetido,href}`. A data da edição é explícita e validada (hoje ou 30 dias anteriores); o horário de recebimento é do servidor. Correções usam outro UUID com referência à matéria anterior; não há edição ou retirada de matéria nesta versão.

Seções: `ia`, `emails`, `negocios`, `operacao`, `evolucao`. Título até 180 caracteres, resumo até 500, Markdown até 8000, até cinco pontos de 240 caracteres e oito fontes HTTPS. IA exige ao menos uma fonte; fonte não comprova conferência independente do relato. URLs com credenciais ou protocolos executáveis são recusadas. Sem fetch de imagens ou páginas fornecidas no payload.

**Claude / pesquisa de IA:** ao terminar a rotina já autorizada, preparar síntese, links primários, limites da pesquisa e implicações como hipóteses; enviar na seção `ia`. O contrato não configura a tarefa do Claude nem comprova sua execução.

**OpenClaw / triagem da AG LABS:** após a triagem já autorizada, enviar na seção `emails` a cobertura, período, volume observado, o que requer ação, limitações e referência à tarefa correspondente quando existir. Não copiar corpo de e-mail, anexos, remetentes pessoais, segredos ou listas de contatos. A rotina continua no runtime de origem; enviar a matéria não limpa, responde, arquiva ou cancela e-mails.

`registrar_evento(tipo:"resumo")` permanece compatível. Relatos antigos aparecem como **resumo operacional legado**; não são classificados automaticamente como notícia de IA ou triagem. Matérias novas não ocupam a amostra de incidentes ou os gráficos de Operação.

## Sinais comerciais e limites

- CRM é fonte de funil, pagamentos/receita registrados e próximos passos. Contato novo em sete dias não é lead qualificado. Compras, contas e pessoas são unidades diferentes.
- E-mails usam a janela móvel de um dia devolvida por `crm_funil_emails`, com início da janela e horário da consulta. Envios do CRM não medem toda a caixa de entrada nem equivalem à triagem empresarial ou à cobertura do suporte.
- Usuários novos usam o **mês corrente de São Paulo**, por aplicativo, pelo contrato `audience` já validado. Coleta antiga, ausente ou incompatível aparece como `—`, nunca como zero. Não somar pessoas entre produtos nem anunciar “novos hoje” a partir do contador mensal.
- “Sem próximo passo” e “tarefa vencida” orientam revisão no CRM; não ativam follow-up, contato ou campanhas. Uma oportunidade pode gerar mais de um sinal.
- Painéis remotos são carregados em Suspense, separadamente da leitura editorial. Fontes conservam horário, janela e indisponibilidade. Não há refresh agressivo nem chamada a modelo para montar a edição.

## Revisão do MCP

Manual, página, ferramenta e resource continuam usando uma fonte única, versão 2026-11-01.1. A entrada curta evita exigir a leitura do manual inteiro em toda consulta, sem remover o contrato integral. O Jornal tem dois tools, um guia e um prompt; ferramentas da ORBE não são duplicadas como `orbita_consultar_jornal`.

Anotações de leitura/escrita do vault e registro de eventos foram alinhadas. Exceções desconhecidas no executor MCP não expõem corpo de provedor, credenciais ou payloads privados. Falhas conhecidas e sanitizadas do adaptador do vault e conflitos de SHA são preservados no executor administrativo, para que o agente diferencie configuração, concorrência e falha incerta. Nenhum escopo, credencial, consentimento OAuth ou gate do Hermes foi ampliado.

## Evoluções propostas, sem execução automática

1. Contrato de cobertura da pesquisa/triagem: remetente, período, itens observados e limites. Só alertar por atraso quando houver agenda esperada confirmada na origem; ausência de matéria não basta para afirmar falha.
2. Indicadores diários na origem: novos cadastros, ativação e pagamentos conciliados por dia/negócio, com fuso, IDs e regras de estorno. Separar fotografia atual, fluxo do dia e coorte de conversão.
3. Leitura do caminho de aquisição: origem/UTM/palavra-chave → contato mínimo → intenção comercial → ativação → pagamento. Pedido de material gratuito não vira lead; a divergência documental do classificador de comentários merece conferência do fluxo vigente.
4. E-mails: acompanhar fila, entrega, falha, resposta e opt-out por produto/categoria, preservando o ledger e a identidade original. Não usar abertura por pixel como prova de leitura nem “sem resposta” como autorização de novo contato.
5. Edições fixadas: snapshot diário auditável dos indicadores, separado das consultas ao vivo; revisão/retirada de matérias e busca do arquivo. Exigem desenho próprio antes de prometer histórico imutável ou retenção maior.
6. Revisão periódica de qualidade: comparar relatórios com fontes, medir latência, rever pendências já resolvidas e registrar somente decisões duráveis no vault. Cadência e execução de agentes permanecem nos runtimes existentes; esta entrega não cria automação recorrente ou amplia autonomia.

As fichas consultadas distinguem suporte Maia, triagem da caixa empresarial e CRM. A nota de suporte por e-mail ainda descreve alerta de workflow por WhatsApp, enquanto o inventário descreve Telegram e Órbita; confirmar o fluxo real antes de atualizar a afirmação de canal. Não tomar uma nota antiga como prova de entrega.
