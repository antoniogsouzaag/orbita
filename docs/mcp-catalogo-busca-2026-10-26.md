# Catálogo MCP e busca geral

Manual: versão 2026-10-26.4. As páginas `/documentacao` e `/integracoes/mcp`, o Markdown autenticado, o resource `orbita://manual` e o prompt de entrada usam o catálogo compartilhado. As ações administrativas são derivadas de `ASSISTANT_TOOLS`; ferramentas condicionais continuam visíveis no manual com aviso da conexão exigida, enquanto `tools/list` reflete o token e a configuração atuais.

Categorias: Documentação e conhecimento; Tarefas, projetos e metas; Operação e monitoramento; Agentes e registros; Comercial e produtos; Agenda e finanças. Cada entrada informa o escopo; ações administrativas indicam leitura/escrita.

## Nomes e atualização dos clientes

- `documentacao_canonica` → `documentacao`.
- `buscar_no_vault` → `buscar`.
- A variante administrativa duplicada `orbita_buscar_no_vault` passa a ser atendida por `buscar`, com parâmetros `consulta`, `fonte` e `escopo`.

Depois da publicação, reconectar/redescobrir `tools/list` e atualizar chamadas fixas nos clientes externos. Nomes antigos não são anunciados nem executados. Este trabalho não altera configurações de runtimes externos ou cópias do vault. Os demais nomes continuam específicos para tornar a ação e a origem reconhecíveis.

## Cobertura da busca

`buscar({consulta, fonte?})` consulta o manual e o vault para tokens Contexto. Administradores também podem consultar tarefas, projetos ativos e notas não arquivadas, com `escopo: pessoal | empresa` (padrão pessoal). A ORBE força o espaço ativo e recusa tentativa explícita de mudar o escopo. A busca não amplia os privilégios do token.

Fontes: `todos`, `documentacao`, `vault`, `tarefas`, `projetos`, `notas`. As três últimas exigem administrador no MCP. Até oito resultados por fonte, com identificação da origem e cobertura limitada. Falha de uma fonte gera `indisponivel` e não apaga resultados das demais; resposta vazia de uma fonte consultada com sucesso permanece distinta de falha. Consulta interna trata `%` e `_` como texto literal.

Busca geral é um ponto de descoberta do conhecimento e trabalho interno. CRM, conversas anteriores e estado operacional ao vivo continuam em ferramentas específicas: exigem identidade, período, filtros e limites próprios; não convém consultar contatos ou serviços remotos indiscriminadamente a cada busca. O manual orienta a consulta posterior e a leitura da nota pelo caminho/SHA.

## Validação

Testes de regressão cobrem nomes no MCP, schemas restritos por token, ausência de busca administrativa duplicada, consistência do manual por canais e busca real em banco isolado para Pessoal/Empresa. Sem escrita em dados reais ou alteração de provedores externos. Publicação e validação autenticada em produção são etapas posteriores.
