import {expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import Page from "@/app/(app)/agenda/page";
vi.mock("@/db",()=>({getDb:async()=>({select:()=>({from:()=>({leftJoin:()=>({where:async()=>[]})})})})}));
vi.mock("@/server/calendar",()=>({eventsBetween:async()=>[],listCalendars:async()=>[],syncStaleCalendars:async()=>{}}));
vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("next/server",()=>({after:()=>{}}));
vi.mock("@/components/agenda/agenda-page",()=>({AgendaPage:()=>null}));
it("links the existing agenda to the owner appointment review",async()=>{
 const page=await Page({searchParams:Promise.resolve({})});
 expect(renderToStaticMarkup(page)).toContain('href="/agenda/agendamentos"');
});
