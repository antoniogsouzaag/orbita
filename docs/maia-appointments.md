# Agendamentos Maia — candidato privado, desligado

## Limites de publicação

Este código **não ativa atendimento**. O endpoint dedicado POST `/api/appointments/maia` exige `MAIA_APPOINTMENTS_ENABLED=true` e `MAIA_APPOINTMENTS_TOKEN` exclusivo de pelo menos 32 caracteres. Este release exige também `MAIA_APPOINTMENTS_PILOT_CONTACT_ID` com um único UUID do contato canônico do owner, verificado pelo operador. Sem configuração válida recusa com 503 antes do serviço/banco; `contact_id` diferente recusa com 403 antes do banco, mesmo com token válido. Não há wildcard, lista, modo público nem bypass de piloto. Ausência/booleanos textuais não habilitam o gate: somente o literal `true`. Um rollout futuro para clientes exige alteração explícita e nova aprovação. O token não amplia o serviço público nem substitui a sessão da API owner. Não reutilizar token administrativo. Nenhuma ferramenta MCP foi adicionada à Maia. O gateway confiável resolve `contact_id` pelo CRM autenticado; nunca aceitar identidade do cliente diretamente do modelo. A Órbita guarda somente o identificador canônico e nome opcional, sem duplicar o CRM.

Aplicar a migração additive `0012_maia_appointments` somente após revisão independente e autorização do piloto. Não aplicar em produção como parte dos testes. Implantação, instalação/configuração do plugin, migração remota e habilitação são aceitações separadas.

## Operação

- Transport v1 compatível com o contrato privado. Disponibilidade retorna apenas dois intervalos, sem títulos nem dados de terceiros. Listagem só do contato autenticado, no máximo 20 registros a partir dos 14 dias anteriores.
- Brasília (UTC−03 nas datas operacionais): seg–sex, inícios 08/09/10/13/14/15/16/17h, 45 minutos e célula bloqueada de uma hora; mínimo 2h, horizonte 14 dias.
- Toda decisão de disponibilidade, reserva, remarcação ou aprovação revalida assinaturas ICS habilitadas. Assinaturas ausentes de atualização, com erro ou com idade >=30min são sincronizadas **na própria transação e sob o mesmo lock**. Não depende de abrir `/agenda`. Falha de fetch/parsing/inserção causa rollback e recusa `calendar_unavailable`. Calendários desabilitados não bloqueiam, conforme a agenda existente. Datas ICS de dia inteiro mantêm armazenamento UTC com fim exclusivo e são interpretadas como datas civis de Brasília na disponibilidade.
- Remoto e presencial criam imediatamente um `events` local existente e um agendamento `confirmed`. O intervalo do evento é 45min; a reserva protege também os 15min seguintes. Preferência remota é registrada, mas Antonio prepara/envia o link manualmente antes. Nenhuma plataforma é prometida ou link gerado.
- Presencial exige endereço; se desconhecido, o consumidor deve pedir esclarecimento antes de reservar. Novo presencial é **confirmado na agenda e reservado**, com buffers padrão de zero (sem inventar deslocamento). Isso não afirma confirmação externa: Antonio confirma os detalhes pessoalmente com o cliente e cancela o agendamento se não confirmar. Nenhuma tarefa separada de confirmação, mensagem externa ou aviso de aprovação pendente é criado. `/agenda/agendamentos` mostra identidade CRM, endereço, preferência, estado, versão e histórico.
- Remarcação preserva contato/modo/assunto/endereço/preferência e mantém o horário antigo em caso de conflito. Presencial confirmado continua confirmado e move o mesmo evento vinculado; a célula antiga é liberada e a nova protegida. A remarcação mantém os buffers padrão zero. Pendência legada continua pendente até revisão explícita por ID, sem conversão automática. Cancelamento/recusa liberam somente o evento vinculado. Toda mudança tem histórico imutável por versão.
- Revisão administrativa usa sessão normal com versão atual e Origin exatamente igual à origem canônica `APP_URL` (variável existente; sem ela usa a origem da Request); o token Maia não concede aprovação. Em reverse proxy/Next com URL interna, configurar `APP_URL` com a origem pública exata — não aceitar `x-forwarded-host` do cliente como autoridade. UI envia JSON same-origin, tem trava síncrona durante submissão e instrui conferir o estado quando a resposta é incerta. Versão/CAS evita reaplicar revisão antiga.

## Compatibilidade e reconciliação explícita

Sem nova migração: reutiliza schema/migração `0012` já existente, estados e receipt v1, sem novos campos públicos. Consumidor deve aceitar `in_person` + `confirmed` em book/list/reschedule, preservar esclarecimento de endereço e distinguir “confirmado na agenda” de detalhes que Antonio ainda combinará. Não gerar link remoto nem afirmar contato/confirmacão externa; não criar tarefa redundante de confirmação. Replays históricos mantêm o receipt original, inclusive `pending_approval`, e listagem é a fonte do estado atual.

