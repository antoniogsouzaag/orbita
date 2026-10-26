# Memória da ORBE por escopo — decisão de arquitetura

Estado: desenho preparado em 26/10/2026; persistência nova não implementada nem ativada. Complementa [qualidade da ORBE](./orbe-qualidade.md). Não amplia ferramentas ou permissões.

## Decisão

Separar conversa, fatos aprovados e fontes operacionais. A conversa ajuda a manter o raciocínio, mas não transforma uma conclusão do modelo em fato da empresa. O Vault continua sendo conhecimento canônico durável; não receberá histórico de chat, recibos de ferramentas, snapshots de métricas ou fila transitória.

| Camada | Fonte e uso | Persistência e invalidação |
| --- | --- | --- |
| Conversa recente | Mensagens do usuário e respostas; não prova de execução | Hoje: sessionStorage por espaço, mesma aba, com limites de caracteres e turnos. Não há continuidade garantida entre dispositivos |
| Fato aprovado | Preferência ou decisão estável confirmada pelo proprietário, com origem identificada | Proposta: registro versionado na Órbita; revisão e remoção explícitas; jamais aprender silenciosamente de uma resposta |
| Conhecimento da empresa | Notas canônicas existentes no Vault | Consultar a versão atual; editar apenas quando solicitado, mantendo caminho/SHA e histórico da origem |
| Estado de app ou CRM | Consulta autoritativa com produto, janela, horário e cobertura | Buscar novamente quando a pergunta exigir estado atual; histórico não atualiza snapshots nem comprova receita |
| Evidência de ação | Recibo da operação e identificador da origem | Separada do conteúdo conversacional; recebido não equivale a concluído; ação incerta exige reconciliação antes de repetir |

## Fronteira de acesso

A autenticação atual da Órbita usa um principal de instalação e versão de sessão, não um cadastro multiusuário com tenant por conversa. Portanto, não basta acrescentar um owner_id enviado pelo cliente para prometer isolamento por proprietário.

Uma implementação futura deve derivar o principal autenticado no servidor, exigir escopo em todas as leituras e escritas e preservar namespaces separados pessoal/empresa. Mudança de espaço aborta o stream local e não copia histórico, fatos ou resultados. Se a Órbita passar a ter vários usuários, a autorização por proprietário/organização deve existir no banco e no serviço antes de habilitar memória compartilhada. IDs de conversa e filtros de interface não são controles de acesso.

Não disponibilizar finanças, agenda ou notas pessoais no contexto Empresa. CRM comercial e tarefas internas da empresa permanecem no espaço Empresa. Conhecimento empresarial comum do Vault não autoriza levar dados pessoais de volta para a empresa. Tokens dos conectores não recebem permissões adicionais por causa da memória.

## Contrato proposto para fatos

Cada fato precisa de identificador, principal derivado no servidor, escopo, texto conciso, categoria, origem e versão da origem, versão do registro, estado (proposto/aprovado/superado/revogado), aprovador e horário de aprovação. Campos de validade e revisão são explícitos quando a natureza do fato os exige. A aprovação deve registrar a versão revisada; edição concorrente exige recarregar, não sobrescrever silenciosamente.

Guardar apenas preferências ou decisões úteis, sem segredos, dados de clientes, extratos, saúde ou conteúdo pessoal sensível por inferência. Um trecho de ferramenta ou nota pode sugerir uma revisão, mas não pode aprovar a si mesmo. Instruções recuperadas são dados, não autorização para escrever, enviar mensagens ou despachar agentes. Um fato revogado deixa de compor o contexto na próxima consulta; sua eventual auditoria obedece à política de retenção definida para essa finalidade.

Métricas e fatos operacionais mutáveis exigem nova consulta. Mudança do SHA da nota, indisponibilidade da fonte, versão incompatível do contrato ou expiração invalida o uso como estado atual. Conflito entre memória e origem deve ser apresentado e reconciliado; nunca resolver inventando um valor intermediário.

## Fluxo de aprovação e esquecimento

1. Usuário solicita guardar uma preferência ou decisão; ORBE apresenta texto, escopo, origem e validade proposta.
2. Serviço valida autenticação/escopo, limites e versão. Somente confirmação explícita transforma proposta em fato aprovado.
3. Próxima consulta seleciona fatos aprovados e válidos apenas do escopo atual, com orçamento de contexto e referência de origem.
4. Usuário pode revisar, revogar, exportar e solicitar exclusão. Limpar a conversa não deve ser apresentado como exclusão dos fatos aprovados, nem o inverso.

Não definir automaticamente um prazo universal de guarda de conversas ou auditoria. A política precisa indicar finalidade, responsável, acesso, retenção, backups e tratamento de pedidos de exclusão antes de persistir novas conversas. A opção store:false usada na API não é garantia universal sobre políticas de retenção do provedor, logs ou backups.

## Observabilidade mínima antes da expansão

Registrar métricas técnicas sem texto de pergunta/resposta, argumentos de ferramentas, resultados, IDs de clientes, tokens de acesso ou conteúdo do Vault: duração, provedor/modelo retornado, rodadas, chamadas de ferramenta, tokens de entrada/saída/cache quando informados, cancelamento e conclusão/falha. Ausência de usage não equivale a zero tokens. Custo só pode ser estimado com tabela de preços atual identificada por versão/data, incluindo todas as rodadas e distinção entre cache e saída; sem esse cálculo validado, mostrar custo desconhecido.

Hoje não há orçamento monetário por conversa nem medição persistida desse contrato. O limite de histórico em caracteres, o teto de rodadas e o maxDuration HTTP controlam aspectos diferentes e não substituem um orçamento financeiro. Uma resposta encerrada normalmente deve terminar com o marcador terminal do servidor; timeout/EOF sem marcador mostra aviso e preserva as fontes já recebidas.

## Critérios para implementar e habilitar

- Testes de acesso e troca de escopo, inclusive tentativa de fornecer owner/escopo de outro usuário; contexto Empresa sem conteúdo pessoal.
- Aprovação explícita, revogação, edição concorrente e fonte alterada; ausência de aprendizado automático.
- Recuperação após reload/dispositivo sem duplicar ação; falha entre ferramenta e recibo exige consulta à origem.
- Retenção e exclusão demonstráveis, incluindo a distinção de backup, conversa e fato aprovado.
- Execução supervisionada da matriz de 24 cenários com fontes, janelas, latência e custo quando conhecido. Testes determinísticos e uma boa análise real não comprovam 24/24.
- Gates locais e CI executado; publicação observada e inspeção autenticada. Piloto começa em leitura, sem despacho ou novas permissões.

## Evidência atual

Em 26/10, PRs [36](https://github.com/antoniogsouzaag/orbita/pull/36) e [37](https://github.com/antoniogsouzaag/orbita/pull/37) corrigiram ausência de síntese final e interrupção aos 60 segundos. O último commit integrado, 4237df6, teve 313 testes, tipos/build e CI aprovados, produção READY e uma análise real completa com fontes/horário, separação entre contas, ativação e pagamentos, propostas identificadas e nenhuma escrita. O conjunto completo da matriz, custo e memória persistida continuam pendentes.
