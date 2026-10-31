# Substituições de endereços de monitoramento — 29/10/2026

Antonio já alterou os domínios e autorizou atualizar monitores, vault e backlinks. A ingestão mantém estado por URL: receber o novo destino não removia o estado do antigo nem encerrava seu incidente. A coleta das 20h30 trouxe as novas URLs, mas a central passou de 36 para 38 registros e manteve o incidente de DNS do Pack Canva.

`monitor-target-replacements.ts` registra somente as duas substituições autorizadas, na fonte `n8n-vps03-ping`: cortes-virais.pages.dev → cortes.lojalabs.com.br e pack-canva.pages.dev → pack.lojalabs.com.br. Não há inferência por nome, indisponibilidade ou ausência no vault.

A reconciliação exige recibo persistido do novo destino na mesma fonte. Não retira o antigo se ele ainda consta da mesma rodada ou teve checagem posterior. Na ingestão usa o recibo exato da rodada. Na leitura operacional também reconcilia recibos anteriores ao deploy, com até 40 minutos, sem alterar data da checagem nem heartbeat.

Uma transação arquiva integralmente o estado anterior em `site_target_replaced`, retira apenas esse estado derivado da disponibilidade atual e encerra o incidente antigo com motivo `target_replaced` e URL substituta. Não registra `site_up` para a URL antiga. Falhas do novo destino continuam visíveis e seguem a regra de duas falhas consecutivas. Repetição não duplica o arquivamento. Outros monitores, fontes, URLs e incidentes são preservados.

Testes cobrem histórico, idempotência, fontes distintas, URLs ainda recebidas, recibo inexistente/futuro e falha real no novo endereço. Não exige migration nem alteração de credencial ou workflow.

## Apresentação do AG LABS App — 30/10/2026

A tarefa Empresa `1c0cf997-5e0e-49ca-b1a5-e90999830df0` autoriza substituir a antiga LP por `https://aglabs.app.br/sobre` nos monitores e nas referências do vault. A lista explícita agora inclui `https://lp.aglabs.app.br/` → `https://aglabs.app.br/sobre`, com as mesmas proteções de fonte, recibo persistido, rodada e histórico. A página raiz do app continua sendo um alvo independente; não se infere equivalência entre URLs do mesmo domínio.

A matriz de testes de banco executa os cenários de histórico, idempotência, fonte incorreta, ausência de recibo, presença simultânea dos dois destinos, falha real e recibo anterior ao deploy também para essa substituição. O seed demonstrativo aponta para `/sobre`.
