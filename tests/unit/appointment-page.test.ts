import {expect,it,vi} from "vitest";
import Page from "@/app/(app)/agenda/agendamentos/page";
const auth=vi.hoisted(()=>({requireAuth:vi.fn(async()=>{})}));
vi.mock("@/lib/auth",()=>auth);
vi.mock("@/server/appointments",()=>({ownerAppointments:vi.fn(async()=>[])}));
vi.mock("@/server/crm",()=>({crmUrl:()=>null}));
it("requires owner auth before loading the administrative review page",async()=>{
 expect(await Page()).toBeTruthy();expect(auth.requireAuth).toHaveBeenCalledOnce();
 auth.requireAuth.mockRejectedValueOnce(new Error("unauthorized"));
 await expect(Page()).rejects.toThrow("unauthorized");
});
