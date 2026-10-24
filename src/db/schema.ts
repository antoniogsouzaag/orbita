import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Áreas da vida usadas em projetos, metas e sequências. */
export const AREAS = ["pessoal", "empresa", "estudos", "saude", "financas"] as const;
export type Area = (typeof AREAS)[number];

export const projects = pgTable("projects", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#3b82f6"),
  icon: text("icon"),
  area: text("area").$type<Area>().notNull().default("pessoal"),
  archived: boolean("archived").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
});

export const TASK_STATUS = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];
export const TASK_SCOPES = ["pessoal", "empresa"] as const;
export type TaskScope = (typeof TASK_SCOPES)[number];

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    notes: text("notes"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, { onDelete: "cascade" }),
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    /** pessoal | empresa — separa a vida pessoal do trabalho da AG LABS */
    scope: text("scope").$type<TaskScope>().notNull().default("pessoal"),
    /** 0 nenhuma · 1 baixa · 2 média · 3 alta */
    priority: smallint("priority").notNull().default(0),
    dueDate: date("due_date"),
    dueTime: text("due_time"),
    tags: text("tags").array().notNull().default([]),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_status_due_idx").on(t.status, t.dueDate), index("tasks_parent_idx").on(t.parentId), index("tasks_scope_idx").on(t.scope, t.status)],
);

export const goals = pgTable("goals", {
  id: id(),
  title: text("title").notNull(),
  emoji: text("emoji"),
  description: text("description"),
  area: text("area").$type<Area>().notNull().default("pessoal"),
  /** percent | number | currency */
  metric: text("metric").notNull().default("percent"),
  current: numeric("current", { mode: "number" }).notNull().default(0),
  target: numeric("target", { mode: "number" }).notNull().default(100),
  unit: text("unit"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("ativa"),
  color: text("color").notNull().default("#a78bfa"),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
});

export const habits = pgTable("habits", {
  id: id(),
  name: text("name").notNull(),
  emoji: text("emoji"),
  color: text("color").notNull().default("#22d3ee"),
  area: text("area").$type<Area>().notNull().default("pessoal"),
  /** daily: todos os dias (ou só os dias em `weekdays`) · weekly: N vezes por semana */
  frequency: text("frequency").notNull().default("daily"),
  timesPerWeek: smallint("times_per_week").notNull().default(7),
  /** 0=domingo … 6=sábado. Vazio = todos os dias. */
  weekdays: smallint("weekdays").array().notNull().default([]),
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
  archived: boolean("archived").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
});

export const habitLogs = pgTable(
  "habit_logs",
  {
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.date] })],
);

export const calendars = pgTable("calendars", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#22c55e"),
  /** local | ics */
  kind: text("kind").notNull().default("local"),
  url: text("url"),
  enabled: boolean("enabled").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: createdAt(),
});

export const events = pgTable(
  "events",
  {
    id: id(),
    calendarId: uuid("calendar_id").references(() => calendars.id, { onDelete: "cascade" }),
    externalUid: text("external_uid"),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    color: text("color"),
    createdAt: createdAt(),
  },
  (t) => [index("events_start_idx").on(t.startAt), index("events_calendar_idx").on(t.calendarId)],
);

