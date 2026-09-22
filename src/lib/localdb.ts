// ─── Kairos on-device database (localStorage) ───────────────────────────────

import { addDays, localDT, todayISO } from "@/lib/dates";
import {
  DEFAULT_STREAK_SETTINGS,
  DEFAULT_STREAK_STATE,
  TAG_PALETTE,
  type CommitmentStatus,
  type DayRecordDTO,
  type HabitDTO,
  type HabitLogDTO,
  type IntentDTO,
  type Priority,
  type ScheduleConfig,
  type ScheduleType,
  type SessionDTO,
  type StreakSettingsDTO,
  type StreakStateDTO,
  type TagDTO,
  type TaskDTO,
  type TenureUnit,
  type VacationBehavior,
} from "@/lib/types";

export const DB_KEY = "kairos-db-v1";
const OPENED_ON_KEY = "kairos-opened-on-v1";

export interface LocalRitual {
  id: number;
  name: string;
  icon: string;
  category: string;
}

export interface LocalCommitment {
  id: number;
  ritualId: number;
  tenureValue: number;
  tenureUnit: TenureUnit;
  startDate: string;
  status: CommitmentStatus;
  vacationBehavior: VacationBehavior;
  closeReason: string | null;
  closedAt: string | null;
}

export interface LocalVersion {
  id: number;
  commitmentId: number;
  effectiveFrom: string;
  type: ScheduleType;
  config: ScheduleConfig;
  priority: Priority;
}

export type InstanceStatus = "PENDING" | "DONE" | "MISSED" | "VACATION" | "NEUTRAL" | "CANCELLED";

export interface LocalInstance {
  id: number;
  commitmentId: number;
  ritualId: number;
  dueDate: string;
  status: InstanceStatus;
  taskId: number | null;
  /** Monday ISO of the week */
  weekKey: string;
  prioritySnapshot: Priority;
}

export interface LocalDB {
  v: number;
  profile: { name: string };
  openedOn: string;
  nextId: number;
  tagPalette: number;
  tags: TagDTO[];
  tasks: TaskDTO[];
  habits: HabitDTO[];
  logs: HabitLogDTO[];
  sessions: SessionDTO[];
  intents: IntentDTO[];
  records: DayRecordDTO[];
  vacations: string[];
  settings: StreakSettingsDTO;
  streakState: StreakStateDTO;
  rituals: LocalRitual[];
  commitments: LocalCommitment[];
  versions: LocalVersion[];
  instances: LocalInstance[];
}

function defaultDB(): LocalDB {
  return {
    v: 1,
    profile: { name: "" },
    openedOn: todayISO(),
    nextId: 1,
    tagPalette: 0,
    tags: [
      { name: "work", color: "sky" },
      { name: "personal", color: "lilac" },
      { name: "health", color: "mint" },
      { name: "learning", color: "gold" },
      { name: "home", color: "coral" },
    ],
    tasks: [],
    habits: [],
    logs: [],
    sessions: [],
    intents: [],
    records: [],
    vacations: [],
    settings: { ...DEFAULT_STREAK_SETTINGS },
    streakState: { ...DEFAULT_STREAK_STATE },
    rituals: [],
    commitments: [],
    versions: [],
    instances: [],
  };
}

export function loadDB(): LocalDB {
  if (typeof window === "undefined") return defaultDB();
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) {
      const db = defaultDB();
      seedDemo(db);
      saveDB(db);
      return db;
    }
    const parsed = JSON.parse(raw) as Partial<LocalDB>;
    const base = defaultDB();
    const db: LocalDB = {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      streakState: { ...base.streakState, ...(parsed.streakState ?? {}) },
      tags: Array.isArray(parsed.tags) ? parsed.tags : base.tags,
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks.map((t) => ({ ...t, deadline: typeof t.deadline === "string" ? t.deadline : null }))
        : [],
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      intents: Array.isArray(parsed.intents) ? parsed.intents : [],
      records: Array.isArray(parsed.records) ? parsed.records : [],
      vacations: Array.isArray(parsed.vacations) ? parsed.vacations : [],
      rituals: Array.isArray(parsed.rituals) ? parsed.rituals : [],
      commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
      versions: Array.isArray(parsed.versions) ? parsed.versions : [],
      instances: Array.isArray(parsed.instances) ? parsed.instances : [],
    };
    seedDemo(db);
    return db;
  } catch {
    const db = defaultDB();
    saveDB(db);
    return db;
  }
}

const SEED_KEY = "ledger-seed-v1";

/** One-time demo leftovers so the carry-forward flow can be felt immediately. */
function seedDemo(db: LocalDB): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(SEED_KEY)) return;
  } catch {
    return;
  }
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const mk = (
    title: string,
    day: string,
    priority: Priority,
    tag: string,
    extra?: { time?: string; deadline?: string }
  ) => {
    db.tasks.push({
      id: nextId(db),
      title,
      notes: "",
      day,
      time: extra?.time ?? null,
      priority,
      tag,
      done: false,
      doneAt: null,
      carries: 0,
      missed: false,
      ritualInstanceId: null,
      ritualId: null,
      createdAt: localDT(new Date()).slice(0, 16),
      deadline: extra?.deadline ?? null,
    });
  };
  mk("Ship the weekly report", yesterday, 2, "work", { deadline: addDays(today, 2) });
  mk("Stretch for ten minutes", yesterday, 2, "health", { deadline: addDays(today, 4) });
  mk("Clear the reading list", yesterday, 3, "learning");
  mk("Deep work block", today, 1, "work", { time: "10:00" });
  mk("Evening pages", today, 2, "personal", { deadline: addDays(today, 3) });
  saveDB(db);
  try {
    window.localStorage.setItem(SEED_KEY, "1");
  } catch {
    // ignore
  }
}

export function saveDB(db: LocalDB): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // storage full / unavailable — keep running in memory
  }
}

export function nextId(db: LocalDB): number {
  const id = db.nextId;
  db.nextId += 1;
  return id;
}

export function nextTagColor(db: LocalDB): string {
  const color = TAG_PALETTE[db.tagPalette % TAG_PALETTE.length];
  db.tagPalette += 1;
  return color;
}

export function setProfileName(db: LocalDB, name: string): void {
  db.profile.name = name;
  saveDB(db);
}

/** First day the app was ever opened (persisted separately from the DB blob). */
export function ensureOpenedOn(): string {
  if (typeof window === "undefined") return todayISO();
  try {
    const existing = window.localStorage.getItem(OPENED_ON_KEY);
    if (existing) return existing;
    const today = todayISO();
    window.localStorage.setItem(OPENED_ON_KEY, today);
    return today;
  } catch {
    return todayISO();
  }
}
