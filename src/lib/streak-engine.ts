// ─── Streak engine — single source of truth ─────────────────────────────────
// Idempotent: days that already have a record are never reprocessed.

import { addDays, fromISO, toISO, todayISO } from "@/lib/dates";
import { isObligation, pendingCarryTasks } from "@/lib/streak";
import {
  PERFECT_RUN_TARGET,
  PROTECTION_MAX,
  VACATION_LIMIT_PER_YEAR,
  type DayRecordDTO,
  type RecordStatus,
  type StreakSettingsDTO,
  type StreakStateDTO,
  type TaskDTO,
} from "@/lib/types";

export interface StreakEvent {
  type: "gift" | "protected" | "earned" | "broken" | "perfect" | "vacation-capped";
  message: string;
}

export interface EvalInput {
  now: Date;
  tasks: TaskDTO[];
  state: StreakStateDTO;
  records: Record<string, DayRecordDTO>;
  vacationDays: Set<string>;
  settings: StreakSettingsDTO;
}

export interface EvalResult {
  state: StreakStateDTO;
  newRecords: DayRecordDTO[];
  vacationAdds: string[];
  events: StreakEvent[];
  changed: boolean;
  /** obligation tasks the engine auto-missed while sealing their day */
  missedTaskIds: number[];
}

export function cutoffFor(day: string, settings: StreakSettingsDTO): Date {
  const d = fromISO(day);
  const [h, m] = (settings.cutoffTime || "23:59").split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function isVacationDay(day: string, vacationDays: Set<string>, openStart: string | null): boolean {
  return vacationDays.has(day) || (openStart != null && day >= openStart);
}

export function expandRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 400) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return out;
}

