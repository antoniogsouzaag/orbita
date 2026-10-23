import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import { TRAINING_BASES } from "@/lib/training";
import { listTrainingPlans } from "@/server/training";
import { requireAuth } from "@/lib/auth";
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveTrainingPlan, deleteTrainingPlan, saveWorkout } from "@/app/actions/life";
import { shiftDate, today } from "@/lib/dates";
import { workoutStats } from "@/server/life";

describe("fichas e treinos realizados", () => {
  it("salvar e editar fichas preserva instruções sem inventar presenças", async () => {
    const db = await getDb();
    const before = await db.select().from(workouts);
    const id = await saveTrainingPlan(null, TRAINING_BASES[0]);
    const other = await saveTrainingPlan(null, TRAINING_BASES[1]);
    await saveTrainingPlan(id, { ...TRAINING_BASES[0], name: "Minha ficha A" });
    const plans = await listTrainingPlans();
    expect(plans.find((p) => p.id === id)?.name).toBe("Minha ficha A");
    expect(plans.find((p) => p.id === other)?.exercises[0].instructions).toBeTruthy();
    expect(await db.select().from(workouts)).toHaveLength(before.length);
    await deleteTrainingPlan(id);
    expect((await listTrainingPlans()).some((p) => p.id === other)).toBe(true);
  });
  it("conclusão explícita guarda pausa e instruções no histórico", async () => {
    await saveWorkout(null, { ...TRAINING_BASES[0], date: today() });
    const db = await getDb();
    const rows = await db.select().from(workouts);
    expect(rows.at(-1)?.exercises[0]).toMatchObject({ rest: 90, instructions: expect.any(String) });
  });
  it("recusa data futura, data impossível, ficha vazia e acesso não autenticado", async () => {
    await expect(saveWorkout(null, { ...TRAINING_BASES[0], date: shiftDate(today(), 1) })).rejects.toThrow();
    await expect(saveWorkout(null, { ...TRAINING_BASES[0], date: "2026-02-31" })).rejects.toThrow();
    await expect(saveTrainingPlan(null, { ...TRAINING_BASES[0], exercises: [] })).rejects.toThrow();
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(saveTrainingPlan(null, TRAINING_BASES[0])).rejects.toThrow("Unauthorized");
  });
  it("indicadores contam além dos 120 registros exibidos e excluem datas futuras", async () => {
    const db = await getDb();
    await db.delete(workouts);
    await db.insert(workouts).values(Array.from({ length: 121 }, (_, i) => ({ name: `Treino ${i}`, date: today(), exercises: [] })));
    await db.insert(workouts).values({ name: "Futuro antigo", date: shiftDate(today(), 1), exercises: [] });
    expect(await workoutStats()).toEqual({ week: 121, month: 121 });
  });
});
