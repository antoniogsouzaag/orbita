const MORNING = ["O que vamos fazer hoje?", "Bora começar?", "Qual é a prioridade de hoje?"];
const AFTERNOON = ["O que vem agora?", "Como está o ritmo?", "Seguimos firme?"];
const EVENING = ["Como fechamos o dia?", "Hora de revisar o dia?", "O que ainda cabe hoje?"];

function pick(list: string[], seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

export function greeting(name: string, hour: number, seed: string): string {
  const first = name.split(" ")[0] || name;
  if (hour < 5) return `Ainda por aqui, ${first}?`;
  if (hour < 12) return `Bom dia, ${first}. ${pick(MORNING, seed)}`;
  if (hour < 18) return `Boa tarde, ${first}. ${pick(AFTERNOON, seed)}`;
  return `Boa noite, ${first}. ${pick(EVENING, seed)}`;
}
