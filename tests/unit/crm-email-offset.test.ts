import { expect, it } from "vitest";
import { crmEmailSchema } from "@/lib/crm-aggregates";
it("aceita data ISO do Postgres com fuso e normaliza a última mensagem", () => {
  expect(crmEmailSchema.parse({ ultima_mensagem_em: "2026-10-24T12:00:00+00:00" }).ultima_mensagem_em).toBe("2026-10-24T12:00:00.000Z");
  expect(crmEmailSchema.parse({ ultima_mensagem_em: "2026-10-24T09:00:00-03:00" }).ultima_mensagem_em).toBe("2026-10-24T12:00:00.000Z");
  expect(crmEmailSchema.safeParse({ ultima_mensagem_em: "ontem" }).success).toBe(false);
});