Não converter pendências existentes em lote. `ownerAppointment({id,version,operation:"approve",travel_before:0,travel_after:0})` permanece exportada em `src/server/appointments.ts`, com validação de estado/modo, janela, conflitos, ICS, clock vivo, lock, CAS e histórico actor `owner`. O endpoint owner autenticado permanece o caminho normal; rejeição e buffers explícitos permanecem compatíveis para legados. Um operador autorizado pode invocar a função de negócio por ID exato em manutenção confiável; nunca usar SQL para contornar os checks. Dependências transitivas: `getDb`/schema Drizzle, `withCalendarTransaction`/`withDbTransaction`, sincronização ICS (`calendar.ts`/`node-ical`), zod e crypto do Node. O bundle de produção é gerado pelo Next: export minificado e caminho de chunk são detalhes do build, não uma API de manutenção estável; resolver o export da função no build exato antes de chamar, sem substituir por operação interna desprotegida.

## Coordenação dos writers

`withCalendarTransaction` usa `withDbTransaction` (Neon: sessão WebSocket interativa; nunca neon-http) e a linha singleton `calendar_write_lock` com `FOR UPDATE`. Disponibilidade e todas as mutações compartilham a mesma transação/lock. A deduplicação grava digest e receipt na transação dos efeitos; repetições de mutações concluídas retornam o receipt original, mesmo após mudanças posteriores. Digest divergente recusa.

Writers existentes inspecionados e coordenados: ações `saveEvent`/`deleteEvent` via `calendar-writes`, `assistant.criarEvento`, adição/alteração/exclusão de calendários, sync individual e sync stale. Sync faz delete+insert+freshness atomicamente. Eventos vinculados recusam edição/exclusão legadas. Na Agenda, são exibidos como agendamento confirmado (não assinatura ICS), sem edição/exclusão genérica; “Ver detalhes / Cancelar agendamento” abre `/agenda/agendamentos?id=<UUID>` com o registro exato, mesmo fora dos 100 da lista. O botão de cancelamento usa POST `/api/appointments/owner`, operação `cancel`, ID e versão atuais; cancela e remove apenas o evento vinculado na mesma transação, liberando a célula. Falha não remove o registro otimisticamente; resposta incerta exige atualização/readback. Eventos manuais não vinculados continuam suportados, mas recusam colisão com a célula reservada e deslocamentos. Um feed externo pode naturalmente mudar fora da Órbita após uma reserva: o lock coordena a aplicação local, não controla o provedor remoto. Não há garantia de escrita serializada para acessos SQL externos ao app, que continuam fora do escopo.

## Avisos e privacidade

Reutiliza `src/server/notifications.ts`: somente presencial pendente **legado** aparece em Empresa com ID estável `appointment-<id>-v<version>`; confirmado reutiliza o evento já presente na agenda/brief e o aviso de compromisso próximo em Pessoal, sem segunda notificação da mesma confirmação. Cancelar/rejeitar remove o aviso derivado do estado. Sem nova tabela de notificações, outbox, Telegram, scheduler ou lembrete. **Nenhuma entrega externa/Telegram é alegada ou testada.**

O endpoint dedicado não entrega eventos pessoais, contato de terceiros, histórico ou campos internos. Projeções de agendamento têm exatamente os campos do contrato. Erros HTTP usam códigos fixos, não detalhes privados do provider/DB. O segredo não é enviado para componentes cliente.

## Testes reproduzíveis

```sh
npm ci --include=dev --ignore-scripts
env -u NODE_ENV npm run typecheck
env -u NODE_ENV npm run lint
env -u NODE_ENV npm test -- --maxWorkers=1
python scripts/test-appointments-postgres.py
env -u NODE_ENV npm run build
```

O fixture PostgreSQL usa somente imagem `postgres:17-alpine` já em cache, `--pull=never`, `--network=none`, TCP desligado e socket Unix em diretório descartável de scratch. Cria schema a partir das migrações do repositório, usa somente dados sintéticos e remove/verifica **o ID exato** do container no finally. `sudo -n docker` é necessário neste host; não toca os containers existentes. Rede do container é nenhuma; os testes ICS usam doubles ou servidor HTTP loopback sintético, nunca assinaturas reais. Container e volumes anônimos associados têm os IDs registrados antes da remoção e ausência verificada.

Evidências RED/GREEN e gates ficam fora do repositório em `../evidence-backend/`. Testes locais não provam plugin instalado, interoperabilidade com gateway Maia real, provider/ICS real, sessão administrativa publicada nem piloto do proprietário.

## Reversão e aceite restante

Manter a flag ausente/false para desligar. O rollback operacional não deve apagar agendamentos/histórico: preservar tabelas additive e reconciliar eventos já confirmados antes de reverter código de writers. Nunca liberar um writer antigo que ignore reservas enquanto houver agendamentos ativos. Revisão independente, PR draft, integração do plugin, migração remota autorizada e testes conjuntos do proprietário antecedem qualquer liberação a clientes.
