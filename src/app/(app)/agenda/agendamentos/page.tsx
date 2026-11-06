import * as React from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { AppointmentReview } from "@/components/agenda/appointment-review";
import { requireAuth } from "@/lib/auth";
import { ownerAppointments } from "@/server/appointments";
import { crmUrl } from "@/server/crm";
export const metadata={title:"Agendamentos Maia"};
export const dynamic="force-dynamic";
export default async function Page({searchParams}: {searchParams?:Promise<{id?:string}>} = {}) {
 await requireAuth();
 const {id}=await (searchParams??Promise.resolve({id:undefined}));
 const rows=await ownerAppointments(id);
 const items=rows.map(a=>({...a,startAt:a.startAt.toISOString(),endAt:a.endAt.toISOString(),history:a.history.map(h=>({version:h.version,actor:h.actor,operation:h.operation,createdAt:h.createdAt.toISOString()}))}));
 return <div className="mx-auto max-w-4xl px-4 sm:px-6"><PageHeader icon={<CalendarDays/>} title="Agendamentos Maia" description="Revisão privada de solicitações e compromissos. Nenhum aviso externo novo." actions={<Link href="/agenda">Voltar à agenda</Link>}/><p className="mb-4 text-muted">Remoto e presencial: confirmados na agenda, com horário reservado. Antonio confirma os detalhes pessoalmente com o cliente; se não confirmar, cancele para liberar o horário. Remoto: preparar e enviar o link manualmente. Pendências legadas ainda exigem revisão explícita. Listagem limitada aos 100 registros mais recentes por estado; o link da agenda abre o agendamento exato.</p><AppointmentReview items={items} crmBase={crmUrl()}/></div>;
}
