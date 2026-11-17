/** Serializável para o Code node do n8n. Sem rede, segredos ou dependências externas. */
export function classifyReminderOutcome(input: unknown) {
  const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const root = obj(input);
  const data = obj(root.data);
  const key = obj(data.key);
  if (!root.error && root.success === true && typeof key.id === "string" && key.id.trim()) {
    return { state: "accepted", reason: "provider_accepted", message_id: key.id, requires_alert: false };
  }
  const error = obj(root.error);
  const response = obj(error.response ?? root.response);
  const bodies = [root, data, error, response, obj(response.data), obj(response.body)];
  // O community node pode embutir o corpo JSON em error.message. Só interpreta JSON estruturado.
  for (const value of [root.error, root.message, error.message, error.description]) {
    if (typeof value !== "string" || value.length > 20000) continue;
    const start = value.indexOf("{");
    if (start < 0) continue;
    try { bodies.push(obj(JSON.parse(value.slice(start)))); } catch { /* Sem evidência estruturada. */ }
  }
  const statuses = bodies.flatMap(b => [b.status, b.statusCode, b.httpCode]).map(Number).filter(n => Number.isInteger(n) && n >= 400 && n <= 599);
  // Falha técnica tem precedência: não esconder autenticação, instância, limite ou indisponibilidade.
  if (statuses.some(n => n !== 400 && n !== 422)) return { state: "unknown", reason: "technical_failure", message_id: null, requires_alert: true };
  const rejected = (value: unknown, depth = 0): boolean => {
    if (depth > 5 || value === null || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(v => rejected(v, depth + 1));
    const body = obj(value);
    if (body.exists === false) return true;
    return [body.response, body.data, body.message].some(v => rejected(v, depth + 1));
  };
  const hasLid = (value: unknown, depth = 0): boolean => {
    if (depth > 5 || value === null || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(v => hasLid(v, depth + 1));
    const body = obj(value);
    return [body.jid, body.number].some(v => typeof v === "string" && /@lid$/i.test(v))
      || [body.response, body.data, body.message].some(v => hasLid(v, depth + 1));
  };
  // LID pode falhar por incompatibilidade do provedor, não por telefone inexistente.
  if (bodies.some(b => hasLid(b))) return { state: "unknown", reason: "technical_failure", message_id: null, requires_alert: true };
  if (statuses.some(n => n === 400 || n === 422) && bodies.some(b => rejected(b))) {
    return { state: "canceled", reason: "recipient_unavailable", message_id: null, requires_alert: false };
  }
  return { state: "unknown", reason: "send_uncertain", message_id: null, requires_alert: true };
}
