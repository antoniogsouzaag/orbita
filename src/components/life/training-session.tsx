"use client";
import * as React from "react";
import { toast } from "sonner";
import { saveWorkout } from "@/app/actions/life";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pillClass } from "@/components/ui/pill";
import { today } from "@/lib/dates";
import type { TrainingPlan } from "@/lib/training";
import { ExerciseVisual } from "./exercise-visual";

export function TrainingSession({ plan, close }: { plan: TrainingPlan; close: () => void }) {
 const [exercises,setExercises] = React.useState(plan.exercises.map((item)=>({...item})));
 const [index,setIndex] = React.useState(0);
 const [sets,setSets] = React.useState<number[]>(plan.exercises.map(()=>0));
 const [restUntil,setRestUntil] = React.useState<number|null>(null);
 const [now,setNow] = React.useState(0);
 const [started] = React.useState(()=>Date.now());
 const [date] = React.useState(()=>today());
 const [pending,start] = React.useTransition();
 const [saved,setSaved] = React.useState(false);
 React.useEffect(()=> { if (!restUntil) return; const timer=setInterval(()=>setNow(Date.now()),250); return ()=>clearInterval(timer); },[restUntil]);
 const exercise=exercises[index];
 const total=exercises.reduce((n,e)=>n+(e.sets??1),0);
 const done=sets.reduce((n,value)=>n+value,0);
 const remaining=restUntil ? Math.max(0,Math.ceil((restUntil-now)/1000)):0;
 const complete=done===total;
 function finishSet() { if (sets[index]>=(exercise.sets??1)) return; setSets((old)=>old.map((value,i)=>i===index ? value+1:value)); const stamp=Date.now();setNow(stamp);setRestUntil(exercise.rest ? stamp+exercise.rest*1000:null); }
 return <Dialog open onOpenChange={(open)=>{if(!open&&!pending) close();}}><DialogContent wide title={saved ? "Treino registrado" : plan.name} description="Sessão guiada · avance no seu ritmo">
 {saved ? <div className="space-y-4 py-6 text-center"><p className="text-2xl">✓</p><p className="font-semibold">Mais um treino no seu histórico</p><p className="text-sm text-muted">{total} séries concluídas. Seu registro foi salvo.</p><Button onClick={close}>Fechar sessão</Button></div> : <div className="space-y-4">
 <div className="flex justify-between text-xs text-muted"><span>Exercício {index+1} de {exercises.length}</span><span>{done}/{total} séries</span></div><progress aria-label="Progresso do treino" value={done} max={total} className="h-2 w-full accent-[var(--accent)]" />
 <div className="flex flex-wrap gap-2">{exercises.map((item,i)=><button type="button" key={i} onClick={()=>{setIndex(i);setRestUntil(null);}} aria-current={i===index ? "step":undefined} className={pillClass(i===index, "h-7")}>{sets[i]===(item.sets??1) ? "✓":i+1} · {item.name}</button>)}</div>
 <div className="grid gap-5 sm:grid-cols-2"><ExerciseVisual key={exercise.name} exercise={exercise}/><div className="space-y-3"><h3 className="text-xl font-semibold">{exercise.name}</h3><p className="text-sm text-accent">{exercise.sets??1} séries · {exercise.reps||"No seu ritmo"}</p><ol className="space-y-2 text-sm leading-relaxed text-muted">{(exercise.instructions||"Siga a orientação do seu instrutor.").split(/(?<=[.!?])\s+/).map((step,i)=><li key={i}><span className="mr-2 text-accent">{i+1}.</span>{step}</li>)}</ol><label className="block text-xs text-muted">Carga utilizada<Input value={exercise.load??""} maxLength={40} placeholder="Ex.: 10 kg" onChange={(event)=>setExercises((old)=>old.map((item,i)=>i===index ? {...item,load:event.target.value}:item))}/></label><p className="text-xs text-muted">Séries deste exercício: {sets[index]}/{exercise.sets??1}</p></div></div>
 {remaining>0 ? <div className="flex items-center justify-between rounded-xl bg-accent/10 p-4"><p role="timer" className="text-lg font-medium">Descanso · {remaining}s</p><Button size="sm" onClick={()=>setRestUntil(null)}>Encerrar descanso</Button></div> : <Button className="w-full" variant="primary" disabled={sets[index]>=(exercise.sets??1)} onClick={finishSet}>Concluir série {Math.min(sets[index]+1,exercise.sets??1)}</Button>}
 <div className="flex flex-wrap justify-between gap-2"><Button disabled={index===0} onClick={()=>{setIndex(index-1);setRestUntil(null);}}>Anterior</Button>{index<exercises.length-1 && <Button onClick={()=>{setIndex(index+1);setRestUntil(null);}}>Próximo exercício</Button>}<Button disabled={!complete||pending} variant="primary" onClick={()=>start(async()=>{try {await saveWorkout(null,{date,name:plan.name,minutes:Math.max(1,Math.round((Date.now()-started)/60000)),exercises,notes:"Sessão guiada concluída"});setSaved(true);} catch {toast.error("Não foi possível salvar. Mantenha a sessão aberta e tente novamente.");}})}>{pending ? "Salvando…":"Finalizar e salvar treino"}</Button></div><p className="text-[11px] text-faint">Só a conclusão salva o treino. Fechar antes descarta esta sessão.</p>
 </div>}</DialogContent></Dialog>;
}
