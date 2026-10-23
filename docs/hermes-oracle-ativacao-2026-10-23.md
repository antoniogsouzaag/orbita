# Ativação do Hermes Oracle na Órbita

Registro pontual de verificação em **23/10/2026, aproximadamente 19:20 (America/Sao_Paulo)**. Não substitui o [manual canônico](https://orb.aglabs.api.br/documentacao) nem o [contrato dos gestores](integracao-gestores.md). O estado atual deve ser consultado em Agentes.

## Conexão verificada

- Runtime: `https://hermes.aglabs.api.br`, Hermes **v0.21.5 (2026.9.24)**, perfil `default`, identificado na ficha canônica como gestor do VPS-03.
- Destino MCP: `https://orb.aglabs.api.br/api/mcp`, servidor `orbita`, HTTP com Bearer. Credencial individual de **Hermes Oracle**, perfil Administrador confirmado por Antonio nesta ativação. O perfil inclui dados pessoais e ferramentas de escrita; este teste usou apenas leitura.
- Segredo inserido diretamente no campo protegido do painel. O formulário informa persistência no `.env` e referência na configuração. Nenhuma credencial consta neste documento, em prompts ou no Git.
- Handshake e descoberta de ferramentas passaram no painel. Em uma nova sessão do runtime, o próprio agente chamou `documentacao_canonica`, `contexto_operacional` com `ao_vivo:false`, `ler_nota_do_vault` para sua ficha e `status_ao_vivo`.
- A central confirmou **quatro chamadas de Hermes Oracle, zero falhas** na janela de 24 horas observada. A linha do tempo contém as mesmas quatro ferramentas. Descoberta de catálogo não é contada como chamada de ferramenta.
- Manual recebido: **2026-10-23.2**, servido também em `/documentacao` e `orbita://manual`. O contexto foi gerado às `2026-10-23T22:20:33.418Z`; inventário e estado ao vivo foram consultados separadamente.
- A versão da Órbita validada estava publicada em produção pelo merge `fb6f65a0664f152b3d75f612aadc3c2f5810295e` ([PR #8](https://github.com/antoniogsouzaag/orbita/pull/8)), deployment `dpl_GcKyt9hjyXTGFeQhrWEtxZvDpPx6`, com domínio `orb.aglabs.api.br` e estado READY conferidos.

## Limites desta evidência

Não foram executadas escritas MCP, tarefas, notificações, ações de clientes, alterações financeiras ou de infraestrutura. O relatório de status veio dos monitores recebidos pela central; esta conexão não constitui auditoria independente de login, pagamento ou entrega dos produtos.

O webhook de despacho **não foi ativado**. A entrada MCP funciona independentemente dele. A saída futura exige execução persistente e correlacionada, autenticação própria e ferramentas limitadas pelo runtime, conforme o contrato dos gestores. O acesso administrativo não impõe por si só um modo de diagnóstico somente leitura.

`lastUsedAt` e o catálogo demonstram autenticação/disponibilidade observada, não presença contínua do processo. Novas sessões devem consultar o manual e as fontes atuais; permissões de ferramenta não substituem a autorização para a tarefa concreta.
