import { describe, expect, it } from "vitest";
import { trainingVideoEmbed, trainingPlanSchema, TRAINING_BASES } from "@/lib/training";
import { belongsToBarberias } from "@/lib/business";
describe("fichas educativas e mídia", () => {
  it("todos os modelos têm instruções e nenhuma carga predefinida", () => {
    for (const plan of TRAINING_BASES) {
      expect(trainingPlanSchema.safeParse(plan).success).toBe(true);
      expect(plan.exercises.every((e) => e.instructions && !e.load)).toBe(true);
    }
  });
  it("restringe demonstrações a vídeos HTTPS do YouTube", () => {
    expect(trainingVideoEmbed("https://youtu.be/abcdefghijk")).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk");
    expect(trainingVideoEmbed("https://www.youtube.com/watch?v=abcdefghijk&tracking=unused")).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk");
    for (const url of ["javascript:alert(1)", "https://youtube.com.evil.test/watch?v=abcdefghijk", "https://user:secret@youtube.com/watch?v=abcdefghijk", "http://youtu.be/abcdefghijk"]) expect(trainingVideoEmbed(url)).toBeNull();
  });
  it("não atribui domínios parecidos ao Barberias", () => {
    expect(belongsToBarberias("https://barberias.com.br/planos")).toBe(true);
    expect(belongsToBarberias("https://evilbarberias.com.br")).toBe(false);
    expect(belongsToBarberias("https://barberias.com.br.evil.test")).toBe(false);
  });
});
