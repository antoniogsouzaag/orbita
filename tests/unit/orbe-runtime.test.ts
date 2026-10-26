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
// A leitura da memória é coberta em tests/db/orbe-memory; aqui o banco deve ficar intocado.
vi.mock("@/server/orbe-memory", async (importOriginal) => ({...(await importOriginal<typeof import("@/server/orbe-memory")>()),memoryContext: vi.fn(async () => "<memoria>(vazio)</memoria>")}));
import { askStream } from "@/server/ai";
import { ASSISTANT_TOOLS, assistantTools, runAssistantTool } from "@/server/assistant";
import { chatParts, splitActions } from "@/lib/ai-stream";
const call = (name = "criar_tarefa") => ({type:"function_call",id:"fc",call_id:"c",name,arguments:'{"titulo":"não criar"}',status:"completed"});
const completed = (output: object[] = []) => ({type:"response.completed",response:{status:"completed",output}});
const events = (...items: object[]) => (async function* () { for (const item of items) yield item; })();
const consume = async (options: Parameters<typeof askStream>[1] = {}) => new Response(await askStream([{role:"user",content:"teste"}],options)).text();
beforeEach(() => {vi.stubEnv("OPENAI_API_KEY","fixture");vi.stubEnv("AI_PROVIDER","openai");mock.create.mockReset();mock.db.mockReset();vi.stubGlobal("fetch",vi.fn(async () => {throw new Error("Unexpected network in isolated unit test");}));});
afterEach(() => {vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe("ORBE execução confiável", () => {
  const message = (text: string) => ({type:"message",id:"answer",role:"assistant",status:"completed",content:[{type:"output_text",text,annotations:[]}]});
  it("recupera texto do terminal quando o provedor não entregou deltas", async () => {
    mock.create.mockResolvedValueOnce(events(completed([message("Análise confirmada")] )));
    expect(splitActions(await consume({readOnly:true})).text).toBe("Análise confirmada");
    expect(mock.create).toHaveBeenCalledTimes(1);
  });
  it("não duplica o texto que já chegou em deltas", async () => {
    mock.create.mockResolvedValueOnce(events({type:"response.output_text.delta",delta:"Análise confirmada"},completed([message("Análise confirmada")])));
    expect(splitActions(await consume()).text).toBe("Análise confirmada");
    expect(mock.create).toHaveBeenCalledTimes(1);
  });
  it("sintetiza consultas sem texto numa rodada sem ferramentas", async () => {
    const read = vi.spyOn(ASSISTANT_TOOLS.find(t => t.name === "listar_tarefas")!,"run").mockResolvedValue({text:"Nenhuma tarefa na amostra"});
    mock.create.mockResolvedValueOnce(events(completed([call("listar_tarefas")])))
      .mockResolvedValueOnce(events(completed()))
      .mockResolvedValueOnce(events(completed([message("A consulta não retornou tarefas nesta amostra.")])));
    const raw = await consume({readOnly:true});
    const parsed = splitActions(raw);
    expect(parsed.text).toBe("A consulta não retornou tarefas nesta amostra.");
    expect(parsed.sources).toEqual([{name:"listar_tarefas",ok:true}]);
    expect(chatParts(raw).filter(p => p.type === "step")).toEqual([{type:"step",step:{id:1,name:"listar_tarefas",status:"done",write:false}}]);
    expect(read).toHaveBeenCalledOnce();
    expect(mock.create.mock.calls[2][0].tools).toBeUndefined();
    expect(mock.create.mock.calls[2][0].instructions).toContain("Não faça novas consultas nem ações");
    expect(mock.create.mock.calls[2][0].input).toEqual(expect.arrayContaining([
      expect.objectContaining({type:"function_call_output",call_id:"c",output:"Nenhuma tarefa na amostra"}),
    ]));
  });
  it("reserva a última rodada para síntese e limita as consultas", async () => {
    const read = vi.spyOn(ASSISTANT_TOOLS.find(t => t.name === "listar_tarefas")!,"run").mockResolvedValue({text:"amostra"});
    for (let i=0;i<6;i++) mock.create.mockResolvedValueOnce(events(completed([{...call("listar_tarefas"),id:`fc${i}`,call_id:`c${i}`}])));
    mock.create.mockResolvedValueOnce(events(completed([message("Resumo com limites explícitos")])));
    expect(splitActions(await consume({readOnly:true})).text).toBe("Resumo com limites explícitos");
    expect(read).toHaveBeenCalledTimes(6);
    expect(mock.create).toHaveBeenCalledTimes(7);
    expect(mock.create.mock.calls[6][0].tools).toBeUndefined();
  });
  it("não executa ferramenta que o provedor invente na rodada de síntese", async () => {
    const write = vi.spyOn(ASSISTANT_TOOLS.find(t => t.name === "criar_tarefa")!,"run");
    mock.create.mockResolvedValueOnce(events(completed())).mockResolvedValueOnce(events(completed([call()])));
    expect(await consume()).toContain("⚠️");
    expect(write).not.toHaveBeenCalled();
    expect(mock.db).not.toHaveBeenCalled();
    expect(mock.create).toHaveBeenCalledTimes(2);
  });
  it("duas respostas vazias terminam com limite explícito, sem loop ou nova escrita", async () => {
    mock.create.mockResolvedValueOnce(events(completed())).mockResolvedValueOnce(events(completed()));
    expect(await consume()).toContain("Não foi possível concluir a análise");
    expect(mock.create).toHaveBeenCalledTimes(2);
    expect(mock.db).not.toHaveBeenCalled();
  });
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
