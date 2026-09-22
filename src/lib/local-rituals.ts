// ─── Ritual engine: commitments → versions → instances → tasks ──────────────

import { addDays, dayNum, fromISO, localDT, todayISO, weekdayMonIndex, weekOf } from "@/lib/dates";
import { loadDB, nextId, saveDB, type LocalDB, type LocalInstance, type LocalVersion } from "@/lib/localdb";
import { diffDays, tenureClock } from "@/lib/tenure";
import type { CommitmentDTO, Priority, RitualDTO, ScheduleConfig, ScheduleType, TaskDTO, WeekCellDTO, WeekCellState } from "@/lib/types";

export const SCHEDULE_TYPES: ScheduleType[] = ["daily", "weekdays", "days", "every_n", "monthly", "flex_week"];
export const TENURE_UNITS = ["DAY", "WEEK", "MONTH", "YEAR"] as const;

export function weekKey(iso: string): string {
  return weekOf(iso)[0];
}

export function scheduleMatches(type: ScheduleType, config: ScheduleConfig, day: string, startDate: string): boolean {
  switch (type) {
    case "daily":
      return true;
    case "weekdays":
      return weekdayMonIndex(day) < 5;
    case "days":
      return (config.days ?? []).includes(weekdayMonIndex(day));
    case "every_n": {
      const every = Math.max(1, config.every ?? 1);
      return diffDays(startDate, day) % every === 0;
    }
    case "monthly":
      return dayNum(day) === (config.monthDay ?? 1);
    case "flex_week":
      return true; // generated daily, pruned by weekly target
    default:
      return false;
  }
}

function latestVersion(db: LocalDB, commitmentId: number): LocalVersion | null {
  const versions = db.versions.filter((v) => v.commitmentId === commitmentId).sort((a, b) => a.id - b.id);
  return versions[versions.length - 1] ?? null;
}

function vacationSetFor(db: LocalDB): { vacSet: Set<string>; openStart: string | null } {
  return { vacSet: new Set(db.vacations), openStart: db.streakState.vacationOpenStart };
}

function removeTask(db: LocalDB, taskId: number): void {
  db.tasks = db.tasks.filter((t) => t.id !== taskId);
}

/** Full deterministic pass over the local DB. Mutates + saves. */
export function localRitualSync(): void {
  const db = loadDB();
  const today = todayISO();
  const { vacSet, openStart } = vacationSetFor(db);
  const horizon = addDays(today, 60);

  // Rituals are always a must — normalize any legacy instances.
  for (const t of db.tasks) {
    if (t.ritualInstanceId != null && !t.done && !t.missed && t.priority !== 1) {
      t.priority = 1;
    }
  }

  // Deadline law: a should whose deadline has arrived escalates to a must.
  for (const t of db.tasks) {
    if (t.priority === 2 && t.deadline && t.deadline <= today && !t.done && !t.missed) {
      t.priority = 1;
    }
  }

  for (const c of db.commitments) {
    const latest = latestVersion(db, c.id);
    if (!latest) continue;

    const clock = tenureClock({
      startDate: c.startDate,
      tenureValue: c.tenureValue,
      tenureUnit: c.tenureUnit,
      vacationBehavior: c.vacationBehavior,
      vacationSet: vacSet,
      openStart,
      today,
    });

    if (clock.complete && c.status === "ACTIVE") {
      c.status = "COMPLETE";
      c.closeReason = "Completed";
      c.closedAt = today;
    }

    if (c.status === "ACTIVE") {
      let cursor = c.startDate;
      let guard = 0;
      while (diffDays(cursor, horizon) >= 0 && guard < 400) {
        guard++;
        const matches = scheduleMatches(latest.type, latest.config, cursor, c.startDate);
        if (matches) {
          let inst = db.instances.find((i) => i.commitmentId === c.id && i.dueDate === cursor);
          if (!inst) {
            inst = {
              id: nextId(db),
              commitmentId: c.id,
              ritualId: c.ritualId,
              dueDate: cursor,
              status: "PENDING",
              taskId: null,
              weekKey: weekKey(cursor),
              prioritySnapshot: latest.priority,
            };
            db.instances.push(inst);
          }
          const isVac = vacSet.has(cursor) || (openStart != null && cursor >= openStart);
          if (isVac && c.vacationBehavior === "pause" && inst.status === "PENDING") {
            inst.status = "VACATION";
          } else if (!isVac && inst.status === "VACATION") {
            inst.status = "PENDING";
          }
        }
        cursor = addDays(cursor, 1);
      }
    } else {
      // Closed commitments: cancel anything still pending in the future.
      for (const inst of db.instances.filter((i) => i.commitmentId === c.id)) {
        if (inst.status === "PENDING" && inst.dueDate > today) {
          inst.status = "CANCELLED";
          if (inst.taskId != null) {
            removeTask(db, inst.taskId);
            inst.taskId = null;
          }
        }
      }
    }
  }

  // Link tasks to due instances and reflect task state back onto instances.
  for (const inst of db.instances) {
    if (inst.status === "PENDING" && inst.dueDate <= today && inst.taskId == null) {
      const ritual = db.rituals.find((r) => r.id === inst.ritualId);
      const latest = latestVersion(db, inst.commitmentId);
      const task: TaskDTO = {
        id: nextId(db),
        title: ritual?.name ?? "Ritual",
        notes: "",
        day: inst.dueDate,
        time: latest?.config.time ?? null,
        priority: 1, // rituals are always a must
        tag: ritual?.category ?? "personal",
        done: false,
        doneAt: null,
        carries: 0,
        missed: false,
        ritualInstanceId: inst.id,
        ritualId: inst.ritualId,
        createdAt: localDT(new Date()).slice(0, 16),
        deadline: null,
      };
      db.tasks.push(task);
      inst.taskId = task.id;
    }

    if (inst.taskId != null) {
      const task = db.tasks.find((t) => t.id === inst.taskId);
      if (task) {
        if (task.done && inst.status !== "DONE") inst.status = "DONE";
        else if (task.missed && inst.status !== "MISSED") inst.status = "MISSED";
        // Carried forward: keep the instance on the task's current day.
        if (inst.status === "PENDING" && inst.dueDate !== task.day) {
          inst.dueDate = task.day;
          inst.weekKey = weekKey(task.day);
        }
      }
    }
  }

  // flex_week: weekly target decides which slots are required vs optional.
  for (const c of db.commitments.filter((x) => x.status === "ACTIVE")) {
    const latest = latestVersion(db, c.id);
    if (!latest || latest.type !== "flex_week") continue;
    const target = Math.max(1, latest.config.n ?? 1);
    const insts = db.instances.filter((i) => i.commitmentId === c.id);
    const weeks = new Map<string, LocalInstance[]>();
    for (const i of insts) {
      const arr = weeks.get(i.weekKey) ?? [];
      arr.push(i);
      weeks.set(i.weekKey, arr);
    }
    for (const arr of weeks.values()) {
      const done = arr.filter((i) => i.status === "DONE").length;
      const slots = target - done;
      if (slots <= 0) {
        for (const i of arr.filter((i) => i.status === "PENDING")) {
          i.status = "NEUTRAL";
          if (i.taskId != null) {
            removeTask(db, i.taskId);
            i.taskId = null;
          }
        }
      }
      // rituals never downgrade — extras beyond the weekly target simply
      // stay musts; the slots logic only cancels when the target is met.
    }
  }

  saveDB(db);
}