export const notes = pgTable("notes", {
  id: id(),
  title: text("title").notNull().default("Sem título"),
  content: text("content").notNull().default(""),
  pinned: boolean("pinned").notNull().default(false),
  tags: text("tags").array().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checkins = pgTable("checkins", {
  date: date("date").primaryKey(),
  mood: smallint("mood"),
  energy: smallint("energy"),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const focusSessions = pgTable("focus_sessions", {
  id: id(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  minutes: integer("minutes").notNull(),
  label: text("label"),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
});

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    date: date("date").notNull(),
    description: text("description").notNull(),
    /** receita | despesa */
    kind: text("kind").notNull(),
    amount: numeric("amount", { mode: "number" }).notNull(),
    category: text("category").notNull().default("Outros"),
    createdAt: createdAt(),
  },
  (t) => [index("transactions_date_idx").on(t.date)],
);

export type WorkoutExercise = { name: string; sets?: number; reps?: string; load?: string; instructions?: string; rest?: number; demoUrl?: string };

export const workouts = pgTable("workouts", {
  id: id(),
  date: date("date").notNull(),
  name: text("name").notNull(),
  minutes: integer("minutes"),
  exercises: jsonb("exercises").$type<WorkoutExercise[]>().notNull().default([]),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const books = pgTable("books", {
  id: id(),
  title: text("title").notNull(),
  author: text("author"),
  totalPages: integer("total_pages"),
  currentPage: integer("current_page").notNull().default(0),
  /** quero | lendo | lido */
  status: text("status").notNull().default("lendo"),
  startedAt: date("started_at"),
  finishedAt: date("finished_at"),
  createdAt: createdAt(),
});

export type PlanBlock = { start: string; end: string; title: string; kind: string; note?: string };

export const dayPlans = pgTable("day_plans", {
  date: date("date").primaryKey(),
  blocks: jsonb("blocks").$type<PlanBlock[]>().notNull().default([]),
  summary: text("summary"),
  prompt: text("prompt"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type Calendar = typeof calendars.$inferSelect;
export type CalendarEvent = typeof events.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Checkin = typeof checkins.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type Book = typeof books.$inferSelect;
export type DayPlan = typeof dayPlans.$inferSelect;

/* ───────────── Operação ao vivo (dados enviados pelo n8n) ───────────── */

export const opsStatus = pgTable("ops_status", {
  url: text("url").primaryKey(),
  name: text("name").notNull(),
  group: text("group"),
  ok: boolean("ok").notNull(),
  statusCode: integer("status_code"),
  error: text("error"),
  latencyMs: integer("latency_ms"),
  /** Falhas consecutivas (queda só é confirmada a partir de 2). */
  fails: integer("fails").notNull().default(0),
  source: text("source").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  /** Desde quando está no estado atual (no ar / fora). */
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
});

export const opsEvents = pgTable(
  "ops_events",
  {
    id: id(),
    /** site_down | site_up | workflow_error | domain_alert | monitor_silent | info */
    kind: text("kind").notNull(),
    severity: text("severity").notNull().default("info"),
    source: text("source").notNull(),
    subject: text("subject").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("ops_events_created_idx").on(t.createdAt)],
);

export const opsHeartbeats = pgTable("ops_heartbeats", {
  source: text("source").primaryKey(),
  label: text("label"),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
  /** Intervalo esperado entre batidas, em minutos (para detectar silêncio). */
  everyMinutes: integer("every_minutes").notNull().default(15),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
});

export const opsDomains = pgTable("ops_domains", {
  domain: text("domain").primaryKey(),
  depends: text("depends"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  error: text("error"),
  source: text("source").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
});

export type OpsStatus = typeof opsStatus.$inferSelect;
export type OpsEvent = typeof opsEvents.$inferSelect;
export type OpsHeartbeat = typeof opsHeartbeats.$inferSelect;
export type OpsDomain = typeof opsDomains.$inferSelect;

/* ───────────── Agentes (acesso via MCP) ───────────── */

export const AGENT_SCOPES = ["contexto", "status", "tarefas", "eventos", "admin"] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

export const agentTokens = pgTable("agent_tokens", {
  id: id(),
  /** Nome do agente (ex.: Hermes Oracle, Tom, Claude Code). */
  name: text("name").notNull(),
  /** SHA-256 do token; o token em si só é mostrado na criação. */
  tokenHash: text("token_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  scopes: text("scopes").array().$type<AgentScope[]>().notNull().default([]),
  revoked: boolean("revoked").notNull().default(false),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const agentActivity = pgTable(
  "agent_activity",
  {
    id: id(),
    agent: text("agent").notNull(),
    tool: text("tool").notNull(),
    summary: text("summary").notNull(),
    ok: boolean("ok").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("agent_activity_created_idx").on(t.createdAt)],
);

export type AgentToken = typeof agentTokens.$inferSelect;
export type AgentActivity = typeof agentActivity.$inferSelect;

/* ───────────── Pedidos aos diretores (Órbita → runtimes) ───────────── */

/** Runtimes que recebem pedidos da Órbita. O id do pedido é o mesmo request_id/Idempotency-Key enviado. */
export const DISPATCH_TARGETS = ["openclaw", "hermes"] as const;
export type DispatchTarget = (typeof DISPATCH_TARGETS)[number];
/** sending → accepted | rejected | unknown; depois o agente informa running → completed | failed. */
export const DISPATCH_STATUSES = ["sending", "accepted", "rejected", "unknown", "running", "completed", "failed", "scheduled", "interrupted", "due"] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export const dispatches = pgTable(
  "dispatches",
  {
    id: uuid("id").primaryKey(),
    target: text("target").$type<DispatchTarget>().notNull(),
    action: text("action").notNull(),
    params: jsonb("params").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").$type<DispatchStatus>().notNull(),
    /** Mensagem da admissão (HTTP) ou do último estado; nunca inclui segredo. */
    detail: text("detail").notNull().default(""),
    /** Resumo e evidência informados pelo agente em registrar_resultado. */
    summary: text("summary"),
    evidence: text("evidence"),
    reportedBy: text("reported_by"),
    runId: text("run_id"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("dispatches_target_created_idx").on(t.target, t.createdAt)],
);

export type Dispatch = typeof dispatches.$inferSelect;
