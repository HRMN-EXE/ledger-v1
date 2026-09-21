// ─── Alarm planner ──────────────────────────────────────────────────────────
// Pure function: database + settings in, the exact list of OS alarms out.
// No React, no native calls — which is what lets the same code run inside the
// headless background task when the app is closed.

import { fmtTime, fromISO, todayISO } from "@/lib/dates";
import type { LocalDB } from "@/lib/localdb";
import { inQuietHours } from "@/lib/streak-engine";
import type { StreakSettingsDTO, TaskDTO } from "@/lib/types";
import type { NotificationPrefs } from "./prefs";

export type AlarmKind =
  | "TASK_ALARM"
  | "TASK_REMINDER"
  | "MUST_LEAD"
  | "MORNING_BRIEF"
  | "EVENING_CHECKIN"
  | "FINAL_WARNING"
  | "RITUAL"
  | "FOCUS_END";

export type AlarmPriority = "alarm" | "reminder" | "brief";

export interface PlannedAlarm {
  /** Stable identity — survives re-planning, used to cancel/replace. */
  key: string;
  kind: AlarmKind;
  fireAt: number;
  priority: AlarmPriority;
  title: string;
  body: string;
  data: {
    kind: AlarmKind;
    key: string;
    day: string;
    taskId?: number;
    ritualId?: number;
    time?: string | null;
  };
}

export interface PlanOptions {
  /** How many days ahead to keep materialised (OS alarm limits are finite). */
  horizonDays?: number;
  /** Hard cap on pending OS alarms. */
  max?: number;
  prefs: NotificationPrefs;
}

