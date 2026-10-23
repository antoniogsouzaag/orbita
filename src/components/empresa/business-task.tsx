"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createTask } from "@/app/actions/core";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function BusinessTask() {
  const [title, setTitle] = React.useState("");
  const [pending, start] = React.useTransition();
  return <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); start(async () => { try { await createTask({ title, scope: "empresa", tags: ["barberias"] }); setTitle(""); toast.success("Próxima ação do Barberias criada"); } catch { toast.error("Não foi possível criar a tarefa."); } }); }}><Input aria-label="Próxima ação do Barberias" className="min-w-0 flex-1 basis-44" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Qual é a próxima ação do Barberias?" maxLength={500} required /><Button disabled={pending} variant="primary"><Plus />Adicionar</Button></form>;
}
