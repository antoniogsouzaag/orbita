# Classificação dos eventos operacionais

As ferramentas `status_ao_vivo` e `orbita_status_operacao` e o contexto operacional ao vivo compartilham a mesma classificação dos eventos retornados por `liveOps`:

- **Quedas de sites não resolvidas:** eventos `site_down` sem `resolvedAt`. São registros de queda, não uma verificação atual do endereço; disponibilidade atual depende do último resultado e da batida recente do monitor.
- **Falhas de workflow:** eventos `workflow_error`. A contagem das últimas 24 horas inclui resolvidos e não resolvidos; a contagem sem resolução inclui eventos antigos presentes na amostra. A ausência de resolução não prova que a falha ainda ocorra.
- **Outros alertas ou relatos de agentes não resolvidos:** eventos `warning` ou `critical` abertos que não são queda de site nem falha de workflow. Isso inclui alertas de domínio, de monitor e relatos de agentes; não implica que sejam incidentes de site.

As contagens são **da amostra**, não totais do banco: a consulta reúne até 80 eventos recentes dos últimos 14 dias e até 80 eventos não resolvidos de severidade aviso/crítica, de qualquer data, deduplicados por ID. Eventos antigos com severidade informativa podem não aparecer; mesmo uma contagem zero não prova a ausência de eventos fora da amostra. A lista de nomes no resumo mostra até dez por categoria, com até 160 caracteres por nome. Se o banco falhar, a consulta falha; a ausência de dados não é convertida em zero.

O painel de Operação usa os mesmos critérios para quedas e falhas; o gráfico histórico vem da agregação diária separada. Se essa agregação falhar, o painel indica histórico indisponível em vez de mostrar gráficos zerados. Notificações distinguem queda, falha de automação e outros alertas. A classificação não resolve, remove ou altera eventos e não inicia verificações ou workflows.
