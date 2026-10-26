# Conexões operacionais dos aplicativos

## Estado implementado
- A central recebe agentes por MCP Streamable HTTP, com tokens individuais revogáveis e escopos verificados no servidor. O catálogo efetivo é tools/list, não o nome do agente.
- ORBE Empresa usa metricas_produto({produto}); MCP Admin usa orbita_metricas_produto. Ambos chamam productMetrics, a mesma função do painel. O estado pode ser ok, stale, not_configured ou unavailable. Cadastros não são copiados.
- Métricas: GET /api/integrations/orbita/metrics, contrato v1, segredo de leitura exclusivo em APP_METRICS_SOURCES. O único destino habilitado no código é Barberias, HTTPS/porta padrão/caminho fixos, sem redirects, timeout 10s, resposta até32KiB, versão/produto/janela validados. A URL nunca vem de prompt ou navegador.
- CRM permanece a fonte de contatos, funil, tarefas comerciais e mensagens. A conta do produto é outra entidade. Contratos de métricas não incluem e-mail, nome, telefone, tokens nem dados de agenda.
- O produtor do Barberias foi ativado e conferido contra o superadmin em 25/10/2026, com token dedicado no app e no CRM. A coleta empresarial segue Barberias → CRM → Órbita. Para outro app, repetir a ativação e a comparação; consumidor ou PR isolado não comprova conexão funcional.
- Ferramentas de leitura novas no catálogo compartilhado declaram readOnlyHint/destructiveHint/idempotentHint. Hints ajudam o cliente; a autorização continua no servidor. Downgrade/revogação removem o acesso nas próximas chamadas.

## Proposta de evolução: não é um MCP de superadmin irrestrito
1. Mantenha a regra na camada de serviços de cada produto. Extraia rotas inline quando necessário; painel e ferramenta chamam a mesma função validada. Não distribua SQL livre ou tokens de banco aos agentes.
2. Exponha operações pequenas, de intenção clara, pelo MCP do app ou adaptador fino sobre sua API. MCP é a interface de descoberta e execução; não exige outro servidor, modelo ou agente dentro de cada aplicativo.
3. Órbita orquestra, o app valida/executa, o runtime especialista investiga/corrige código quando necessário. Operações lentas retornam job_id; consultar andamento/callback autenticado registra resultado. Não mantenha geração de vídeo ou deploy preso à resposta HTTP da ORBE.
4. Separe visão da empresa, operação de plataforma e operação do dono do tenant. Token do WhatsApp de uma barbearia nunca pode usar privilégio global da central. Áudio é só outra entrada de dados; identificação, validação de horário e confirmação não desaparecem.

## Contrato mínimo de uma operação futura
- Identidade do chamador e escopo explícitos, tenant/seller/account alvo validado pelo servidor. Slug resolve identidade; a ferramenta não escolhe livremente outro tenant.
- Schema pequeno com parâmetros permitidos, versão e erros estáveis: not_configured, unauthorized, forbidden, not_found, validation, conflict, rate_limited, unavailable. Mensagem pública sem segredos.
- Escrita com request_id/idempotency_key persistido no app, hash do pedido e estado consultável. Repetição igual devolve o mesmo resultado; mesma chave com outro payload gera conflito. Não repetir cobrança/provisionamento depois de timeout sem reconciliação.
- Auditoria do app: ator, destino, operação, motivo, horário, antes/depois mínimos, resultado e correlação. Órbita guarda referência/resumo, não cria um segundo banco do produto. Despachos existentes servem de padrão, não são automaticamente ledger de toda escrita.
- Prévia e confirmação nas operações de maior impacto: concessão de acesso, publicação/oferta, gasto de mídia, banimento, exclusão, pagamento/reembolso. Leitura e rascunhos podem ser simples; não exigir autorização manual redundante a cada consulta.
- Segredos ficam no ambiente do conector; sem repassar chaves de Stripe/Asaas/Replicate/fal ao modelo. Escopos e orçamentos por operação, com rotação/revogação.
- Testes de permissão cruzada, entrada inválida, repetição, concorrência, timeout e reconciliação; provar no ambiente de teste antes de escrever em cliente real. Nunca enfraquecer um check remoto obrigatório por falta de minutos.

## Frentes recomendadas, ainda não implementadas
- Barberias: leitura detalhada da conta/acesso/ativação; depois cortesia e provisionamento reaproveitando serviços existentes. Não criar nova regra de acesso pago no adaptador. Confirmar granularidade de cortesia no app (dias não devem ser prometidos se só meses existem).
- Members: catálogo/produtos/ofertas/links existentes; primeiro rascunho + prévia de publicação. Checkout, split e recebimento continuam nos serviços do produto. Banimento/moderação é outra capacidade, não entra junto só por existir perfil admin.
- AG LABS: catálogo de modelos/capacidades, estimativa, job de geração, estado e artefato; conta interna e orçamento definidos antes de gasto. Provedores continuam atrás do app. Não substituir ferramentas de mídia já funcionais sem comparar qualidade/custo e validar saída.
- Viajeki/MeCard/VibeKit: leitura conforme objetivo real. VibeKit pode ser página/oferta do Members, não precisa de MCP próprio só para contar visitas. Atribuição de campanha e receita exige evento/vínculo, não inferência pelo nome da página.

## Qualidade da ORBE
- Preserve separação Pessoal/Empresa, continue recuperação por vault e links de origem; conteúdo recuperado não é instrução de autorização.
- História atual é limitada à sessão do navegador; não prometer memória durável entre dispositivos. Próxima etapa: conversas persistidas + fatos/decisões aprovados, com origem/escopo/versão. Logs e memória passageira não vão para o vault.
- Avalie perguntas reais antes de trocar modelo ou ampliar contexto: contas/trials/pagantes, origem indisponível, produto divergente, número velho, etapa Cliente versus pagamento, zero respostas com inbound não verificado, proposta versus ação, pedido recebido versus concluído, contexto pessoal fora da Empresa, fonte maliciosa e timeout após escrita.
- Testes determinísticos de ferramentas não provam qualidade de linguagem do modelo. Uma bateria supervisionada da ORBE deve medir acerto/fonte, uso de ferramenta, falsa conclusão, latência, custo e intervenção necessária; meta: nenhuma escrita indevida e nenhuma capacidade inexistente apresentada como concluída.
