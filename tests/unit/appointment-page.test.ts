import {expect,it,vi} from "vitest";
import {ownerAppointments} from "@/server/appointments";
import {renderToStaticMarkup} from "react-dom/server";
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
it("targets the exact linked appointment with authenticated private review and current policy copy",async()=>{
 const id="11111111-1111-4111-8111-111111111111";
 const page=await Page({searchParams:Promise.resolve({id})});
 expect(ownerAppointments).toHaveBeenLastCalledWith(id);
 const html=renderToStaticMarkup(page);expect(html).toContain("Antonio confirma os detalhes");expect(html).not.toContain("Presencial exige aprovação");
});