export function vacationUsageInYear(vacationDays: Set<string>, year: string): number {
  let n = 0;
  for (const day of vacationDays) if (day.startsWith(year)) n++;
  return n;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function inQuietHours(now: Date, settings: StreakSettingsDTO): boolean {
  const { quietStart, quietEnd } = settings;
  if (!quietStart || !quietEnd) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = minutesOf(quietStart);
  const e = minutesOf(quietEnd);
  if (s === e) return false;
  if (s < e) return cur >= s && cur < e;
  return cur >= s || cur < e; // wraps midnight
}

export function evaluateDueDays(input: EvalInput): EvalResult {
  const { now, tasks, settings } = input;
  const state: StreakStateDTO = { ...input.state };
  const records: Record<string, DayRecordDTO> = { ...input.records };
  const vacationDays = new Set(input.vacationDays);
  const newRecords: DayRecordDTO[] = [];
  const vacationAdds: string[] = [];
  const events: StreakEvent[] = [];
  const missedTaskIds: number[] = [];
  let giftChanged = false;

  const addRecord = (day: string, status: RecordStatus, note: string) => {
    const rec: DayRecordDTO = { day, status, streakAfter: state.streak, note };
    records[day] = rec;
    newRecords.push(rec);
  };

  // Onboarding gift: one protection, granted once.
  if (!state.giftClaimed) {
    state.giftClaimed = true;
    state.protections = Math.min(PROTECTION_MAX, state.protections + 1);
    giftChanged = true;
    events.push({ type: "gift", message: "Welcome gift: 1 streak protection" });
  }

  const today = toISO(now);

  // Materialize an open-ended vacation day by day (until yearly cap).
  if (state.vacationOpenStart) {
    let cursor = state.vacationOpenStart;
    let guard = 0;
    while (cursor <= today && guard < 400) {
      if (!vacationDays.has(cursor)) {
        const year = cursor.slice(0, 4);
        if (vacationUsageInYear(vacationDays, year) >= VACATION_LIMIT_PER_YEAR) {
          state.vacationOpenStart = null;
          events.push({ type: "vacation-capped", message: "Vacation limit reached — streak is live again" });
          break;
        }
        vacationDays.add(cursor);
        vacationAdds.push(cursor);
      }
      cursor = addDays(cursor, 1);
      guard++;
    }
  }

  const obligations = tasks.filter(isObligation);
  if (obligations.length === 0) {
    return {
      state,
      newRecords,
      vacationAdds,
      events,
      missedTaskIds,
      changed: giftChanged || vacationAdds.length > 0,
    };
  }

  let minDay = obligations[0].day;
  for (const t of obligations) if (t.day < minDay) minDay = t.day;

  const todayEnded = now.getTime() >= cutoffFor(today, settings).getTime();
  const endDay = todayEnded ? today : addDays(today, -1);

  let cursor = minDay;
  let guard = 0;
  while (cursor <= endDay && guard < 500) {
    guard++;
    if (records[cursor]) {
      cursor = addDays(cursor, 1);
      continue;
    }

    if (isVacationDay(cursor, vacationDays, state.vacationOpenStart)) {
      addRecord(cursor, "VACATION", "Vacation — streak frozen");
      cursor = addDays(cursor, 1);
      continue;
    }

    const oblig = tasks.filter((t) => t.day === cursor && isObligation(t));

    if (oblig.length === 0) {
      const hadAnyTask = tasks.some((t) => t.day === cursor);
      const status: RecordStatus = hadAnyTask ? "NEUTRAL" : "INACTIVE";
      const prev = records[addDays(cursor, -1)];
      if (prev && (prev.status === "INACTIVE" || prev.status === "NEUTRAL") && state.streak > 0) {
        state.streak = 0;
        state.perfectRun = 0;
        addRecord(cursor, status, "Second consecutive inactive day — streak reset");
        events.push({ type: "broken", message: "Streak reset — two quiet days in a row" });
      } else {
        state.perfectRun = 0;
        addRecord(cursor, status, hadAnyTask ? "No must/should tasks — neutral day" : "No tasks — inactive day");
      }
      cursor = addDays(cursor, 1);
      continue;
    }

    const doneCount = oblig.filter((t) => t.done).length;
    const missedCount = oblig.filter((t) => t.missed).length;
    const unresolved = oblig.length - doneCount - missedCount;

    if (unresolved > 0) {
      if (state.protections > 0) {
        state.protections -= 1;
        state.perfectRun = 0;
        addRecord(cursor, "PROTECTED", "Unfinished tasks — protection used");
        events.push({ type: "protected", message: "−1 shield · protection spent — day saved" });
        // seal task-level state too: no zombies in the resolver
        for (const t of oblig) {
          if (!t.done && !t.missed) missedTaskIds.push(t.id);
        }
      }
      // No protection: day stays pending until tasks are carried/missed/done.
      cursor = addDays(cursor, 1);
      continue;
    }

    if (missedCount > 0) {
      if (state.protections > 0) {
        state.protections -= 1;
        state.perfectRun = 0;
        addRecord(cursor, "PROTECTED", `${missedCount} missed — protection used`);
        events.push({ type: "protected", message: "−1 shield · protection spent — day saved" });
      } else {
        state.streak = 0;
        state.perfectRun = 0;
        addRecord(cursor, "MISSED", `${missedCount} must/should task(s) missed`);
        events.push({ type: "broken", message: "Streak broken — a must/should slipped" });
      }
      cursor = addDays(cursor, 1);
      continue;
    }

    // All obligations done.
    state.streak += 1;
    state.longest = Math.max(state.longest, state.streak);
    state.perfectRun += 1;
    let note = `All ${doneCount} must/should task(s) completed`;
    if (state.perfectRun >= PERFECT_RUN_TARGET && state.protections < PROTECTION_MAX) {
      state.protections += 1;
      state.perfectRun = 0;
      events.push({ type: "earned", message: "15 perfect days — protection earned" });
      note += " · protection earned";
    }
    addRecord(cursor, "PERFECT", note);
    events.push({ type: "perfect", message: "Day sealed — streak grows" });
    cursor = addDays(cursor, 1);
  }

  const changed =
    giftChanged ||
    newRecords.length > 0 ||
    vacationAdds.length > 0 ||
    missedTaskIds.length > 0 ||
    JSON.stringify(state) !== JSON.stringify(input.state);

  return { state, newRecords, vacationAdds, events, missedTaskIds, changed };
}

// ─── Live status for today ──────────────────────────────────────────────────

export type StreakStatusKind =
  | "SAFE"
  | "AT_RISK"
  | "FINAL_WARNING"
  | "VACATION"
  | "INACTIVE"
  | "INACTIVE_WARNING"
  | "PROTECTED";

export interface StreakStatus {
  kind: StreakStatusKind;
  headline: string;
  detail: string;
  requiredTotal: number;
  requiredDone: number;
  remaining: number;
  mustRemaining: number;
  shouldRemaining: number;
  minutesToCutoff: number;
  pendingDays: number;
}

export function getStreakStatus(input: EvalInput): StreakStatus {
  const { now, tasks, state, records, vacationDays, settings } = input;
  const today = todayISO();

  if (isVacationDay(today, vacationDays, state.vacationOpenStart)) {
    return {
      kind: "VACATION",
      headline: "On vacation",
      detail: "Streak frozen — enjoy the break.",
      requiredTotal: 0,
      requiredDone: 0,
      remaining: 0,
      mustRemaining: 0,
      shouldRemaining: 0,
      minutesToCutoff: 0,
      pendingDays: 0,
    };
  }

  const required = tasks.filter((t) => isObligation(t) && t.day === today);
  const requiredTotal = required.length;
  const requiredDone = required.filter((t) => t.done).length;
  const remaining = requiredTotal - requiredDone;
  const mustRemaining = required.filter((t) => t.priority === 1 && !t.done && !t.missed).length;
  const shouldRemaining = required.filter((t) => t.priority === 2 && !t.done && !t.missed).length;
  const minutesToCutoff = Math.max(0, (cutoffFor(today, settings).getTime() - now.getTime()) / 60000);
  const pendingDays = pendingCarryTasks(tasks, today).length;

  const base = { requiredTotal, requiredDone, remaining, mustRemaining, shouldRemaining, minutesToCutoff, pendingDays };

  if (requiredTotal === 0) {
    const prev = records[addDays(today, -1)];
    if (prev && (prev.status === "INACTIVE" || prev.status === "NEUTRAL")) {
      return {
        ...base,
        kind: "INACTIVE_WARNING",
        headline: "Quiet again",
        detail: "A second quiet day in a row resets the streak.",
      };
    }
    return {
      ...base,
      kind: "INACTIVE",
      headline: "Nothing scheduled",
      detail: "Add a must or should task to keep the flame alive.",
    };
  }

  if (remaining === 0) {
    return {
      ...base,
      kind: "SAFE",
      headline: "All clear",
      detail: `${requiredTotal} obligation(s) honored today.`,
    };
  }

  if (minutesToCutoff <= 30) {
    return {
      ...base,
      kind: "FINAL_WARNING",
      headline: "Final warning",
      detail: `${remaining} left — the day is almost over.`,
    };
  }

  if (minutesToCutoff <= 180) {
    return {
      ...base,
      kind: "AT_RISK",
      headline: "At risk",
      detail: `${remaining} pending — close them tonight.`,
    };
  }

  if (state.protections > 0) {
    return {
      ...base,
      kind: "PROTECTED",
      headline: "Behind, but shielded",
      detail: `${remaining} pending · shield active.`,
    };
  }

  return {
    ...base,
    kind: "AT_RISK",
    headline: "Open obligations",
    detail: `${remaining} must/should task(s) still pending today.`,
  };
}
