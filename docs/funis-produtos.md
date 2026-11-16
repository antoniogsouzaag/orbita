# Jornada agregada dos produtos

O bloco opcional `productFunnel` do snapshot v1 vem do aplicativo, passa pela projeção fechada do CRM e é validado novamente pela Órbita. Ausência do bloco ou `null` significa indisponível; zero só vem de uma consulta bem-sucedida. Nenhuma identidade, URL livre, texto de usuário ou payload de pagamento é repassado.

- **MeCard:** sessões cuja primeira visita ocorreu nas 30 datas civis de São Paulo selecionadas. Visita → clique → login → checkout seguem a ordem na mesma sessão. O painel e o coletor usam `product_growth_report`; o painel conserva a guarda `admin_has_access`. O coletor conserva seu token e as funções ficam restritas ao `service_role`. Origens são categorias fechadas. Bloqueadores e preferências de privacidade reduzem cobertura; retenção existente de 90 dias.
- **Viajeki:** usuários distintos em criações iniciadas nos últimos 30 dias, com eventos até o instante do snapshot. Início e criação devem compartilhar usuário e identificador da tentativa; a visualização deve ser posterior à criação e pertencer ao mesmo usuário e viagem. Total remove repetidos; Manual e Com IA podem compartilhar pessoas. Contas excluídas e eventos sem correlação não compõem o funil. As definições usam os mesmos eventos existentes do painel e da jornada; não misturar com seu agregado histórico de tentativas de IA.
- **AG LABS App:** usuários com geração concluída, visita a créditos, checkout criado com resposta HTTP de sucesso e compra registrada na janela de 30 dias do painel. São etapas independentes: não dividir uma pela anterior como taxa de abandono ou conversão. Geração concluída não prova visualização da mídia; compra registrada exclui os estornos conforme o relatório existente e não comprova liquidação. Telemetria ausente vira `null`.

O contrato não adiciona coleta, cookies, identificadores, permissões, retenção ou cobrança. Fontes antigas continuam válidas sem o bloco. Publicar leitores antes das origens permite implantação gradual; o MeCard precisa da migration aditiva do cálculo compartilhado. Falha dessa seção mantém os demais indicadores disponíveis.

## Cache e atualização

As leituras agregadas do CRM são compartilhadas entre chamadas simultâneas e reaproveitadas por até um minuto, em memória limitada e com chave que inclui origem, credencial, ferramenta e argumentos. Falhas não ficam no cache; não há sondagem em laço. O botão **Atualizar** invalida as leituras agregadas e a navegação de Negócios. A navegação recente usa o cache de segmentos do Next.js por até um minuto; as ações de escrita continuam invalidando o layout.

Testes de contrato cobrem privacidade, séries, unidades, janelas, indisponibilidade e contagens inconsistentes. As origens validam as consultas com fixtures; isso não substitui o readback após o deploy nem comprova uma melhoria causal de conversão.
