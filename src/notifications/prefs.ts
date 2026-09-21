// ─── Notification preferences + delivery bookkeeping ────────────────────────
// Small, separate documents so a corrupt schedule can never take the planner
// database down with it.

import { kvDelete, kvGet, kvSet } from "@/lib/storage";

const PREFS_KEY = "ledger-notif-prefs-v1";
const OUTBOX_KEY = "ledger-notif-outbox-v1";
const LOG_KEY = "ledger-notif-log-v1";
const SCHEDULED_KEY = "ledger-notif-scheduled-v1";
const EXTRAS_KEY = "ledger-alarm-extras-v1";
const SNOOZE_KEY = "ledger-notif-snoozes-v1";

export interface NotificationPrefs {
  /** Master switch for time-based task alarms. */
  alarms: boolean;
  reminders: boolean;
  ritualReminders: boolean;
  /** Ask for battery-optimisation exemption (critical on Xiaomi/Oppo/Vivo). */
  aggressiveDelivery: boolean;
  /** Bypass Do Not Disturb permission has been requested at least once. */
  dndAsked: boolean;
  exactAlarmAsked: boolean;
  batteryAskedAt: number | null;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  alarms: true,
  reminders: true,
  ritualReminders: true,
  aggressiveDelivery: true,
  dndAsked: false,
  exactAlarmAsked: false,
  batteryAskedAt: null,
};

function readJSON<T>(key: string, fallback: T): T {
  const raw = kvGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    kvSet(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadPrefs(): NotificationPrefs {
  return { ...DEFAULT_PREFS, ...readJSON<Partial<NotificationPrefs>>(PREFS_KEY, {}) };
}

export function savePrefs(patch: Partial<NotificationPrefs>): NotificationPrefs {
  const next = { ...loadPrefs(), ...patch };
  writeJSON(PREFS_KEY, next);
  return next;
}

/** key → expo notification identifier, for reconciliation. */
export type ScheduledMap = Record<string, { id: string; at: number; signature: string }>;

export function loadScheduled(): ScheduledMap {
  return readJSON<ScheduledMap>(SCHEDULED_KEY, {});
}

export function saveScheduled(map: ScheduledMap): void {
  writeJSON(SCHEDULED_KEY, map);
}

export function clearScheduled(): void {
  kvDelete(SCHEDULED_KEY);
}

/** Per-day, per-key "we already told the user this" ledger. */
type NotifyLog = Record<string, number>;

function todayStamp(day: string): string {
  return day;
}

export function alreadyNotified(key: string, day: string): boolean {
  const log = readJSON<NotifyLog>(LOG_KEY, {});
  return Boolean(log[`${todayStamp(day)}:${key}`]);
}

export function markNotified(key: string, day: string): void {
  const log = readJSON<NotifyLog>(LOG_KEY, {});
  log[`${todayStamp(day)}:${key}`] = Date.now();
  // keep the log tiny: only today's entries matter
  for (const k of Object.keys(log)) if (!k.startsWith(day)) delete log[k];
  writeJSON(LOG_KEY, log);
}

/** Snooze counters, capped by MAX_SNOOZES. */
export type SnoozeMap = Record<string, number>;

export function loadSnoozes(): SnoozeMap {
  return readJSON<SnoozeMap>(SNOOZE_KEY, {});
}

export function saveSnoozes(map: SnoozeMap): void {
  writeJSON(SNOOZE_KEY, map);
}

/** Alarms that fired while the app was closed, waiting to be acknowledged. */
export interface OutboxEntry {
  key: string;
  kind: string;
  taskId: number | null;
  ritualId: number | null;
  title: string;
  body: string;
  firedAt: number;
}

export function readOutbox(): OutboxEntry[] {
  return readJSON<OutboxEntry[]>(OUTBOX_KEY, []);
}

export function pushOutbox(entry: OutboxEntry): void {
  const list = readOutbox().filter((e) => e.key !== entry.key);
  list.push(entry);
  writeJSON(OUTBOX_KEY, list.slice(-20));
}

export function dropOutbox(key: string): void {
  const list = readOutbox().filter((e) => e.key !== key);
  writeJSON(OUTBOX_KEY, list);
}

export function clearOutbox(): void {
  kvDelete(OUTBOX_KEY);
}

/** One-off alarms (snoozes) that must survive a full re-plan. */
export interface ExtraAlarm {
  key: string;
  kind: string;
  fireAt: number;
  priority: "alarm" | "reminder" | "brief";
  title: string;
  body: string;
  data: Record<string, string | number | null | undefined>;
}

export function loadExtras(): ExtraAlarm[] {
  const list = readJSON<ExtraAlarm[]>(EXTRAS_KEY, []);
  // Anything already in the past has either fired or been cancelled.
  return list.filter((entry) => entry.fireAt > Date.now() - 60_000);
}

export function saveExtras(list: ExtraAlarm[]): void {
  writeJSON(EXTRAS_KEY, list.slice(-40));
}

export function addExtra(entry: ExtraAlarm): void {
  const list = loadExtras().filter((e) => e.key !== entry.key);
  list.push(entry);
  saveExtras(list);
}

export function dropExtra(key: string): void {
  saveExtras(loadExtras().filter((e) => e.key !== key));
}

export function clearExtras(): void {
  kvDelete(EXTRAS_KEY);
}
