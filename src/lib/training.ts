import { z } from "zod";

export function trainingVideoEmbed(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname) ? url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.startsWith("/shorts/") ? url.pathname.split("/")[2] : null : null;
    return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

export const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sets: z.number().int().min(1).max(30).optional(),
  reps: z.string().max(40).optional(),
  load: z.string().max(40).optional(),
  instructions: z.string().max(1500).optional(),
  rest: z.number().int().min(0).max(600).optional(),
  demoUrl: z.string().max(500).refine((value) => !value || trainingVideoEmbed(value) !== null, "Use um link HTTPS de vídeo do YouTube.").optional(),
});
export const trainingPlanSchema = z.object({
  name: z.string().trim().min(1).max(160),
  minutes: z.number().int().min(1).max(240),
  notes: z.string().max(4000),
  exercises: z.array(exerciseSchema).min(1).max(60),
});
export type TrainingPlan = z.infer<typeof trainingPlanSchema> & { id: string };

// Modelos educativos: só uma conclusão explícita entra no histórico de treino.
export const TRAINING_BASES: TrainingPlan[] = [
  { id: "base-a", name: "Corpo inteiro A", minutes: 40, notes: "Base para adaptar com o instrutor. Aqueça por 5–10 min. Use carga leve, com movimentos controlados e sem dor. Alterne A e B em dias não consecutivos.", exercises: [
    { name: "Agachamento até o banco", sets: 2, reps: "8–12", rest: 90, instructions: "Pés na largura dos ombros. Leve o quadril para trás, sente suavemente no banco e levante apoiando todo o pé. Joelhos acompanham a direção dos pés." },
    { name: "Supino na máquina", sets: 2, reps: "8–12", rest: 90, instructions: "Ajuste o banco para que as alças fiquem na altura do peito. Mantenha costas apoiadas, empurre sem travar os cotovelos e retorne devagar." },
    { name: "Remada sentada", sets: 2, reps: "8–12", rest: 90, instructions: "Mantenha tronco estável e peito aberto. Traga as alças em direção ao abdômen sem jogar o corpo para trás; retorne controlando o movimento." },
    { name: "Elevação de panturrilhas", sets: 2, reps: "10–15", rest: 60, instructions: "Com apoio para equilíbrio, eleve os calcanhares sem impulsos e abaixe devagar. Use uma amplitude confortável." },
  ] },
  { id: "base-b", name: "Corpo inteiro B", minutes: 40, notes: "Base para adaptar com o instrutor. Faça 5–10 min de aquecimento e uma série leve de ensaio. Priorize técnica e uma amplitude confortável; não treine até a falha.", exercises: [
    { name: "Leg press", sets: 2, reps: "8–12", rest: 90, instructions: "Ajuste o banco com ajuda do instrutor. Mantenha quadril e costas apoiados. Flexione sem tirar a lombar do encosto e empurre sem travar os joelhos." },
    { name: "Puxada pela frente", sets: 2, reps: "8–12", rest: 90, instructions: "Ajuste o apoio das coxas. Traga a barra pela frente até uma altura confortável, sem puxar atrás da nuca nem balançar o tronco. Retorne devagar." },
    { name: "Flexão na parede", sets: 2, reps: "8–12", rest: 60, instructions: "Apoie as mãos na parede na altura do peito. Corpo alinhado, flexione os cotovelos aproximando o peito e empurre a parede. Ajuste a distância dos pés à dificuldade." },
    { name: "Ponte de quadril", sets: 2, reps: "10–12", rest: 60, instructions: "Deitado, joelhos flexionados e pés no chão. Eleve o quadril sem arquear a lombar, contraia os glúteos e abaixe de forma controlada." },
  ] },
  { id: "base-cardio", name: "Caminhada progressiva", minutes: 25, notes: "Modelo leve para adaptar ao seu condicionamento. Mantenha um ritmo em que consiga conversar. Interrompa se houver dor, tontura ou mal-estar.", exercises: [
    { name: "Caminhada leve", sets: 1, reps: "5 min", rest: 0, instructions: "Comece devagar, com passos confortáveis e respiração natural." },
    { name: "Caminhada moderada", sets: 1, reps: "15 min", rest: 0, instructions: "Aumente o ritmo gradualmente, mantendo a capacidade de conversar. Diminua o ritmo se necessário." },
    { name: "Desaceleração", sets: 1, reps: "5 min", rest: 0, instructions: "Reduza o ritmo aos poucos até terminar confortavelmente." },
  ] },
];