const REMINDER_LEAD_MIN = 5;
const MUST_LEAD_MIN = 30;
const MORNING_BRIEF_MIN = 8 * 60; // 08:00 local
const RITUAL_DEFAULT_MIN = 9 * 60; // 09:00 local for rituals with no time
const STALE_GRACE_MS = 10 * 60 * 1000;

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function timeOn(day: string, minutes: number): number {
  const d = fromISO(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.getTime();
}

function cutoffMinutes(settings: StreakSettingsDTO): number {
  return minutesOf(settings.cutoffTime || "23:59");
}

function isPending(task: TaskDTO): boolean {
  return !task.done && !task.missed;
}

function obligationsOn(db: LocalDB, day: string): TaskDTO[] {
  return db.tasks.filter((t) => t.day === day && isPending(t) && (t.priority === 1 || t.priority === 2));
}

function summarize(day: string, tasks: TaskDTO[]): string {
  const musts = tasks.filter((t) => t.priority === 1).length;
  const shoulds = tasks.filter((t) => t.priority === 2).length;
  const coulds = tasks.filter((t) => t.priority === 3).length;
  const parts: string[] = [];
  if (musts) parts.push(`${musts} must`);
  if (shoulds) parts.push(`${shoulds} should`);
  if (coulds) parts.push(`${coulds} could`);
  const label = day === todayISO() ? "today" : "that day";
  return `${tasks.length} task(s) ${label} — ${parts.join(", ") || "all clear"}.`;
}

/**
 * Build every alarm Ledger should have pending in the OS right now.
 * Deterministic: same inputs → same output, so reconciliation is a cheap diff.
 */
export function planAlarms(db: LocalDB, now: Date, options: PlanOptions): PlannedAlarm[] {
  const { prefs } = options;
  const horizonDays = options.horizonDays ?? 8;
  const max = options.max ?? 60;
  const settings = db.settings;
  const today = todayISO();
  const nowMs = now.getTime();

  const out = new Map<string, PlannedAlarm>();

  const push = (alarm: PlannedAlarm) => {
    if (alarm.fireAt <= nowMs + 1500) return; // never schedule into the past
    if (out.has(alarm.key)) return;
    if (inQuietHours(new Date(alarm.fireAt), settings) && alarm.priority !== "alarm") return;
    out.set(alarm.key, alarm);
  };

  const d = fromISO(today);
  const days: string[] = [];
  for (let i = 0; i <= horizonDays; i++) {
    days.push(todayISO_of(d, i));
  }

  // ── Task alarms ───────────────────────────────────────────────────────────
  if (prefs.alarms || prefs.reminders) {
    for (const day of days) {
      for (const task of db.tasks) {
        if (task.day !== day || !isPending(task) || !task.time) continue;
        const due = timeOn(day, minutesOf(task.time));
        const stamp = fmtTime(task.time) ?? task.time;
        const sig = `${task.id}:${day}:${task.time}`;
        const priorityLabel = task.priority === 1 ? "Must" : task.priority === 2 ? "Should" : "Could";

        if (prefs.reminders && settings.taskReminders) {
          push({
            key: `rem:${sig}`,
            kind: "TASK_REMINDER",
            fireAt: due - REMINDER_LEAD_MIN * 60_000,
            priority: "reminder",
            title: "Coming up",
            body: `${task.title} at ${stamp}`,
            data: { kind: "TASK_REMINDER", key: `rem:${sig}`, day, taskId: task.id, time: task.time },
          });
        }

        if (task.priority === 1 && settings.streakWarnings) {
          push({
            key: `lead:${sig}`,
            kind: "MUST_LEAD",
            fireAt: due - MUST_LEAD_MIN * 60_000,
            priority: "brief",
            title: "Must task in 30 minutes",
            body: task.title,
            data: { kind: "MUST_LEAD", key: `lead:${sig}`, day, taskId: task.id, time: task.time },
          });
        }

        if (prefs.alarms) {
          push({
            key: `alarm:${sig}`,
            kind: "TASK_ALARM",
            fireAt: due,
            // "could" tasks ring softly, must/should ring like an alarm clock
            priority: task.priority === 3 ? "reminder" : "alarm",
            title: task.title,
            body: task.notes
              ? `${priorityLabel} · ${stamp} · ${task.notes}`
              : `${priorityLabel} · ${stamp}${task.tag ? ` · ${task.tag}` : ""}`,
            data: { kind: "TASK_ALARM", key: `alarm:${sig}`, day, taskId: task.id, time: task.time },
          });
        }
      }
    }
  }

  // ── Rituals that never had a time of their own ───────────────────────────
  if (prefs.ritualReminders) {
    for (const day of days) {
      for (const inst of db.instances) {
        if (inst.dueDate !== day || inst.status !== "PENDING" || inst.taskId == null) continue;
        const versions = db.versions
          .filter((v) => v.commitmentId === inst.commitmentId)
          .sort((a, b) => a.id - b.id);
        const latest = versions[versions.length - 1];
        if (!latest || latest.config.time) continue; // timed rituals are task alarms
        const ritual = db.rituals.find((r) => r.id === inst.ritualId);
        if (!ritual) continue;
        push({
          key: `ritual:${inst.id}`,
          kind: "RITUAL",
          fireAt: timeOn(day, RITUAL_DEFAULT_MIN),
          priority: "reminder",
          title: `${ritual.icon} ${ritual.name}`.trim(),
          body: "Today's ritual is waiting.",
          data: { kind: "RITUAL", key: `ritual:${inst.id}`, day, taskId: inst.taskId, ritualId: inst.ritualId },
        });
      }
    }
  }

  // ── Streak rhythm: morning brief, evening check-in, final warning ────────
  const cutoff = cutoffMinutes(settings);
  const streakDays = days.slice(0, 4);
  for (const day of streakDays) {
    const pending = db.tasks.filter((t) => t.day === day && isPending(t) && (t.priority === 1 || t.priority === 2));
    const anyTask = db.tasks.some((t) => t.day === day && isPending(t));

    if (settings.morningBrief && prefs.reminders && anyTask) {
      const tasks = db.tasks.filter((t) => t.day === day && isPending(t));
      push({
        key: `brief:${day}`,
        kind: "MORNING_BRIEF",
        fireAt: timeOn(day, MORNING_BRIEF_MIN),
        priority: "brief",
        title: "Good morning ☀️",
        body: summarize(day, tasks),
        data: { kind: "MORNING_BRIEF", key: `brief:${day}`, day },
      });
    }

    if (settings.streakWarnings && pending.length > 0) {
      if (settings.eveningCheckin) {
        push({
          key: `evening:${day}`,
          kind: "EVENING_CHECKIN",
          fireAt: timeOn(day, cutoff - 180),
          priority: "brief",
          title: "Evening check-in",
          body: `${pending.length} task(s) left before the ${settings.cutoffTime} cutoff.`,
          data: { kind: "EVENING_CHECKIN", key: `evening:${day}`, day },
        });
      }
      if (settings.finalWarning) {
        push({
          key: `final:${day}`,
          kind: "FINAL_WARNING",
          fireAt: timeOn(day, cutoff - 30),
          priority: "brief",
          title: "Final warning",
          body: `${pending.length} task(s) — cutoff is ${settings.cutoffTime}.`,
          data: { kind: "FINAL_WARNING", key: `final:${day}`, day },
        });
      }
    }
  }

  return [...out.values()].sort((a, b) => a.fireAt - b.fireAt).slice(0, max);
}

/** `todayISO()` style date string for day `offset` days from `base`. */
function todayISO_of(base: Date, offset: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Human summary used by the Settings → Alarms screen. */
export function describeNextAlarms(planned: PlannedAlarm[], limit = 6): PlannedAlarm[] {
  return planned.slice(0, limit);
}

export function obligationsRemaining(db: LocalDB, day: string): number {
  return obligationsOn(db, day).filter((t) => !t.done).length;
}
