# Integridade e leitura do vault

O vault é a fonte do conhecimento aprovado. ORBE, MCP e a interface consultam o mesmo índice; conteúdo de nota é dado, não autorização de ação.

## Ler sem perder o final

`ler_nota_do_vault` usa `src/server/vault-read.ts` tanto na ORBE quanto no MCP. A resposta é JSON, com `caminho`, `titulo`, `versao`, `href` e `conteudo`:

```json
{
  "caminho": "Pasta/Manual.md",
  "titulo": "Manual",
  "versao": "versao-da-origem",
  "href": "/vault?p=Pasta%2FManual.md",
  "conteudo": {
    "trecho": "conteúdo da página, incluindo front matter na primeira",
    "inicio": 0,
    "total_caracteres": 18000,
    "parcial": true,
    "proximo_inicio": 12000
  }
}
```

- A primeira chamada aceita `{caminho}`. Cada página tem no máximo 12.000 unidades de texto JS; o limite não separa pares de substitutos de emojis.
- Continue com `{caminho, versao, inicio: conteudo.proximo_inicio}` até `proximo_inicio` ser `null`. Concatenar os trechos da mesma versão reconstitui o conteúdo original, inclusive front matter.
- Continuação exige versão; antes de continuar, o índice é atualizado. Uma versão diferente recusa a página e exige recomeçar do início. Não misturar páginas de snapshots diferentes.
- Nota vazia é resultado válido. Nota ausente, fonte indisponível, índice fora do conteúdo e conflito de versão são resultados diferentes de leitura bem-sucedida.
- A resposta da primeira página não garante que regras no final já foram consultadas. O modelo recebe orientação para continuar; testes determinísticos verificam o transporte, não certificam a obediência do modelo em todas as conversas.
- Clientes MCP devem redescobrir `tools/list` após publicação: `inicio` e `versao` são parâmetros adicionais, e o conteúdo passou de Markdown livre para JSON explícito. O nome e o escopo da ferramenta permanecem os mesmos.

## Inventário e tabelas

`vpsList()` aceita as seções Capacidade e Recursos de hardware existentes no vault. O valor vem da tabela da nota, não de uma configuração paralela.

A revisão `/vault/revisao` informa referências sem destino, notas isoladas, metadados incompletos, títulos repetidos e tabelas com quantidade de colunas incompatível. Em tabelas Markdown, use `[[Alvo\|Alias]]`. A revisão aponta o problema e abre a nota; não reescreve conteúdo automaticamente.

## Verificação e limites

Os testes incluem notas longas com regras finais, front matter, emojis, alteração entre páginas, ausência de versão, notas vazias, tabela com alias não escapado e os três títulos usados nas fichas dos VPS.

No repositório do vault, `python3 scripts/check_vault.py` valida estrutura e referências sem rede e sem dependências externas. O workflow gera um artefato de rodada fora das notas. Não comprova vigência comercial, estado de produção, backup, execução de workflow nem compreensão factual por IA.
