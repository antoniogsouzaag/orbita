import { normalize } from "./text";
import { shiftDate, weekday } from "./dates";

export type ParsedTask = {
  title: string;
  tags: string[];
  priority: number;
  dueDate: string | null;
  dueTime: string | null;
  projectQuery: string | null;
};

const WEEKDAYS: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, "segunda-feira": 1, seg: 1,
  terca: 2, "terca-feira": 2, ter: 2,
  quarta: 3, "quarta-feira": 3, qua: 3,
  quinta: 4, "quinta-feira": 4, qui: 4,
  sexta: 5, "sexta-feira": 5, sex: 5,
  sabado: 6, sab: 6,
};

const PRIORITIES: Record<string, number> = { alta: 3, urgente: 3, media: 2, baixa: 1, "3": 3, "2": 2, "1": 1 };

/**
 * Interpreta a captura rápida:
 * `Revisar proposta #empresa !alta amanhã 15h @barberias`
 * → título, tags, prioridade, data, hora e projeto.
 */
export function parseTaskInput(input: string, ref: string): ParsedTask {
  let text = ` ${input.trim()} `;
  const tags: string[] = [];
  let priority = 0;
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let projectQuery: string | null = null;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    text = text.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpMatchArray;
      return fn(m) === false ? m[0] : " ";
    });
  };

  // #tags
  take(/\s#([\p{L}\p{N}_-]+)/gu, (m) => {
    const t = normalize(m[1]);
    if (!tags.includes(t)) tags.push(t);
  });

  // !prioridade
  take(/\s!([\p{L}\p{N}]+)/gu, (m) => {
    const p = PRIORITIES[normalize(m[1])];
    if (p === undefined) return false;
    priority = p;
  });

  // @projeto
  take(/\s@([\p{L}\p{N}_.-]+)/gu, (m) => {
    projectQuery = m[1];
  });

  // hora: 15h, 15h30, 15:30, às 9h
  take(/\s(?:[àa]s\s+)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?=\s)/giu, (m) => {
    const h = Number(m[1]);
    const min = Number(m[2] ?? m[3] ?? 0);
    if (h > 23 || min > 59) return false;
    dueTime = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  });

  // datas relativas
  take(/\sdepois\s+de\s+amanh[ãa](?=\s)/giu, () => {
    dueDate = shiftDate(ref, 2);
  });
  take(/\s(hoje|amanh[ãa])(?=\s)/giu, (m) => {
    if (dueDate) return false;
    dueDate = normalize(m[1]) === "hoje" ? ref : shiftDate(ref, 1);
  });
  take(/\sem\s+(\d{1,3})\s+dias?(?=\s)/giu, (m) => {
    if (dueDate) return false;
    dueDate = shiftDate(ref, Number(m[1]));
  });
  take(/\s(?:pr[óo]xim[ao]\s+)?(domingo|segunda(?:-feira)?|ter[çc]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[áa]bado)(?=\s)/giu, (m) => {
    if (dueDate) return false;
    const target = WEEKDAYS[normalize(m[1])];
    if (target === undefined) return false;
    let diff = (target - weekday(ref) + 7) % 7;
    if (diff === 0) diff = 7;
    dueDate = shiftDate(ref, diff);
  });
  // dd/mm ou dd/mm/aaaa
  take(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/gu, (m) => {
    if (dueDate) return false;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return false;
    let y = m[3] ? Number(m[3]) : Number(ref.slice(0, 4));
    if (y < 100) y += 2000;
    let iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!m[3] && iso < ref) iso = `${y + 1}${iso.slice(4)}`;
    dueDate = iso;
  });

  if (dueTime && !dueDate) dueDate = ref;

  const title = text.replace(/\s+/g, " ").trim();
  return { title, tags, priority, dueDate, dueTime, projectQuery };
}

/** Escolhe o projeto que melhor corresponde a `@consulta`. */
export function matchProject<T extends { id: string; name: string }>(query: string | null, projects: T[]): T | undefined {
  if (!query) return undefined;
  const q = normalize(query).replace(/[-_.]/g, " ");
  const compact = q.replace(/\s/g, "");
  return (
    projects.find((p) => normalize(p.name) === q) ??
    projects.find((p) => normalize(p.name).replace(/\s/g, "") === compact) ??
    projects.find((p) => normalize(p.name).startsWith(q)) ??
    projects.find((p) => normalize(p.name).replace(/\s/g, "").includes(compact))
  );
}
