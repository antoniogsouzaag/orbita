"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/card";

type Point = { label: string; tasks: number; habits: number | null; focus: number; mood: number | null; energy: number | null; spend: number };

const tip = { contentStyle: { background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 10, fontSize: 12 }, cursor: { fill: "var(--surface-2)" } };
const axis = { tick: { fontSize: 10.5, fill: "var(--muted)" }, axisLine: false, tickLine: false } as const;

export function ReviewCharts({ data }: { data: Point[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Tarefas concluídas por dia" />
        <div className="h-52 px-2 pb-4"><ResponsiveContainer><BarChart data={data}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="label" {...axis} interval={4} /><YAxis {...axis} width={28} allowDecimals={false} /><Tooltip {...tip} /><Bar dataKey="tasks" name="Tarefas" fill="var(--accent)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </Card>
      <Card>
        <CardHeader title="Hábitos cumpridos (%)" />
        <div className="h-52 px-2 pb-4"><ResponsiveContainer><AreaChart data={data}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="label" {...axis} interval={4} /><YAxis {...axis} width={32} domain={[0, 100]} /><Tooltip {...tip} /><Area dataKey="habits" name="Hábitos %" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} connectNulls /></AreaChart></ResponsiveContainer></div>
      </Card>
      <Card>
        <CardHeader title="Humor e energia" />
        <div className="h-52 px-2 pb-4"><ResponsiveContainer><LineChart data={data}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="label" {...axis} interval={4} /><YAxis {...axis} width={24} domain={[1, 5]} ticks={[1, 3, 5]} /><Tooltip {...tip} /><Line dataKey="mood" name="Humor" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2.5 }} connectNulls /><Line dataKey="energy" name="Energia" stroke="#22d3ee" strokeWidth={2} dot={{ r: 2.5 }} connectNulls /></LineChart></ResponsiveContainer></div>
      </Card>
      <Card>
        <CardHeader title="Minutos de foco" />
        <div className="h-52 px-2 pb-4"><ResponsiveContainer><BarChart data={data}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="label" {...axis} interval={4} /><YAxis {...axis} width={32} /><Tooltip {...tip} /><Bar dataKey="focus" name="Foco (min)" fill="#a78bfa" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </Card>
    </div>
  );
}