function commitmentDTO(db: LocalDB, commitmentId: number, no: number, today: string): CommitmentDTO | null {
  const c = db.commitments.find((x) => x.id === commitmentId);
  if (!c) return null;
  const { vacSet, openStart } = vacationSetFor(db);
  const clock = tenureClock({
    startDate: c.startDate,
    tenureValue: c.tenureValue,
    tenureUnit: c.tenureUnit,
    vacationBehavior: c.vacationBehavior,
    vacationSet: vacSet,
    openStart,
    today,
  });
  return {
    id: c.id,
    no,
    tenureValue: c.tenureValue,
    tenureUnit: c.tenureUnit,
    startDate: c.startDate,
    status: c.status,
    vacationBehavior: c.vacationBehavior,
    closeReason: c.closeReason,
    closedAt: c.closedAt,
    ...clock,
  };
}

export function buildDTOs(db?: LocalDB): RitualDTO[] {
  const local = db ?? loadDB();
  const today = todayISO();

  const dtos: RitualDTO[] = local.rituals.map((r) => {
    const commitments = local.commitments.filter((c) => c.ritualId === r.id).sort((a, b) => a.id - b.id);
    const current = commitments[commitments.length - 1] ?? null;

    let commitment: CommitmentDTO | null = null;
    let schedule: RitualDTO["schedule"] = null;
    let week: RitualDTO["week"] = { days: [], done: 0, target: 0 };

    if (current) {
      commitment = commitmentDTO(local, current.id, commitments.length, today);

      const versions = local.versions.filter((v) => v.commitmentId === current.id).sort((a, b) => a.id - b.id);
      const latest = versions[versions.length - 1];
      if (latest) {
        schedule = {
          versionId: latest.id,
          versionNo: versions.length,
          effectiveFrom: latest.effectiveFrom,
          type: latest.type,
          config: latest.config,
          priority: latest.priority,
        };

        const instByDay = new Map<string, LocalInstance>();
        for (const i of local.instances.filter((i) => i.commitmentId === current.id)) instByDay.set(i.dueDate, i);

        const sinceStart = Math.max(0, diffDays(current.startDate, today));
        const windowStart = addDays(current.startDate, Math.floor(sinceStart / 7) * 7);
        const days: WeekCellDTO[] = [];
        let done = 0;
        for (let k = 0; k < 7; k++) {
          const day = addDays(windowStart, k);
          const inst = instByDay.get(day);
          let state: WeekCellState;
          if (!inst) state = "none";
          else if (inst.status === "DONE") state = "done";
          else if (inst.status === "MISSED") state = "missed";
          else if (inst.status === "VACATION") state = "vacation";
          else if (inst.status === "NEUTRAL" || inst.status === "CANCELLED") state = "neutral";
          else state = day === today ? "today" : day < today ? "missed" : "upcoming";
          if (state === "done") done++;
          days.push({ day, state });
        }

        const target =
          latest.type === "flex_week"
            ? Math.max(1, latest.config.n ?? 1)
            : days.filter((c) => c.day >= current.startDate && scheduleMatches(latest.type, latest.config, c.day, current.startDate)).length;

        week = { days, done, target };
      }
    }

    return {
      id: r.id,
      name: r.name,
      icon: r.icon,
      category: r.category,
      commitment,
      history: commitments.map((c, idx) => commitmentDTO(local, c.id, idx + 1, today)).filter((c): c is CommitmentDTO => c != null),
      schedule,
      week,
    };
  });

  return dtos.sort((a, b) => {
    const aa = a.commitment?.status === "ACTIVE" ? 0 : 1;
    const bb = b.commitment?.status === "ACTIVE" ? 0 : 1;
    return aa - bb || a.name.localeCompare(b.name);
  });
}

export type { Priority };

export function nextIdFor(db: LocalDB): number {
  return nextId(db);
}

export { fromISO };
