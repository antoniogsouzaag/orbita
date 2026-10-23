"use client";

import { CalendarPlus, CheckSquare, NotebookPen, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { saveEvent } from "@/app/actions/calendar";
import { createNote, quickAddTask } from "@/app/actions/core";
import { saveTransaction } from "@/app/actions/life";
import { ParsePreview } from "@/components/tasks/parse-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { today } from "@/lib/dates";

type Tab = "tarefa" | "nota" | "evento" | "financas";

export function QuickAdd({ open, onOpenChange, tab, projects, scope = "pessoal" }: { scope?: "pessoal" | "empresa"; open: boolean; onOpenChange: (v: boolean) => void; tab?: string; projects: { id: string; name: string; color: string }[] }) {
  const [current, setCurrent] = React.useState<Tab>(scope === "empresa" ? "tarefa" : ["tarefa", "nota", "evento", "financas"].includes(tab ?? "") ? tab as Tab : "tarefa");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={scope === "empresa" ? "Tarefa da empresa" : "Captura pessoal"} description={scope === "empresa" ? "Esta tarefa fica no espaço Empresa." : "Adicione sem sair do seu espaço pessoal."}>
        {scope === "pessoal" && <Segmented
          value={current}
          onChange={setCurrent}
          className="mb-4 w-full [&>button]:flex-1"
          options={[
            { value: "tarefa", label: <span className="flex items-center justify-center gap-1.5"><CheckSquare className="size-3.5" />Tarefa</span> },
            { value: "nota", label: <span className="flex items-center justify-center gap-1.5"><NotebookPen className="size-3.5" />Nota</span> },
            { value: "evento", label: <span className="flex items-center justify-center gap-1.5"><CalendarPlus className="size-3.5" />Evento</span> },
            { value: "financas", label: <span className="flex items-center justify-center gap-1.5"><Wallet className="size-3.5" />Gasto</span> },
          ]}
        />}
        {current === "tarefa" && <TaskForm scope={scope} projects={projects} onDone={() => onOpenChange(false)} />}
        {current === "nota" && <NoteForm onDone={() => onOpenChange(false)} />}
        {current === "evento" && <EventForm onDone={() => onOpenChange(false)} />}
        {current === "financas" && <TxForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ projects, onDone, scope }: { scope: "pessoal" | "empresa"; projects: { id: string; name: string; color: string }[]; onDone: () => void }) {
  const [value, setValue] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [pending, start] = React.useTransition();
  const submit = () =>
    start(async () => {
      if (!value.trim()) return;
      await quickAddTask(value, projectId || null, scope);
      toast.success("Tarefa criada");
      setValue("");
      onDone();
    });
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
      <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="O que precisa ser feito?" />
      <ParsePreview value={value} projects={projects} />
      <p className="text-[12px] text-faint">Use #tag, !alta, hoje/amanhã/sexta, 15h e @projeto</p>
      <div className="flex gap-2">
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="flex-1">
          <option value="">Sem projeto</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Button variant="primary" disabled={pending || !value.trim()}>Adicionar</Button>
      </div>
    </form>
  );
}

function NoteForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [pending, start] = React.useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const id = await createNote(title, content);
          toast.success("Nota criada");
          onDone();
          router.push(`/notas?id=${id}`);
        });
      }}
      className="space-y-3"
    >
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Escreva em markdown…" />
      <div className="flex justify-end"><Button variant="primary" disabled={pending}>Criar nota</Button></div>
    </form>
  );
}

function EventForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = React.useState({ title: "", date: today(), startTime: "09:00", endTime: "10:00", allDay: false, location: "" });
  const [pending, start] = React.useTransition();
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveEvent(null, { title: form.title, date: form.date, startTime: form.allDay ? null : form.startTime, endTime: form.allDay ? null : form.endTime, allDay: form.allDay, location: form.location || null });
          toast.success("Compromisso criado");
          onDone();
        });
      }}
      className="space-y-3"
    >
      <Input autoFocus required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Título do compromisso" />
      <div className="grid grid-cols-3 gap-2">
        <Field label="Data" className="col-span-3 sm:col-span-1"><Input type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Início"><Input type="time" disabled={form.allDay} value={form.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field>
        <Field label="Fim"><Input type="time" disabled={form.allDay} value={form.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field>
      </div>
      <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Local (opcional)" />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={form.allDay} onChange={(e) => set("allDay", e.target.checked)} className="accent-[var(--accent)]" /> Dia inteiro
        </label>
        <Button variant="primary" disabled={pending || !form.title.trim()}>Criar</Button>
      </div>
    </form>
  );
}

export const TX_CATEGORIES = {
  despesa: ["Alimentação", "Moradia", "Transporte", "Saúde", "Academia", "Lazer", "Educação", "Assinaturas", "Empresa", "Dívidas", "Compras", "Outros"],
  receita: ["Salário", "AG LABS", "Freela", "Vendas", "Investimentos", "Outros"],
};

function TxForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = React.useState({ kind: "despesa" as "despesa" | "receita", description: "", amount: "", category: "Alimentação", date: today() });
  const [pending, start] = React.useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveTransaction(null, { ...form, amount: Number(form.amount.replace(",", ".")) });
          toast.success("Lançamento registrado");
          onDone();
        });
      }}
      className="space-y-3"
    >
      <Segmented value={form.kind} onChange={(kind) => setForm((f) => ({ ...f, kind, category: TX_CATEGORIES[kind][0] }))} options={[{ value: "despesa", label: "Despesa" }, { value: "receita", label: "Receita" }]} />
      <Input autoFocus required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descrição" />
      <div className="grid grid-cols-3 gap-2">
        <Input required inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="R$ 0,00" />
        <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
          {TX_CATEGORIES[form.kind].map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
      </div>
      <div className="flex justify-end"><Button variant="primary" disabled={pending}>Registrar</Button></div>
    </form>
  );
}
