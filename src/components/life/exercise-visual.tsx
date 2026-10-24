"use client";
import * as React from "react";
import { trainingVideoEmbed } from "@/lib/training";
import type { WorkoutExercise } from "@/db/schema";

// Ilustrações esquemáticas locais: posições inicial/final, sem associação por imagem genérica.
const poses: Record<string, [string, string]> = {
 "Agachamento até o banco": ["M100 55 L100 110 L85 145 L85 180 M100 110 L125 145 L125 180 M100 70 L65 95 L45 90", "M85 70 L100 115 L145 120 L145 180 M100 115 L110 145 L90 180 M90 85 L55 100 L40 95"],
 "Supino na máquina": ["M80 60 L80 125 L120 125 L130 180 M80 75 L110 90 L100 65", "M80 60 L80 125 L120 125 L130 180 M80 75 L115 75 L150 75"],
 "Remada sentada": ["M80 65 L80 130 L125 150 L160 180 M80 80 L120 85 L155 85", "M80 65 L80 130 L125 150 L160 180 M80 80 L105 105 L75 110"],
 "Elevação de panturrilhas": ["M100 55 L100 115 L90 150 L90 180 L110 180 M100 115 L120 150 L120 180 M100 75 L140 80", "M100 40 L100 100 L90 135 L90 165 L110 180 M100 100 L120 135 L120 165 M100 60 L140 65"],
 "Leg press": ["M55 100 L85 140 L125 120 L145 155 L170 135 M70 120 L100 100", "M55 100 L85 140 L125 100 L160 60 M70 120 L100 100"],
 "Puxada pela frente": ["M100 65 L100 125 L140 125 L140 180 M100 75 L65 45 L65 25 M100 75 L135 45 L135 25", "M100 65 L100 125 L140 125 L140 180 M100 75 L65 100 L65 75 M100 75 L135 100 L135 75"],
 "Flexão na parede": ["M95 65 L75 130 L65 180 M90 80 L145 80 L165 80", "M140 65 L105 130 L65 180 M135 80 L140 105 L165 80"],
 "Ponte de quadril": ["M40 160 L95 160 L130 120 L165 175 M65 160 L90 175", "M40 160 L95 115 L130 120 L165 175 M65 140 L90 175"],
};
export function ExerciseVisual({ exercise }: { exercise: WorkoutExercise }) {
 const [frame,setFrame] = React.useState(0);
 const embed = exercise.demoUrl ? trainingVideoEmbed(exercise.demoUrl) : null;
 const pose = poses[exercise.name];
 if (embed) return <iframe className="aspect-video w-full rounded-xl" src={embed} title={`Demonstração de ${exercise.name}`} sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />;
 if (!pose) return <div className="rounded-xl bg-accent/5 p-6 text-center"><p className="text-sm font-medium">{exercise.name}</p><p className="mt-2 text-xs text-muted">{exercise.name.includes("Caminhada") || exercise.name === "Desaceleração" ? "Passos confortáveis · mantenha o ritmo indicado abaixo" : "Adicione o vídeo do seu instrutor ao editar este exercício."}</p></div>;
 const head = exercise.name === "Ponte de quadril" ? [30,153] : exercise.name === "Leg press" ? [46,88] : exercise.name === "Agachamento até o banco" && frame ? [82,55] : exercise.name === "Flexão na parede" ? [frame ? 145:100,50] : exercise.name === "Elevação de panturrilhas" ? [100,frame ? 25:40] : [exercise.name === "Supino na máquina" || exercise.name === "Remada sentada" ? 80:100,45];
 return <div className="overflow-hidden rounded-xl border border-accent/15 bg-gradient-to-br from-accent/10 to-surface"><svg viewBox="0 0 220 205" role="img" aria-label={`${exercise.name}: posição ${frame ? "final" : "inicial"}`} className="mx-auto h-52 w-full text-accent"><path d="M20 185H200" stroke="currentColor" opacity=".2" /><path d={pose[frame]} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><circle cx={head[0]} cy={head[1]} r="12" fill="currentColor" />{exercise.name === "Flexão na parede" && <path d="M172 25V185" stroke="currentColor" opacity=".35" strokeWidth="5" />}</svg><div className="flex justify-center gap-2 p-3">{[0,1].map((value)=><button type="button" key={value} aria-pressed={frame===value} onClick={()=>setFrame(value)} className={`rounded-full px-3 py-1 text-xs ${frame===value ? "bg-accent text-accent-fg":"bg-surface-2 text-muted"}`}>{value ? "2 · Movimento":"1 · Preparação"}</button>)}</div><p className="px-4 pb-3 text-center text-[10px] text-faint">Ilustração esquemática · confira o ajuste com seu instrutor</p></div>;
}
