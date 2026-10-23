# Estrutura operacional do ecossistema

Cada produto é uma unidade de negócio. A visão Negócios usa o Registro de Aplicações do vault, PRs da organização e grupos explícitos dos monitores. Próximos vínculos devem ser ids de produto, não inferência por nomes de pessoas: produto → projetos/tarefas internas, oportunidades/clientes do CRM, canais Postiz, workflows n8n e caixas de e-mail. A visão AG LABS consolida o conjunto; a visão de produto filtra a mesma origem.

## Tarefas

CRM é fonte das tarefas de relacionamento comercial vinculadas a contatos e oportunidades. Órbita é fonte das tarefas internas, projetos e pedidos de agentes; Pessoal continua separado. A tela de tarefas da empresa mostra uma seção CRM em leitura com link ao sistema de origem. Não sincronizar cópias bidirecionais de tarefas: evita status divergente, duplicatas e dúvidas sobre onde concluir. O MCP do CRM atual entrega resumo e amostras de tarefas, sem dimensão de produto no contrato; não atribuir clientes ou receita a Barberias sem vínculo real.

## Segredos

Recomendação: Infisical como cofre técnico dedicado, separado da Órbita e do vault Markdown. Organizar por projeto e ambiente, identidades de máquina com escopo mínimo e sincronização para os destinos necessários (Vercel/n8n/servidores). A central guarda apenas referência, responsável e validade, nunca o valor. GitHub Actions Secrets serve à execução de CI, não como inventário recuperável das chaves pessoais e da infraestrutura.

Self-hosting exige serviço separado, TLS, autenticação forte, PostgreSQL/Redis, atualização e restauração testada. Backups criptografados fora da instância e chave raiz guardada separadamente; perder banco ou chave não pode depender do mesmo HD. Não migrar nem remover os arquivos atuais antes de validar importação e recuperação. Avaliar hospedado se não houver capacidade de manter essa operação. Senhas pessoais e códigos de recuperação cabem em gerenciador de senhas; tokens de serviços ficam no cofre técnico.

Esta etapa recomenda a arquitetura; não instalou cofre nem importou chaves dos HDs. Próximo passo é definir instância/domínio, política de acesso e destino do backup antes do provisionamento.

Fontes: https://infisical.com/docs/self-hosting/overview ; https://infisical.com/docs/integrations/secret-syncs/overview ; https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets .
