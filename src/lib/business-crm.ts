/** Chave do produto no CRM para cada negócio do catálogo (o CRM usa nomes próprios em alguns casos). */
export function crmKeyForUnit(id: string) {
  return id === "aglabs-app" ? "aglabs" : id;
}
