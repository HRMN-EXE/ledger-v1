// ─── Ledger offline engine — same api() contract, zero network ──────────────

import { localDT, todayISO } from "@/lib/dates";
import { loadDB, nextId, nextTagColor, saveDB, type LocalDB } from "@/lib/localdb";
import { buildDTOs, localRitualSync, SCHEDULE_TYPES, weekKey } from "@/lib/local-rituals";
import {
  CARRY_LIMIT,
  type DayRecordDTO,
  type HabitInput,
  type Priority,
  type ScheduleConfig,
  type ScheduleType,
  type TaskDTO,
  type TaskInput,
  type TenureUnit,
} from "@/lib/types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any;

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function parseBody(init?: RequestInit): Body {
  if (!init?.body) return {};
  try {
    return JSON.parse(String(init.body));
  } catch {
    return {};
  }
}

function sanitizePriority(v: unknown): Priority {
  const n = num(v, 2);
  return n === 1 || n === 2 || n === 3 ? n : 2;
}

function sanitizeConfig(type: ScheduleType, raw: Body): ScheduleConfig {
  const cfg: ScheduleConfig = {};
  if (type === "days") {
    cfg.days = Array.isArray(raw?.days)
      ? raw.days.map((d: unknown) => num(d, 0)).filter((d: number) => d >= 0 && d <= 6)
      : [];
  }
  if (type === "every_n") cfg.every = Math.max(1, num(raw?.every, 1));
  if (type === "monthly") cfg.monthDay = Math.min(31, Math.max(1, num(raw?.monthDay, 1)));
  if (type === "flex_week") cfg.n = Math.min(7, Math.max(1, num(raw?.n, 1)));
  const t = raw?.time;
  cfg.time = typeof t === "string" && /^\d{2}:\d{2}$/.test(t) ? t : null;
  return cfg;
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

function createTask(db: LocalDB, body: Body): TaskDTO {
  const title = String(body?.title ?? "").trim();
  if (!title) throw new HttpError(400, "Title is required");
  const task: TaskDTO = {
    id: nextId(db),
    title,
    notes: String(body?.notes ?? ""),
    day: typeof body?.day === "string" ? body.day : todayISO(),
    time: null,
    priority: sanitizePriority(body?.priority),
    tag: typeof body?.tag === "string" && body.tag ? body.tag : "personal",
    done: false,
    doneAt: null,
    carries: 0,
    missed: false,
    ritualInstanceId: null,
    ritualId: null,
    createdAt: localDT(new Date()).slice(0, 16),
  };
  db.tasks.push(task);
  saveDB(db);
  return task;
}

function patchTask(db: LocalDB, id: number, body: Body): TaskDTO {
  const row = db.tasks.find((t) => t.id === id);
  if (!row) throw new HttpError(404, "Task not found");
  const today = todayISO();

  if (body?.done === false && row.done) {
    throw new HttpError(403, "Completed tasks are final");
  }

  const inst = row.ritualInstanceId != null ? db.instances.find((i) => i.id === row.ritualInstanceId) : null;
  if (inst) {
    if (body?.done === true && row.day !== today) {
      throw new HttpError(403, "Ritual instances are completed on their due date");
    }
    if (body?.done === false && inst.status === "DONE") {
      throw new HttpError(403, "Ticked rituals are final");
    }
  }

  if (body?.title != null) {
    const title = String(body.title).trim();
    if (title) row.title = title;
  }
  if (body?.day != null && typeof body.day === "string") row.day = body.day;
  if (body?.time !== undefined) {
    row.time = typeof body.time === "string" && /^\d{2}:\d{2}$/.test(body.time) ? body.time : null;
  }
  if (body?.priority != null) row.priority = sanitizePriority(body.priority);
  if (body?.tag != null && typeof body.tag === "string") row.tag = body.tag;
  if (body?.notes != null) row.notes = String(body.notes);

  if (body?.done === true) {
    row.done = true;
    row.doneAt = localDT(new Date()).slice(0, 16);
    row.missed = false;
  }
  if (body?.done === false) {
    row.done = false;
    row.doneAt = null;
  }
  if (body?.missed === true) {
    row.missed = true;
    row.done = false;
    row.doneAt = null;
  }
  if (body?.carries != null) {
    row.carries = Math.min(CARRY_LIMIT, Math.max(0, num(body.carries, 0)));
  }

  if (inst) {
    if (row.done) inst.status = "DONE";
    else if (row.missed) inst.status = "MISSED";
    else inst.status = "PENDING";
    if (inst.status === "PENDING" && inst.dueDate !== row.day) {
      inst.dueDate = row.day;
      inst.weekKey = weekKey(row.day);
    }
  }

  saveDB(db);
  localRitualSync();
  return row;
}

function deleteTask(db: LocalDB, id: number): void {
  const row = db.tasks.find((t) => t.id === id);
  if (!row) return;
  if (row.ritualInstanceId != null) throw new HttpError(403, "Ritual tasks can't be deleted here");
  if (row.done) throw new HttpError(403, "Completed tasks can't be deleted");
  db.tasks = db.tasks.filter((t) => t.id !== id);
  saveDB(db);
}

// ─── Rituals ────────────────────────────────────────────────────────────────

function createRitual(db: LocalDB, body: Body): { duplicate?: { id: number; name: string }; created?: number } {
  const name = String(body?.name ?? "").trim();
  if (!name) throw new HttpError(400, "Name is required");
  const scheduleType = body?.scheduleType as ScheduleType;
  if (!SCHEDULE_TYPES.includes(scheduleType)) throw new HttpError(400, "Invalid schedule type");
  let tenureUnit = body?.tenureUnit as TenureUnit;
  if (!["DAY", "WEEK", "MONTH", "YEAR"].includes(tenureUnit)) tenureUnit = "MONTH";
  const tenureValue = Math.min(3650, Math.max(1, num(body?.tenureValue, 6)));
  const force = Boolean(body?.force);

  if (!force) {
    const dup = db.rituals.find(
      (r) =>
        r.name.toLowerCase() === name.toLowerCase() &&
        db.commitments.some((c) => c.ritualId === r.id && c.status === "ACTIVE")
    );
    if (dup) return { duplicate: { id: dup.id, name: dup.name } };
  }

  const today = todayISO();
  const ritual = {
    id: nextId(db),
    name,
    icon: typeof body?.icon === "string" && body.icon ? body.icon : "●",
    category: typeof body?.category === "string" && body.category ? body.category : "personal",
  };
  db.rituals.push(ritual);

  const commitment = {
    id: nextId(db),
    ritualId: ritual.id,
    tenureValue,
    tenureUnit,
    startDate: today,
    status: "ACTIVE" as const,
    vacationBehavior: (body?.vacationBehavior === "continue" ? "continue" : "pause") as "pause" | "continue",
    closeReason: null,
    closedAt: null,
  };
  db.commitments.push(commitment);

  db.versions.push({
    id: nextId(db),
    commitmentId: commitment.id,
    effectiveFrom: today,
    type: scheduleType,
    config: sanitizeConfig(scheduleType, body?.config),
    priority: sanitizePriority(body?.priority),
  });

  saveDB(db);
  localRitualSync();
  return { created: ritual.id };
}

function ritualAction(db: LocalDB, ritualId: number, body: Body): void {
  const ritual = db.rituals.find((r) => r.id === ritualId);
  if (!ritual) throw new HttpError(404, "Ritual not found");
  const commitments = db.commitments.filter((c) => c.ritualId === ritualId).sort((a, b) => a.id - b.id);
  const current = commitments[commitments.length - 1];
  const action = String(body?.action ?? "");
  const payload = body?.payload ?? {};
  const today = todayISO();

  if (action === "edit") {
    if (payload.name != null) {
      const name = String(payload.name).trim();
      if (name) ritual.name = name;
    }
    if (payload.icon != null && String(payload.icon)) ritual.icon = String(payload.icon);
    if (payload.category != null && String(payload.category)) ritual.category = String(payload.category);
    if (current) {
      if (payload.vacationBehavior === "continue" || payload.vacationBehavior === "pause") {
        current.vacationBehavior = payload.vacationBehavior;
      }
      const scheduleType = payload.scheduleType as ScheduleType;
      if (SCHEDULE_TYPES.includes(scheduleType)) {
        db.versions.push({
          id: nextId(db),
          commitmentId: current.id,
          effectiveFrom: today,
          type: scheduleType,
          config: sanitizeConfig(scheduleType, payload.config),
          priority: sanitizePriority(payload.priority),
        });
      }
    }
    saveDB(db);
    localRitualSync();
    return;
  }

  if (!current) throw new HttpError(400, "No commitment");

  if (action === "end-early") {
    if (current.status !== "ACTIVE") throw new HttpError(400, "Commitment is not active");
    current.status = "EARLY_EXIT";
    current.closeReason = typeof payload.reason === "string" && payload.reason ? payload.reason : "Ended early";
    current.closedAt = today;
    saveDB(db);
    localRitualSync();
    return;
  }

  if (action === "archive") {
    current.status = "ARCHIVED";
    current.closeReason = current.closeReason ?? "Archived";
    current.closedAt = today;
    saveDB(db);
    localRitualSync();
    return;
  }

  if (action === "renew") {
    if (current.status === "ACTIVE") throw new HttpError(400, "End the current commitment first");
    const versions = db.versions.filter((v) => v.commitmentId === current.id).sort((a, b) => a.id - b.id);
    const latest = versions[versions.length - 1];
    const commitment = {
      id: nextId(db),
      ritualId: ritual.id,
      tenureValue: current.tenureValue,
      tenureUnit: current.tenureUnit,
      startDate: today,
      status: "ACTIVE" as const,
      vacationBehavior: current.vacationBehavior,
      closeReason: null,
      closedAt: null,
    };
    db.commitments.push(commitment);
    db.versions.push({
      id: nextId(db),
      commitmentId: commitment.id,
      effectiveFrom: today,
      type: latest?.type ?? "daily",
      config: latest?.config ?? {},
      priority: latest?.priority ?? 2,
    });
    saveDB(db);
    localRitualSync();
    return;
  }

  throw new HttpError(400, `Unknown action ${action}`);
}

function deleteRitual(db: LocalDB, ritualId: number): void {
  const commitmentIds = db.commitments.filter((c) => c.ritualId === ritualId).map((c) => c.id);
  const instanceIds = db.instances.filter((i) => i.ritualId === ritualId);
  for (const inst of instanceIds) {
    if (inst.taskId != null) db.tasks = db.tasks.filter((t) => t.id !== inst.taskId);
  }
  db.instances = db.instances.filter((i) => i.ritualId !== ritualId);
  db.versions = db.versions.filter((v) => !commitmentIds.includes(v.commitmentId));
  db.commitments = db.commitments.filter((c) => c.ritualId !== ritualId);
  db.rituals = db.rituals.filter((r) => r.id !== ritualId);
  saveDB(db);
}

// ─── Main entrypoint (async signature, sync localStorage internals) ────────

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const body = parseBody(init);
  const db = loadDB();
  const [route, query] = path.split("?");
  const parts = route.split("/").filter(Boolean); // e.g. ["api","tasks","12"]

  try {
    // ── Tasks
    if (method === "POST" && route === "/api/tasks") return createTask(db, body) as T;
    if (method === "PATCH" && parts[1] === "tasks" && parts[2]) return patchTask(db, Number(parts[2]), body) as T;
    if (method === "DELETE" && parts[1] === "tasks" && parts[2]) {
      deleteTask(db, Number(parts[2]));
      return { ok: true } as T;
    }

    // ── Rituals
    if (method === "POST" && route === "/api/rituals") return createRitual(db, body) as T;
    if (method === "POST" && parts[1] === "rituals" && parts[2] === "sync") {
      localRitualSync();
      const fresh = loadDB();
      return { rituals: buildDTOs(fresh), tasks: fresh.tasks } as T;
    }
    if (method === "POST" && parts[1] === "rituals" && parts[3] === "action") {
      ritualAction(db, Number(parts[2]), body);
      return { ok: true } as T;
    }
    if (method === "DELETE" && parts[1] === "rituals" && parts[2]) {
      deleteRitual(db, Number(parts[2]));
      return { ok: true } as T;
    }

    // ── Habits
    if (method === "POST" && route === "/api/habits") {
      const input = body as HabitInput;
      const habit = {
        id: nextId(db),
        name: String(input?.name ?? "").trim() || "Habit",
        icon: String(input?.icon ?? "🎯"),
        color: String(input?.color ?? "ember"),
        weekTarget: Math.min(7, Math.max(1, num(input?.weekTarget, 3))),
      };
      db.habits.push(habit);
      saveDB(db);
      return habit as T;
    }
    if (method === "POST" && parts[1] === "habits" && parts[3] === "toggle") {
      const habitId = Number(parts[2]);
      const day = typeof body?.day === "string" ? body.day : todayISO();
      const existing = db.logs.find((l) => l.habitId === habitId && l.day === day);
      if (existing) {
        db.logs = db.logs.filter((l) => l.id !== existing.id);
        saveDB(db);
        return { on: false, log: null } as T;
      }
      const log = { id: nextId(db), habitId, day };
      db.logs.push(log);
      saveDB(db);
      return { on: true, log } as T;
    }
    if (method === "DELETE" && parts[1] === "habits" && parts[2]) {
      const habitId = Number(parts[2]);
      db.habits = db.habits.filter((h) => h.id !== habitId);
      db.logs = db.logs.filter((l) => l.habitId !== habitId);
      saveDB(db);
      return { ok: true } as T;
    }

    // ── Intent
    if (method === "POST" && route === "/api/intent") {
      const day = typeof body?.day === "string" ? body.day : todayISO();
      const text = String(body?.text ?? "").trim();
      db.intents = db.intents.filter((i) => i.day !== day);
      if (text) db.intents.push({ day, text });
      saveDB(db);
      return { day, text } as T;
    }

    // ── Focus sessions
    if (method === "POST" && route === "/api/focus") {
      const session = {
        id: nextId(db),
        label: String(body?.label ?? "Focus").trim() || "Focus",
        durationMin: Math.max(1, num(body?.durationMin, 25)),
        startedAt: localDT(new Date()).slice(0, 16),
      };
      db.sessions.unshift(session);
      saveDB(db);
      return session as T;
    }

    // ── Streak state / records / vacation / settings
    if (method === "POST" && route === "/api/streak/state") {
      db.streakState = { ...db.streakState, ...body };
      saveDB(db);
      return db.streakState as T;
    }
    if (method === "POST" && route === "/api/streak/day") {
      const rec = body as DayRecordDTO;
      db.records = db.records.filter((r) => r.day !== rec.day);
      db.records.push(rec);
      saveDB(db);
      return rec as T;
    }
    if (method === "POST" && route === "/api/streak/vacation") {
      if (Array.isArray(body?.addDays)) {
        const set = new Set(db.vacations);
        for (const d of body.addDays) if (typeof d === "string") set.add(d);
        db.vacations = Array.from(set).sort();
      }
      if (typeof body?.removeDay === "string") {
        db.vacations = db.vacations.filter((d) => d !== body.removeDay);
      }
      if (typeof body?.startOpen === "string") {
        db.streakState.vacationOpenStart = body.startOpen;
      }
      if (body?.endOpen === true) {
        db.streakState.vacationOpenStart = null;
      }
      saveDB(db);
      return { vacations: db.vacations, vacationOpenStart: db.streakState.vacationOpenStart } as T;
    }
    if (method === "POST" && route === "/api/streak/settings") {
      db.settings = { ...db.settings, ...body };
      saveDB(db);
      return db.settings as T;
    }

    // ── Tags
    if (method === "DELETE" && parts[1] === "tags" && parts[2]) {
      const name = decodeURIComponent(parts[2]);
      db.tags = db.tags.filter((t) => t.name !== name);
      saveDB(db);
      return { ok: true } as T;
    }
    if (method === "POST" && route === "/api/tags") {
      const name = String(body?.name ?? "").trim().toLowerCase().replace(/\s+/g, "-");
      if (!name) throw new HttpError(400, "Tag name is required");
      if (!db.tags.some((t) => t.name === name)) {
        db.tags.push({ name, color: typeof body?.color === "string" ? body.color : nextTagColor(db) });
        saveDB(db);
      }
      return { name } as T;
    }

    void query;
    throw new HttpError(404, `Unknown route ${method} ${route}`);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, err instanceof Error ? err.message : "Engine failure");
  }
}

export type { TaskInput };
