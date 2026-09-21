// ─── Ledger on-device database ──────────────────────────────────────────────
// One JSON document in SQLite. `loadDB()` hands back a cached, mutable object
// so the engine can stay synchronous exactly like the web build; persistence is
// debounced and flushed when the app backgrounds.

import { todayISO } from "@/lib/dates";
import { kvGet, kvSet } from "@/lib/storage";
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

export const DB_KEY = "ledger-db-v1";
const OPENED_ON_KEY = "ledger-opened-on-v1";

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

let cache: LocalDB | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let listeners: ((db: LocalDB) => void)[] = [];

/** Subscribe to persisted writes — used by the notification engine to re-plan. */
export function onDBPersist(fn: (db: LocalDB) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function hydrate(raw: string | null): LocalDB {
  const base = defaultDB();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalDB>;
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      streakState: { ...base.streakState, ...(parsed.streakState ?? {}) },
      tags: Array.isArray(parsed.tags) ? parsed.tags : base.tags,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
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
  } catch {
    return base;
  }
}

/** Cached, mutable view of the database. Never returns null. */
export function loadDB(): LocalDB {
  if (!cache) cache = hydrate(kvGet(DB_KEY));
  return cache;
}

function persistNow(): void {
  if (!cache) return;
  kvSet(DB_KEY, JSON.stringify(cache));
  const snapshot = cache;
  for (const fn of [...listeners]) {
    try {
      fn(snapshot);
    } catch {
      // listener errors must never break a write
    }
  }
}

export function saveDB(db: LocalDB): void {
  cache = db;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistNow();
  }, 220);
}

/** Force an immediate write (app backgrounding, export, alarm scheduling). */
export function flushDB(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  persistNow();
}

/** Re-read from disk (used after a backup import). */
export function reloadDB(): LocalDB {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  cache = hydrate(kvGet(DB_KEY));
  return cache;
}

/** Replace the whole document — the import path of Settings → Backup. */
export function replaceDB(next: Partial<LocalDB>): LocalDB {
  const merged = hydrate(JSON.stringify({ ...loadDB(), ...next }));
  cache = merged;
  persistNow();
  return merged;
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
  const existing = kvGet(OPENED_ON_KEY);
  if (existing) return existing;
  const today = todayISO();
  kvSet(OPENED_ON_KEY, today);
  return today;
}
