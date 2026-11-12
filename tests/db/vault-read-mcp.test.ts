import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

let root: string;
let route: typeof import("@/app/api/mcp/route");
let tools: typeof import("@/server/assistant");
let token: string;
beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "orbita-mcp-vault-"));
  vi.stubEnv("VAULT_LOCAL_PATH", root);
  await fs.writeFile(path.join(root, "Manual.md"), "---\ntitle: Manual\n---\n" + "Regra\n".repeat(3000) + "FIM DO MANUAL");
  route = await import("@/app/api/mcp/route");
  tools = await import("@/server/assistant");
  const { createAgentToken } = await import("@/server/agents");
  token = await createAgentToken("Leitor de fixture", ["contexto"]);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await fs.rm(root, { recursive: true, force: true });
});

async function read(input: object) {
  const response = await route.POST(new Request("http://localhost/api/mcp", {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ler_nota_do_vault", arguments: input } }),
  }));
  return (await response.json()).result;
}

it("ORBE e MCP entregam o mesmo contrato e recuperam a seção final", async () => {
  const first = await tools.runAssistantTool("ler_nota_do_vault", { caminho: "Manual" }, { scope: "empresa", readOnly: true });
  expect(first.ok).toBe(true);
  const page = JSON.parse(first.text);
  const mcp = await read({ caminho: "Manual" });
  expect(mcp.isError).toBeFalsy();
  expect(JSON.parse(mcp.content[0].text)).toEqual(page);
  expect(page.conteudo.proximo_inicio).toBe(12000);
  const last = await read({ caminho: "Manual", inicio: page.conteudo.proximo_inicio, versao: page.versao });
  const end = JSON.parse(last.content[0].text);
  expect(end.conteudo.proximo_inicio).toBeNull();
  expect(page.conteudo.trecho + end.conteudo.trecho).toBe(await fs.readFile(path.join(root, "Manual.md"), "utf8"));
  expect(end.conteudo.trecho).toContain("FIM DO MANUAL");
});

it("recusas não recebem marcador de leitura bem-sucedida em nenhum transporte", async () => {
  const bad = { caminho: "Manual", inicio: 12000 };
  expect((await tools.runAssistantTool("ler_nota_do_vault", bad, { scope: "empresa", readOnly: true })).ok).toBe(false);
  expect((await read(bad)).isError).toBe(true);
});
