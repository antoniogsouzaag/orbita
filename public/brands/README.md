# Marcas oficiais

`barberias.png`: cópia sem modificação de `public/logo.png` do repositório
`aglabs-core/barberias`, checkout local `Barber PRO2/Barber-PRO`, em 2026-10-23.
O componente oficial `src/components/ui/BarberShopLogo.tsx` usa este arquivo
nas páginas públicas da plataforma. Não representa a marca de um estabelecimento.

Conferido também contra `https://barberias.com.br/logo.png` (HTTP 200):
mesmos 11.030 bytes e mesmo SHA-256 em 2026-10-23.

Outras marcas copiadas sem modificação em 2026-10-26:

| Arquivo local | Fonte oficial no repositório |
| --- | --- |
| `members.png` | `aglabs-core/members`, `public/logo brand.png` (símbolo usado no rodapé oficial) |
| `vibekit-purple.png` | Imagem roxa completa fornecida por Antonio em 26/10: `Desktop/logos/ChatGPT Image 30 de jun. de 2026, 20_35_53.png` |
| `aglabs-app-purple.png` | Imagem roxa sem fundo fornecida por Antonio em 26/10: `Desktop/logos/AGENTES(1).png` (transparência preservada) |
| `mecard.png` | `aglabs-core/mecard`, `public/brand/favicon.png`, usado por `src/components/brand.tsx` em modo `markOnly` |
| `viajeki.png` | `aglabs-core/viajeki`, `public/apple-touch-icon.png` (símbolo oficial sem o nome) |

Os blobs de Members (`a1af6e8`), MeCard (`4e3ebb8`) e Viajeki (`baf2118`)
foram conferidos contra a branch padrão do GitHub. A navegação usa as artes
originais em fundo escuro, sem inverter, recortar ou redesenhar as marcas.
Os nomes dos apps acompanham as imagens; os atributos alt ficam vazios para
evitar repetir o mesmo nome na leitura assistida.

**MeCard:** a marca atual é o símbolo azul/ciano com cartão de contato. Os
SVGs antigos `public/brand/mark.svg` e `public/brand/logo.svg` representam a
primeira identidade e não devem ser usados como fonte, mesmo quando ainda
aparecem em histórico ou documentação antiga. A cópia antiga `mecard.svg`
foi removida da Órbita. Para assinatura completa, usar `logo-light.png` ou
`logo-dark.png` do MeCard; para o símbolo, `favicon.png`/`icon-192.png`.
