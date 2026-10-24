# Infisical Cloud — implantação AG LABS

Status: estrutura preparada; organização/projetos remotos ainda não criados. Usar Infisical Cloud Free; não iniciar trial pago. Organização: AG LABS. Responsável inicial: Antonio. Ativar 2FA na conta antes da importação.

## Projetos

Criar projetos de Secrets Management separados: orbita, barberias, members, mecard, viajeki, aglabs, infraestrutura. Cada projeto usa Development, Staging e Production. Não colocar todos os produtos em pastas de um único projeto se isso ampliar o acesso das identidades.

Primeiro piloto: orbita. Pastas /application, /integrations/github, /integrations/postiz, /integrations/telegram, /integrations/crm, /integrations/n8n. Usar importações/referências de secrets para montar o conjunto necessário ao destino, evitando duplicar valores. Segredos pessoais e códigos de recuperação ficam no gerenciador de senhas.

## Limites do Free conferidos em 23/10/2026

Cinco identidades somando humanos e máquinas, projetos ilimitados, três ambientes e dez Secret Syncs. Não criar uma identidade por agente agora nem compartilhar uma credencial administrativa entre eles para caber na cota. Recursos como versionamento, recuperação pontual, controles avançados e retenção de auditoria dependem do plano. Validar necessidade antes de escalar.

## Piloto Vercel

Destino confirmado da Órbita: projeto prj_Tc8KxzT1UHc3aqpoNYb5NfwxMbAT, equipe team_YyEI6KlTzQMqFslAkW9Gwt4d. Começar em Preview com uma variável de teste sem valor sensível. Auto-sync desligado e exclusão no destino desabilitada. Revisar o conjunto de chaves antes de sincronizar Production. Não usar overwrite-destination na primeira configuração.

Variáveis marcadas Sensitive na Vercel não podem ser importadas com seus valores: o Infisical documenta que elas chegam vazias. Preencher a partir da origem autorizada e verificar antes de ativar sincronização. Nunca sincronizar valores vazios sobre chaves de produção. Manter as variáveis atuais até validar o piloto e a aplicação publicada.

## Recuperação e expansão

Infisical gerencia o serviço Cloud; AG LABS continua responsável por 2FA, permissões, recuperação da conta e revisão das integrações. Manter cópia de recuperação criptografada fora da conta e testar recuperação, sem arquivo de exportação em texto aberto no repositório ou no vault. Depois do piloto, acrescentar um produto de cada vez. Órbita guarda apenas links e estado da conexão, nunca expõe valores ao chat ou à página de integrações.

## Etapa que requer conta

Entrar ou criar conta em https://app.infisical.com . Criação que exige aceite de termos e definição de senha é concluída pelo proprietário. Após login, criar a organização e o piloto orbita, verificar plano Free e preparar o conjunto de variáveis antes de conceder a conexão Vercel.

Fontes: https://infisical.com/pricing ; https://infisical.com/docs/self-hosting/overview ; https://infisical.com/docs/integrations/secret-syncs/vercel .
