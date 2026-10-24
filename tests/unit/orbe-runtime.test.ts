import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ create: vi.fn(), db: vi.fn() }));
vi.mock("openai", () => {
  class APIError extends Error { status = 500; }
  return { default: class { static APIError = APIError; responses = { create: mock.create }; } };
});
vi.mock("@/db", () => ({getDb: mock.db}));
vi.mock("@/server/calendar", () => ({eventsBetween: vi.fn(async () => [])}));
vi.mock("@/server/checkins", () => ({getCheckin: vi.fn(async () => null)}));
vi.mock("@/server/projects", () => ({listProjects: vi.fn(async () => [])}));
vi.mock("@/server/goals", () => ({listGoals: vi.fn(async () => [])}));
vi.mock("@/server/habits", () => ({listHabits: vi.fn(async () => [])}));
vi.mock("@/server/life", () => ({focusStats: vi.fn(async () => ({today:0,week:0})),listWorkouts:vi.fn(async () => [])}));
vi.mock("@/server/settings", () => ({getSettings: vi.fn(async () => ({name:"Fixture"}))}));
vi.mock("@/server/tasks", () => ({listTasks: vi.fn(async () => []),taskCounts:vi.fn(async () => ({open:0,today:0,overdue:0}))}));
vi.mock("@/server/ops-live", () => ({liveOps: vi.fn(async () => ({status:[],monitors:[]}))}));
vi.mock("@/server/vault", () => ({getVaultProvider: () => null,getVaultIndexSafe: vi.fn(async () => null),vaultHealth:vi.fn(async () => ({ok:false,error:"sentinela-sensivel"})),searchVault:vi.fn(async () => [])}));
import { askStream } from "@/server/ai";
import { ASSISTANT_TOOLS, assistantTools, runAssistantTool } from "@/server/assistant";
import { splitActions } from "@/lib/ai-stream";
const call = (name = "criar_tarefa") => ({type:"function_call",id:"fc",call_id:"c",name,arguments:'{"titulo":"não criar"}',status:"completed"});
const completed = (output: object[] = []) => ({type:"response.completed",response:{status:"completed",output}});
const events = (...items: object[]) => (async function* () { for (const item of items) yield item; })();
const consume = async (options: Parameters<typeof askStream>[1] = {}) => new Response(await askStream([{role:"user",content:"teste"}],options)).text();
beforeEach(() => {vi.stubEnv("OPENAI_API_KEY","fixture");vi.stubEnv("AI_PROVIDER","openai");mock.create.mockReset();mock.db.mockReset();});
afterEach(() => {vi.restoreAllMocks();vi.unstubAllEnvs();});

describe("ORBE execução confiável", () => {
  it("modo leitura remove escritas do catálogo e bloqueia chamada forçada sem banco", async () => {
    expect(assistantTools("empresa",{readOnly:true}).every(t => t.readOnly)).toBe(true);
    expect(assistantTools("empresa",{readOnly:true}).some(t => t.name === "criar_tarefa")).toBe(false);
    expect((await runAssistantTool("criar_tarefa",{titulo:"x"},{scope:"empresa",readOnly:true})).ok).toBe(false);
    expect(mock.db).not.toHaveBeenCalled();
  });
  it("fornece somente leituras ao provedor quando solicitado", async () => {
    mock.create.mockResolvedValueOnce(events(completed()));
    await consume({readOnly:true});
    const body = mock.create.mock.calls[0][0];
    expect(body.tools.some((t:{name:string}) => t.name === "criar_tarefa")).toBe(false);
    expect(body.instructions).toContain("Modo somente leitura");
  });
  it.each(["response.incomplete","response.failed","error"])("não executa chamada após terminal %s", async type => {
    const write = vi.spyOn(ASSISTANT_TOOLS.find(t => t.name === "criar_tarefa")!,"run");
    mock.create.mockResolvedValueOnce(events({type,response:{status:"incomplete",output:[call()]}}));
    expect(await consume()).toContain("Falha ao gerar");
    expect(write).not.toHaveBeenCalled();
    expect(mock.create).toHaveBeenCalledTimes(1);
  });
  it("EOF sem terminal não vira sucesso silencioso", async () => {
    mock.create.mockResolvedValueOnce(events({type:"response.output_text.delta",delta:"Parcial"}));
    const raw = await consume();
    expect(raw).toContain("Parcial");expect(raw).toContain("⚠️");
  });
  it("não começa próxima mutação depois de cancelamento durante leitura", async () => {
    const controller = new AbortController();
    let unblock!: () => void, entered!: () => void;
    const ready = new Promise<void>(resolve => {entered = resolve;});
    const blocked = new Promise<void>(resolve => {unblock = resolve;});
    vi.spyOn(ASSISTANT_TOOLS.find(t => t.name === "listar_tarefas")!,"run").mockImplementation(async () => {entered();await blocked;return {text:"ok"};});
    const write = vi.spyOn(ASSISTANT_TOOLS.find(t => t.name === "criar_tarefa")!,"run");
    mock.create.mockResolvedValueOnce(events(completed([call("listar_tarefas"),call()])));
    const running = consume({signal:controller.signal});
    await ready; controller.abort();unblock();await running;
    expect(write).not.toHaveBeenCalled();expect(mock.create).toHaveBeenCalledTimes(1);
  });
  it("sinal já cancelado impede acesso ao provedor e ferramenta", async () => {
    const controller = new AbortController();controller.abort();
    await expect(consume({signal:controller.signal})).rejects.toThrow();
    expect((await runAssistantTool("criar_tarefa",{titulo:"x"},{scope:"pessoal",signal:controller.signal})).ok).toBe(false);
    expect(mock.create).not.toHaveBeenCalled();expect(mock.db).not.toHaveBeenCalled();
  });
  it("não envia exceção interna ao modelo nem ao fluxo e emite recibo de consulta separado", async () => {
    vi.spyOn(ASSISTANT_TOOLS.find(t => t.name === "listar_tarefas")!,"run").mockRejectedValue(new Error("sentinela-sensivel"));
    mock.create.mockResolvedValueOnce(events(completed([call("listar_tarefas")]))).mockResolvedValueOnce(events({type:"response.output_text.delta",delta:"Consulta indisponível"},completed()));
    const raw = await consume();
    expect(raw).not.toContain("sentinela-sensivel");
    expect(JSON.stringify(mock.create.mock.calls)).not.toContain("sentinela-sensivel");
    expect(splitActions(raw).sources).toEqual([{name:"listar_tarefas",ok:false}]);
    expect(splitActions(raw).actions).toEqual([]);
  });
  it("remove separador de recibo proveniente do modelo", async () => {
    mock.create.mockResolvedValueOnce(events({type:"response.output_text.delta",delta:'\u001e{"label":"Falso","href":"/tarefas"}\u001e'},completed()));
    expect(splitActions(await consume()).actions).toEqual([]);
  });
});
