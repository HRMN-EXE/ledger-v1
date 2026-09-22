"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { AlarmOverlay, ReminderBanner, type ReminderItem } from "@/components/alarm-ui";
import {
  AppCtx,
  type AppApi,
  type FocusPreset,
  type RitualCreateInput,
  type RitualFormState,
  type TabId,
  type TaskPatch,
  type TaskSheetState,
} from "@/components/app-context";
import { HabitSheet } from "@/components/habit-sheet";
import { BarsIcon, BellIcon, CalendarIcon, CheckIcon, GearIcon, LoopIcon, PlusIcon, SunIcon, TimerIcon, XIcon } from "@/components/icons";
import { ResolverSheet } from "@/components/resolver-sheet";
import { RitualDetailSheet } from "@/components/ritual-detail";
import { RitualFormSheet } from "@/components/ritual-form";
import { SettingsSheet } from "@/components/settings-sheet";
import { StreakSheet } from "@/components/streak-sheet";
import { TaskSheet } from "@/components/task-sheet";
import { TourOverlay, TourPrompt, TOUR_STEPS } from "@/components/tour";
import { FocusView } from "@/components/views/focus";
import { HabitsView } from "@/components/views/habits";
import { PlanView } from "@/components/views/plan";
import { StatsView } from "@/components/views/stats";
import { TodayView } from "@/components/views/today";
import {
  ALARM_LEAD_MS,
  FIRST_SNOOZE_MIN,
  MAX_SNOOZES,
  REMINDER_LEAD_MS,
  loadAlarmState,
  notifySystem,
  requestNotificationPermission,
  saveAlarmState,
  startAlarmSound,
  startVibrate,
  stopVibrate,
} from "@/lib/alarm";
import { api } from "@/lib/api";
import { addDays, fromISO, todayISO } from "@/lib/dates";
import { pendingCarryTasks } from "@/lib/streak";
import { applyMotion, applyTheme, loadPrefs, savePrefs, type UiPrefs } from "@/lib/ui-prefs";
import {
  evaluateDueDays,
  expandRange,
  getStreakStatus,
  inQuietHours,
  isVacationDay,
  type EvalInput,
  type StreakEvent,
} from "@/lib/streak-engine";
import {
  CARRY_LIMIT,
  TAG_PALETTE,
  VACATION_LIMIT_PER_YEAR,
  type AppData,
  type DayRecordDTO,
  type HabitDTO,
  type HabitInput,
  type RitualDTO,
  type SessionDTO,
  type StreakSettingsDTO,
  type StreakStateDTO,
  type TaskDTO,
  type TaskInput,
} from "@/lib/types";

const MUST_LEAD_MS = 30 * 60 * 1000;
const NOTIF_KEY = "kairos-notif-log-v1";

const EVENT_PRIORITY: Record<StreakEvent["type"], number> = {
  gift: 6,
  broken: 5,
  protected: 4,
  earned: 3,
  "vacation-capped": 2,
  perfect: 1,
};

const TABS: { id: TabId; label: string; icon: (p: { size?: number; strokeWidth?: number }) => ReactElement }[] = [
  { id: "today", label: "Today", icon: SunIcon },
  { id: "plan", label: "Plan", icon: CalendarIcon },
  { id: "focus", label: "Focus", icon: TimerIcon },
  { id: "habits", label: "Rituals", icon: LoopIcon },
  { id: "stats", label: "Ledger", icon: BarsIcon },
];

interface ActiveAlarm {
  task: TaskDTO;
  snoozeCount: number;
}
interface ResolveState {
  items: TaskDTO[];
}
interface StreakNotice {
  id: number;
  title: string;
  body: string;
}
interface ToastMsg {
  id: number;
  text: string;
}

export function PlannerApp({ initial, name, openedOn }: { initial: AppData; name: string; openedOn: string }) {
  const [data, setData] = useState<AppData>(initial);
  const [tab, setTab] = useState<TabId>(() => loadPrefs().defaultTab);
  const [taskSheet, setTaskSheet] = useState<TaskSheetState>(null);
  const [habitSheetOpen, setHabitSheetOpen] = useState(false);
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);
  const [toastState, setToastState] = useState<ToastMsg | null>(null);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [alarm, setAlarm] = useState<ActiveAlarm | null>(null);
  const [resolve, setResolve] = useState<ResolveState | null>(null);
  const [streakNotice, setStreakNotice] = useState<StreakNotice | null>(null);

  const [streakState, setStreakState] = useState<StreakStateDTO>(initial.streak.state);
  const [records, setRecords] = useState<DayRecordDTO[]>(initial.streak.records);
  const [vacationDays, setVacationDays] = useState<Set<string>>(new Set(initial.streak.vacationDays));
  const [streakSettings, setStreakSettings] = useState<StreakSettingsDTO>(initial.streak.settings);
  const [rituals, setRituals] = useState<RitualDTO[]>(initial.rituals);
  const [ritualForm, setRitualForm] = useState<RitualFormState>(null);
  const [ritualDetailId, setRitualDetailId] = useState<number | null>(null);
  const [focusPreset, setFocusPreset] = useState<FocusPreset | null>(null);
  const [confirmState, setConfirmState] = useState<{ task: TaskDTO; fromFocus?: boolean } | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourPrompt, setTourPrompt] = useState(false);
  const [prefs, setPrefs] = useState<UiPrefs>(() => loadPrefs());

  // first run: offer the coach-mark tour, never force it
  useEffect(() => {
    try {
      if (!window.localStorage.getItem("ledger-tour-v1") && !window.localStorage.getItem("ledger-tour-prompt-v1")) {
        setTourPrompt(true);
      }
    } catch {
      setTourPrompt(true);
    }
  }, []);

  const dismissPrompt = (take: boolean) => {
    setTourPrompt(false);
    try {
      window.localStorage.setItem("ledger-tour-prompt-v1", "1");
    } catch {
      // ignore
    }
    if (take) setTourStep(0);
  };

  const endTour = () => {
    setTourStep(null);
    try {
      window.localStorage.setItem("ledger-tour-v1", "1");
    } catch {
      // ignore
    }
  };
  const prefsRef = useRef(prefs);
  const [, setClock] = useState(0);

  useEffect(() => {
    prefsRef.current = prefs;
    applyTheme(prefs.theme);
    applyMotion(prefs.motion);
  }, [prefs]);

  const updatePrefs = (patch: Partial<UiPrefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefs(next);
    savePrefs(next);
    applyTheme(next.theme);
  };

  const toastTimer = useRef<number | null>(null);
  const dataRef = useRef(data);
  const alarmRef = useRef<ActiveAlarm | null>(null);
  const stopSoundRef = useRef<(() => void) | null>(null);
  const resolveRanRef = useRef(false);
  const streakBusyRef = useRef(false);
  const lastSeenDayRef = useRef(todayISO());
  const streakStateRef = useRef(streakState);
  const recordsRef = useRef(records);
  const vacationRef = useRef(vacationDays);
  const settingsRef = useRef(streakSettings);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    alarmRef.current = alarm;
  }, [alarm]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const toast = useCallback((text: string) => {
    const id = Date.now();
    setToastState({ id, text });
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToastState((t) => (t && t.id === id ? null : t));
    }, 2600);
  }, []);

  // ── Rituals ───────────────────────────────────────────────────────────────
  const syncRituals = async () => {
    const res = await api<{ rituals: RitualDTO[]; tasks: TaskDTO[] }>("/api/rituals/sync", { method: "POST" });
    setRituals(res.rituals);
    setData((d) => ({ ...d, tasks: res.tasks }));
  };

  // ── Streak tick ───────────────────────────────────────────────────────────
  const streakTick = useCallback(async () => {
    if (streakBusyRef.current) return;
    streakBusyRef.current = true;
    try {
      const now = new Date();

      // day rollover: sync first so deadline escalation is live across midnight
      if (lastSeenDayRef.current !== todayISO()) {
        lastSeenDayRef.current = todayISO();
        await syncRituals();
      }
      const input: EvalInput = {
        now,
        tasks: dataRef.current.tasks,
        state: streakStateRef.current,
        records: Object.fromEntries(recordsRef.current.map((r) => [r.day, r])),
        vacationDays: new Set(vacationRef.current),
        settings: settingsRef.current,
      };
      const result = evaluateDueDays(input);

      if (result.changed) {
        streakStateRef.current = result.state;
        setStreakState(result.state);
        void api("/api/streak/state", { method: "POST", body: JSON.stringify(result.state) });
      }

      if (result.newRecords.length > 0) {
        const map = new Map(recordsRef.current.map((r) => [r.day, r]));
        for (const r of result.newRecords) map.set(r.day, r);
        const merged = Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
        recordsRef.current = merged;
        setRecords(merged);
        for (const r of result.newRecords) {
          void api("/api/streak/day", { method: "POST", body: JSON.stringify(r) });
        }
      }

      if (result.vacationAdds.length > 0) {
        const merged = new Set(vacationRef.current);
        for (const d of result.vacationAdds) merged.add(d);
        vacationRef.current = merged;
        setVacationDays(merged);
        void api("/api/streak/vacation", { method: "POST", body: JSON.stringify({ addDays: result.vacationAdds }) });
      }

      // engine sealed a day over unresolved obligations — mirror it on the tasks
      if (result.missedTaskIds.length > 0) {
        const idset = new Set(result.missedTaskIds);
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            idset.has(t.id) && !t.done ? { ...t, missed: true, done: false, doneAt: null } : t
          ),
        }));
        let ritualTouched = false;
        for (const id of result.missedTaskIds) {
          const t = dataRef.current.tasks.find((x) => x.id === id);
          if (t?.ritualInstanceId != null) ritualTouched = true;
          void api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ missed: true }) });
        }
        if (ritualTouched) void syncRituals();
      }

      if (result.events.length > 0) {
        // a spent shield is always worth its own toast
        const prot = result.events.filter((e) => e.type === "protected");
        const sorted = [...result.events].sort((a, b) => EVENT_PRIORITY[b.type] - EVENT_PRIORITY[a.type]);
        toast(prot.length > 0 ? (prot.length > 1 ? `−${prot.length} shields · protections spent` : prot[0].message) : sorted[0].message);
      }

      // Notifications — deduped per day, suppressed in quiet hours.
      const mergedInput: EvalInput = {
        now,
        tasks: dataRef.current.tasks,
        state: streakStateRef.current,
        records: Object.fromEntries(recordsRef.current.map((r) => [r.day, r])),
        vacationDays: new Set(vacationRef.current),
        settings: settingsRef.current,
      };
      const statusNow = getStreakStatus(mergedInput);
      const quiet = inQuietHours(now, settingsRef.current);
      const today = todayISO();

      const notifyOnce = (key: string, title: string, body: string) => {
        try {
          const raw = window.localStorage.getItem(NOTIF_KEY);
          const log: Record<string, number> = raw ? JSON.parse(raw) : {};
          const k = `${today}:${key}`;
          if (log[k]) return;
          log[k] = Date.now();
          for (const kk of Object.keys(log)) if (!kk.startsWith(`${today}:`)) delete log[kk];
          window.localStorage.setItem(NOTIF_KEY, JSON.stringify(log));
        } catch {
          // ignore
        }
        notifySystem(title, body, `kairos-n-${key}`);
        const id = Date.now();
        setStreakNotice({ id, title, body });
        window.setTimeout(() => setStreakNotice((n) => (n && n.id === id ? null : n)), 10000);
      };

      if (!quiet && statusNow.kind !== "VACATION") {
        const hour = now.getHours();
        const todaysTasks = dataRef.current.tasks.filter((t) => t.day === today && !t.missed);

        if (settingsRef.current.morningBrief && hour >= 6 && hour < 12 && todaysTasks.length > 0) {
          const musts = todaysTasks.filter((t) => t.priority === 1).length;
          const shoulds = todaysTasks.filter((t) => t.priority === 2).length;
          const coulds = todaysTasks.filter((t) => t.priority === 3).length;
          notifyOnce(
            "morning",
            "Good morning ☀️",
            `${todaysTasks.length} task(s) today — ${musts} must, ${shoulds} should, ${coulds} could. Streak: ${streakStateRef.current.streak}.`
          );
        }

        if (settingsRef.current.streakWarnings && statusNow.remaining > 0) {
          if (settingsRef.current.eveningCheckin && statusNow.minutesToCutoff <= 180 && statusNow.minutesToCutoff > 30) {
            notifyOnce("evening", "Evening check-in", `${statusNow.remaining} task(s) left before the ${settingsRef.current.cutoffTime} cutoff.`);
          }
          if (settingsRef.current.finalWarning && statusNow.minutesToCutoff <= 30) {
            notifyOnce("final", "Final warning", `${statusNow.remaining} task(s) — cutoff is ${settingsRef.current.cutoffTime}.`);
          }
        }
      }
    } catch {
      // engine errors must never kill the loop
    } finally {
      streakBusyRef.current = false;
    }
  }, [toast]);

  useEffect(() => {
    const clockIv = window.setInterval(() => setClock((c) => c + 1), 1000);
    const tickIv = window.setInterval(() => void streakTick(), 60000);
    void streakTick();
    requestNotificationPermission();
    return () => {
      window.clearInterval(clockIv);
      window.clearInterval(tickIv);
    };
  }, [streakTick]);

  // ── Alarm & reminder polling ──────────────────────────────────────────────
  useEffect(() => {
    const iv = window.setInterval(() => {
      const now = new Date();
      const state = loadAlarmState();
      let dirty = false;
      const newReminders: ReminderItem[] = [];
      const settings = settingsRef.current;

      for (const task of dataRef.current.tasks) {
        if (task.done || task.missed || !task.time) continue;
        // streak frozen? alarms stay silent too
        if (isVacationDay(task.day, vacationRef.current, streakStateRef.current.vacationOpenStart)) continue;
        const due = fromISO(task.day);
        const [h, m] = task.time.split(":").map(Number);
        due.setHours(h, m, 0, 0);
        const sig = `${task.id}:${task.day}:${task.time}`;
        const entry =
          state[sig] ?? {
            sig,
            reminderFired: false,
            mustLeadFired: false,
            lastAlarmAt: null,
            snoozeCount: 0,
            nextAlarmAt: null,
            missedNotified: false,
          };

        if (
          settings.taskReminders &&
          now.getTime() >= due.getTime() - REMINDER_LEAD_MS &&
          now.getTime() < due.getTime() &&
          !entry.reminderFired
        ) {
          entry.reminderFired = true;
          dirty = true;
          newReminders.push({ key: sig, task });
          notifySystem("Coming up", `${task.title} at ${task.time}`, `kairos-r-${sig}`);
          if (prefsRef.current.haptics) {
            try {
              navigator.vibrate?.([30, 40, 30]);
            } catch {
              // ignore
            }
          }
        }

        if (
          task.priority === 1 &&
          settings.streakWarnings &&
          now.getTime() >= due.getTime() - MUST_LEAD_MS &&
          now.getTime() < due.getTime() - REMINDER_LEAD_MS &&
          !entry.mustLeadFired
        ) {
          entry.mustLeadFired = true;
          dirty = true;
          notifySystem("Must task in 30 minutes", task.title, `kairos-m-${sig}`);
        }

        // unseen past the window? send a fallback ping once
        if (now.getTime() > due.getTime() + 30 * 60 * 1000 && !entry.missedNotified) {
          entry.missedNotified = true;
          dirty = true;
          notifySystem("Missed while away", `${task.title} was due at ${task.time}`, `kairos-x-${sig}`);
        }

        const effective = entry.nextAlarmAt ?? due.getTime() - ALARM_LEAD_MS;
        if (
          now.getTime() >= effective &&
          now.getTime() <= due.getTime() + 30 * 60 * 1000 &&
          (entry.lastAlarmAt == null || entry.lastAlarmAt < effective) &&
          !alarmRef.current
        ) {
          entry.lastAlarmAt = now.getTime();
          dirty = true;
          const active: ActiveAlarm = { task, snoozeCount: entry.snoozeCount };
          alarmRef.current = active;
          setAlarm(active);
          stopSoundRef.current = prefsRef.current.sound ? startAlarmSound() : null;
          if (prefsRef.current.haptics) startVibrate();
        }

        state[sig] = entry;
      }

      // cleanup: stale entries + tasks no longer pending
      for (const key of Object.keys(state)) {
        const e = state[key];
        const stillActive = dataRef.current.tasks.some(
          (t) => `${t.id}:${t.day}:${t.time}` === key && !t.done && !t.missed && t.time
        );
        if (!stillActive || (e.lastAlarmAt != null && Date.now() - e.lastAlarmAt > 2 * 86400000 && e.nextAlarmAt == null)) {
          delete state[key];
          dirty = true;
        }
      }

      if (dirty) saveAlarmState(state);
      if (newReminders.length > 0) setReminders((r) => [...r, ...newReminders]);
    }, 10000);
    return () => window.clearInterval(iv);
  }, []);

  // ── Resolver: yesterday's leftovers ───────────────────────────────────────
  useEffect(() => {
    if (resolveRanRef.current) return;
    resolveRanRef.current = true;
    const pending = pendingCarryTasks(dataRef.current.tasks, todayISO());
    if (pending.length > 0) setResolve({ items: pending });
  }, []);

  const removeResolve = (id: number) => {
    // keep the ledger open on an empty list so the cleared state is visible;
    // it unlocks (X + backdrop) automatically once no actionable rows remain
    setResolve((r) => (r ? { items: r.items.filter((t) => t.id !== id) } : r));
  };

  // ── Task operations ───────────────────────────────────────────────────────
  const addTask = async (input: TaskInput) => {
    const t = await api<TaskDTO>("/api/tasks", { method: "POST", body: JSON.stringify(input) });
    setData((d) => ({ ...d, tasks: [...d.tasks, t] }));
    toast("Task added");
  };

  const updateTask = async (id: number, patch: TaskPatch) => {
    const updated = await api<TaskDTO>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? updated : t)) }));
    toast("Saved");
    void streakTick();
  };

  const deleteTask = async (id: number) => {
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
    toast("Task deleted");
  };

  const finishTask = async (id: number) => {
    try {
      const wasRitual = dataRef.current.tasks.find((t) => t.id === id)?.ritualInstanceId != null;
      const updated = await api<TaskDTO>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: true }) });
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? updated : t)) }));
      toast("Done ✓");
      if (wasRitual) void syncRituals(); // live-update the week circles
      void streakTick();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed");
    }
  };

  const toggleTask = async (id: number) => {
    const task = dataRef.current.tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.done) {
      toast("Completed tasks are final");
      return;
    }
    if (task.ritualInstanceId != null && task.day !== todayISO()) {
      toast("Rituals are honored on their due day");
      return;
    }
    // closing asks first (unless the user turned the question off)
    if (prefsRef.current.confirmDone) setConfirmState({ task });
    else void finishTask(task.id);
  };

  const requestFinishTask = (task: TaskDTO) => {
    setConfirmState({ task, fromFocus: true });
  };

  const confirmFinish = () => {
    if (!confirmState) return;
    const id = confirmState.task.id;
    setConfirmState(null);
    void finishTask(id);
  };

  const confirmFocus = () => {
    if (!confirmState) return;
    const t = confirmState.task;
    setConfirmState(null);
    setFocusPreset({ label: t.title, durationMin: 25, taskId: t.id });
    setTab("focus");
  };

  const patchTaskRow = async (id: number, patch: Record<string, unknown>) => {
    const updated = await api<TaskDTO>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? updated : t)) }));
    return updated;
  };

  const carryTask = async (id: number) => {
    const task = dataRef.current.tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.priority === 1 || (task.deadline != null && task.deadline <= todayISO())) {
      toast("Due today — carry is off the table");
      return;
    }
    if (task.carries >= CARRY_LIMIT) {
      toast("Carry limit reached — mark it missed");
      return;
    }
    try {
      await patchTaskRow(id, { day: todayISO(), carries: task.carries + 1 });
      removeResolve(id);
      toast("Carried to today");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed");
    }
  };

  /** selector apply: selected ride forward, unselected shoulds dissolve, unselected coulds miss */
  const resolveApply = async (selectedIds: number[]) => {
    if (!resolve) return;
    const sel = new Set(selectedIds);
    let carried = 0;
    let dissolved = 0;
    let missed = 0;
    const today = todayISO();
    for (const stale of resolve.items) {
      const t = dataRef.current.tasks.find((x) => x.id === stale.id);
      if (!t || t.done || t.missed) continue; // engine may have sealed it already
      if (t.priority === 1 || (t.deadline != null && t.deadline <= today)) continue; // locked rows stay for manual handling
      try {
        const dueToday = t.deadline != null && t.deadline <= today;
        if (sel.has(t.id) && !dueToday && t.carries < CARRY_LIMIT) {
          await patchTaskRow(t.id, { day: today, carries: t.carries + 1 });
          carried++;
        } else if (t.priority === 2 && !sel.has(t.id) && !dueToday && t.carries < CARRY_LIMIT) {
          await patchTaskRow(t.id, { priority: 3, missed: true });
          dissolved++;
        } else {
          await patchTaskRow(t.id, { missed: true });
          missed++;
        }
      } catch {
        // keep going — one bad row shouldn't stop the sweep
      }
    }
    await syncRituals();
    // locked rows (musts / due-today) remain until acknowledged; sheet stays open
    setResolve({
      items: resolve.items.filter((t) => t.priority === 1 || (t.deadline != null && t.deadline <= todayISO())),
    });
    toast(`Carried ${carried} · dissolved ${dissolved} · missed ${missed}`);
    void streakTick();
  };

  const resolveLeftovers = async (day: string, mode: "carry" | "miss") => {
    const today = todayISO();
    const pending = dataRef.current.tasks.filter((t) => t.day === day && !t.done && !t.missed);
    if (pending.length === 0) return;
    let carried = 0;
    let missed = 0;
    for (const t of pending) {
      if (mode === "carry" && t.priority !== 1 && !(t.deadline != null && t.deadline <= today) && t.carries < CARRY_LIMIT) {
        await api<TaskDTO>(`/api/tasks/${t.id}`, {
          method: "PATCH",
          body: JSON.stringify({ day: today, carries: t.carries + 1 }),
        });
        carried++;
      } else {
        await api<TaskDTO>(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ missed: true }) });
        missed++;
      }
    }
    await syncRituals();
    toast(
      mode === "carry"
        ? carried > 0
          ? `Carried ${carried} to today${missed > 0 ? `, missed ${missed}` : ""}`
          : `Carry limit hit — missed ${missed}`
        : `Missed ${missed} — owned it`
    );
    void streakTick();
  };

  const missTask = async (id: number) => {
    try {
      const updated = await api<TaskDTO>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ missed: true }) });
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? updated : t)) }));
      removeResolve(id);
      toast("Marked missed");
      void streakTick();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed");
    }
  };

  // ── Habits ────────────────────────────────────────────────────────────────
  const addHabit = async (input: HabitInput) => {
    const h = await api<HabitDTO>("/api/habits", { method: "POST", body: JSON.stringify(input) });
    setData((d) => ({ ...d, habits: [...d.habits, h] }));
    toast("Habit created");
  };

  const deleteHabit = async (id: number) => {
    await api(`/api/habits/${id}`, { method: "DELETE" });
    setData((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id), logs: d.logs.filter((l) => l.habitId !== id) }));
    toast("Habit deleted");
  };

  const toggleLog = async (habitId: number, day: string) => {
    const existing = dataRef.current.logs.find((l) => l.habitId === habitId && l.day === day);
    setData((d) =>
      existing
        ? { ...d, logs: d.logs.filter((l) => l.id !== existing.id) }
        : { ...d, logs: [...d.logs, { id: -Date.now(), habitId, day }] }
    );
    await api(`/api/habits/${habitId}/toggle`, { method: "POST", body: JSON.stringify({ day }) });
  };

  // ── Intent & focus ────────────────────────────────────────────────────────
  const setIntent = async (text: string) => {
    const day = todayISO();
    setData((d) => ({ ...d, intent: text ? { day, text } : null }));
    await api("/api/intent", { method: "POST", body: JSON.stringify({ day, text }) });
  };

  const addSession = async (label: string, durationMin: number, durationSec?: number) => {
    const s = await api<SessionDTO>("/api/focus", {
      method: "POST",
      body: JSON.stringify({ label, durationMin, durationSec }),
    });
    setData((d) => ({ ...d, sessions: [s, ...d.sessions] }));
    toast(`Logged ${durationMin} min`);
  };

  const addTag = async (nameRaw: string): Promise<string | null> => {
    const clean = nameRaw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) return null;
    if (dataRef.current.tags.some((t) => t.name === clean)) return clean;
    const color = TAG_PALETTE[dataRef.current.tags.length % TAG_PALETTE.length];
    setData((d) => ({ ...d, tags: [...d.tags, { name: clean, color }] }));
    try {
      await api("/api/tags", { method: "POST", body: JSON.stringify({ name: clean, color }) });
      return clean;
    } catch {
      return null;
    }
  };

  const deleteTag = async (name: string) => {
    await api(`/api/tags/${encodeURIComponent(name)}`, { method: "DELETE" });
    setData((d) => ({ ...d, tags: d.tags.filter((t) => t.name !== name) }));
    toast("Tag deleted");
  };

  // ── Streak / vacation / settings ──────────────────────────────────────────
  const scheduleVacation = async (start: string, end: string, openEnded: boolean): Promise<string | null> => {
    try {
      const today = todayISO();
      if (openEnded) {
        if (streakStateRef.current.vacationOpenStart) return "An open vacation is already running";
        await api("/api/streak/vacation", { method: "POST", body: JSON.stringify({ startOpen: start }) });
        const s = { ...streakStateRef.current, vacationOpenStart: start };
        streakStateRef.current = s;
        setStreakState(s);
        void api("/api/streak/state", { method: "POST", body: JSON.stringify(s) });
        toast("Vacation started — streak frozen");
        return null;
      }
      if (start < today) return "Vacation can't start in the past";
      if (end < start) return "End day must be after start day";
      const days = expandRange(start, end);
      const year = start.slice(0, 4);
      const used = Array.from(vacationRef.current).filter((d) => d.startsWith(year)).length;
      if (used + days.length > VACATION_LIMIT_PER_YEAR) {
        return `Only ${Math.max(0, VACATION_LIMIT_PER_YEAR - used)} vacation day(s) left in ${year}`;
      }
      await api("/api/streak/vacation", { method: "POST", body: JSON.stringify({ addDays: days }) });
      const merged = new Set(vacationRef.current);
      for (const d of days) merged.add(d);
      vacationRef.current = merged;
      setVacationDays(merged);
      toast("Vacation scheduled");
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Failed";
    }
  };

  const removeVacationDay = async (day: string) => {
    await api("/api/streak/vacation", { method: "POST", body: JSON.stringify({ removeDay: day }) });
    const merged = new Set(vacationRef.current);
    merged.delete(day);
    vacationRef.current = merged;
    setVacationDays(merged);
    toast("Vacation day removed");
  };

  const endOpenVacation = async () => {
    await api("/api/streak/vacation", { method: "POST", body: JSON.stringify({ endOpen: true }) });
    const s = { ...streakStateRef.current, vacationOpenStart: null };
    streakStateRef.current = s;
    setStreakState(s);
    void api("/api/streak/state", { method: "POST", body: JSON.stringify(s) });
    toast("Vacation ended — the streak is live");
  };

  const updateStreakSettings = async (patch: Partial<StreakSettingsDTO>) => {
    const merged = { ...settingsRef.current, ...patch };
    settingsRef.current = merged;
    setStreakSettings(merged);
    await api("/api/streak/settings", { method: "POST", body: JSON.stringify(patch) });
  };

  const createRitual = async (input: RitualCreateInput, force = false) => {
    const res = await api<{ duplicate?: { id: number; name: string }; created?: number }>("/api/rituals", {
      method: "POST",
      body: JSON.stringify({ ...input, force }),
    });
    if (res.duplicate) return res.duplicate;
    await syncRituals();
    setRitualForm(null);
    toast("Ritual created");
    return null;
  };

  const ritualAction = async (ritualId: number, action: string, payload?: Record<string, unknown>) => {
    await api(`/api/rituals/${ritualId}/action`, { method: "POST", body: JSON.stringify({ action, payload }) });
    await syncRituals();
    if (action === "edit") toast("Ritual updated");
    else if (action === "renew") toast("Commitment renewed");
    else if (action === "end-early") toast("Commitment ended");
    else toast("Ritual archived");
  };

  const deleteRitual = async (ritualId: number) => {
    await api(`/api/rituals/${ritualId}`, { method: "DELETE" });
    await syncRituals();
    toast("Ritual deleted");
  };

  // ── Alarm controls ────────────────────────────────────────────────────────
  const closeAlarm = useCallback(() => {
    stopSoundRef.current?.();
    stopSoundRef.current = null;
    stopVibrate();
    alarmRef.current = null;
    setAlarm(null);
  }, []);

  const snoozeAlarm = () => {
    if (!alarm) return;
    const t = alarm.task;
    const sig = `${t.id}:${t.day}:${t.time}`;
    const state = loadAlarmState();
    const entry = state[sig];
    if (!entry || entry.snoozeCount >= MAX_SNOOZES) {
      closeAlarm();
      return;
    }
    const mins = FIRST_SNOOZE_MIN * (entry.snoozeCount + 1);
    entry.snoozeCount += 1;
    entry.nextAlarmAt = Date.now() + mins * 60 * 1000;
    state[sig] = entry;
    saveAlarmState(state);
    closeAlarm();
    toast(`Snoozed ${mins} min`);
  };

  const dismissReminder = (key: string) => setReminders((r) => r.filter((x) => x.key !== key));

  // ── Live status ───────────────────────────────────────────────────────────
  const status = getStreakStatus({
    now: new Date(),
    tasks: data.tasks,
    state: streakState,
    records: Object.fromEntries(records.map((r) => [r.day, r])),
    vacationDays,
    settings: streakSettings,
  });

  const ritualDetail = ritualDetailId != null ? rituals.find((r) => r.id === ritualDetailId) ?? null : null;
  const ritualFormRitual =
    ritualForm?.mode === "edit" ? rituals.find((r) => r.id === ritualForm.ritualId) ?? null : null;

  // read-only reference window for the Daily Ledger
  const missedRecent = data.tasks
    .filter((t) => t.missed && t.day >= addDays(todayISO(), -2))
    .sort((a, b) => b.day.localeCompare(a.day));

  const appApi: AppApi = {
    data,
    profileName: name,
    openedOn,
    tab,
    setTab,
    openTaskSheet: (day?: string) => setTaskSheet({ mode: "create", day: day ?? todayISO() }),
    editTaskSheet: (task: TaskDTO) => {
      if (task.done) {
        toast("Closed tasks are read-only");
        return;
      }
      setTaskSheet({ mode: "edit", task });
    },
    openHabitSheet: () => setHabitSheetOpen(true),
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    finishTask,
    requestFinishTask,
    resolveLeftovers,
    openSettings: () => setSettingsOpen(true),
    replayTour: () => {
      setSettingsOpen(false);
      setTourStep(0);
    },
    addHabit,
    deleteHabit,
    toggleLog,
    setIntent,
    addSession,
    toast,
    addTag,
    deleteTag,
    streakState,
    records,
    vacationDays,
    streakSettings,
    status,
    openStreakSheet: () => setStreakSheetOpen(true),
    scheduleVacation,
    removeVacationDay,
    endOpenVacation,
    updateStreakSettings,
    focusPreset,
    consumeFocusPreset: () => setFocusPreset(null),
    rituals,
    openRitualCreate: () => setRitualForm({ mode: "create" }),
    openRitualEdit: (ritualId: number) => setRitualForm({ mode: "edit", ritualId }),
    openRitualDetail: (ritual: RitualDTO) => setRitualDetailId(ritual.id),
    createRitual,
    ritualAction,
    deleteRitual,
    syncRituals,
  };

  return (
    <AppCtx.Provider value={appApi}>
      <div className="relative flex h-full flex-col overflow-hidden">
        <div className="pointer-events-none absolute -top-28 left-1/2 z-0 h-56 w-[420px] -translate-x-1/2 rounded-full bg-ember-500/[0.07] blur-3xl" />

        {/* settings — reachable from every tab */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="press absolute right-5 top-[max(16px,env(safe-area-inset-top))] z-30 grid size-9 place-items-center rounded-full border border-white/10 bg-ink-800/80 text-fog-400 backdrop-blur"
        >
          <GearIcon size={15} strokeWidth={2} />
        </button>

        <main className="no-scrollbar relative z-10 flex-1 overflow-y-auto">
          <div className={tab === "today" ? "" : "hidden"}>
            <TodayView />
          </div>
          <div className={tab === "plan" ? "" : "hidden"}>
            <PlanView />
          </div>
          <div className={tab === "focus" ? "" : "hidden"}>
            <FocusView />
          </div>
          <div className={tab === "habits" ? "" : "hidden"}>
            <HabitsView />
          </div>
          <div className={tab === "stats" ? "" : "hidden"}>
            <StatsView />
          </div>
        </main>

        {/* the toggle lives inside the + : tap it, pick task or ritual */}
        {fabOpen ? (
          <div className="absolute bottom-[172px] right-5 z-20 flex animate-pop flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFabOpen(false);
                setRitualForm({ mode: "create" });
              }}
              className="press flex items-center gap-2 rounded-full border border-white/10 bg-ink-800/95 px-4 py-3 shadow-xl backdrop-blur"
            >
              <span className="text-lilac-400">
                <LoopIcon size={15} strokeWidth={2.2} />
              </span>
              <span className="text-[12.5px] font-extrabold text-bone-100">New ritual</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFabOpen(false);
                setTaskSheet({ mode: "create", day: todayISO() });
              }}
              className="press flex items-center gap-2 rounded-full border border-white/10 bg-ink-800/95 px-4 py-3 shadow-xl backdrop-blur"
            >
              <span className="text-ember-400">
                <CheckIcon size={15} strokeWidth={2.4} />
              </span>
              <span className="text-[12.5px] font-extrabold text-bone-100">New task</span>
            </button>
          </div>
        ) : null}
        <button
          type="button"
          aria-label={fabOpen ? "Close create menu" : "Create"}
          onClick={() => setFabOpen(!fabOpen)}
          className="press absolute bottom-24 right-5 z-20 grid size-14 place-items-center rounded-full bg-ember-500 text-ink-950 shadow-[0_14px_34px_-8px_rgba(255,106,43,0.55)]"
        >
          <span className={`transition-transform duration-200 ${fabOpen ? "rotate-45" : ""}`}>
            <PlusIcon size={22} strokeWidth={2.4} />
          </span>
        </button>

        {/* Bottom nav */}
        <nav
          className="relative z-20 border-t border-white/5 bg-ink-900/95 px-2 pt-2 backdrop-blur"
          style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
        >
          <div className="grid grid-cols-5">
            {TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button key={t.id} type="button" onClick={() => setTab(t.id)} className="press flex flex-col items-center gap-1 py-1.5">
                  <span
                    className={`grid h-8 w-14 place-items-center rounded-xl transition-colors ${
                      active ? "bg-ember-500/15 text-ember-400" : "text-fog-500"
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2 : 1.8} />
                  </span>
                  <span className={`text-[9.5px] font-bold tracking-wide ${active ? "text-bone-100" : "text-fog-600"}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Notice & reminder banners */}
        {streakNotice || reminders.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[55] space-y-2">
            {streakNotice ? (
              <div
                key={streakNotice.id}
                className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-2xl border border-lilac-400/25 bg-ink-750/95 px-4 py-3 shadow-2xl backdrop-blur"
              >
                <span className="mt-0.5 text-lilac-400">
                  <BellIcon size={15} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-extrabold text-bone-50">{streakNotice.title}</p>
                  <p className="text-[11.5px] font-medium text-fog-400">{streakNotice.body}</p>
                </div>
                <button type="button" onClick={() => setStreakNotice(null)} className="press p-0.5 text-fog-500" aria-label="Dismiss">
                  <XIcon size={14} strokeWidth={2.2} />
                </button>
              </div>
            ) : null}
            {reminders.slice(0, 2).map((r) => (
              <ReminderBanner
                key={r.key}
                task={r.task}
                headline={r.headline}
                onDone={() => {
                  void toggleTask(r.task.id);
                  dismissReminder(r.key);
                }}
                onDismiss={() => dismissReminder(r.key)}
              />
            ))}
          </div>
        ) : null}

        {/* Sheets & overlays */}
        <TaskSheet state={taskSheet} onClose={() => setTaskSheet(null)} />
        <HabitSheet open={habitSheetOpen} onClose={() => setHabitSheetOpen(false)} />
        <StreakSheet open={streakSheetOpen} onClose={() => setStreakSheetOpen(false)} />
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} prefs={prefs} onChange={updatePrefs} />

        {tourPrompt && tourStep == null ? <TourPrompt onTake={() => dismissPrompt(true)} onDismiss={() => dismissPrompt(false)} /> : null}

        {tourStep != null ? (
          <TourOverlay
            step={tourStep}
            onNext={() => (tourStep >= TOUR_STEPS - 1 ? endTour() : setTourStep(tourStep + 1))}
            onBack={() => setTourStep(Math.max(0, tourStep - 1))}
            onSkip={endTour}
          />
        ) : null}
        {ritualForm ? (
          <RitualFormSheet
            key={ritualForm.mode === "edit" ? `edit-${ritualForm.ritualId}` : "create"}
            state={ritualForm}
            ritual={ritualFormRitual}
            onClose={() => setRitualForm(null)}
          />
        ) : null}
        <RitualDetailSheet ritual={ritualDetail} onClose={() => setRitualDetailId(null)} />
        {resolve ? (
          <ResolverSheet
            items={resolve.items}
            missed={missedRecent}
            onApply={(ids) => void resolveApply(ids)}
            onMiss={(id) => void missTask(id)}
            onClose={() => setResolve(null)}
          />
        ) : null}

        {/* close-task confirmation */}
        {confirmState ? (
          <div className="absolute inset-0 z-[65] flex items-center justify-center bg-ink-950/85 p-6 backdrop-blur-sm">
            <div className="relative w-full animate-pop rounded-[28px] border border-white/10 bg-ink-850 p-5 text-center shadow-2xl">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setConfirmState(null)}
                className="press absolute right-3.5 top-3.5 grid size-8 place-items-center rounded-full bg-white/5 text-fog-400"
              >
                <XIcon size={14} strokeWidth={2.2} />
              </button>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fog-500">Close it out?</p>
              <p className="mt-1.5 truncate px-6 font-display text-[17px] font-bold text-bone-50">{confirmState.task.title}</p>
              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={confirmFinish}
                  className="press w-full rounded-2xl bg-ember-500 py-3.5 text-[14px] font-extrabold text-ink-950"
                >
                  Mark the task as finished
                </button>
                {!confirmState.fromFocus ? (
                  <button
                    type="button"
                    onClick={confirmFocus}
                    className="press w-full rounded-2xl border border-white/10 py-3.5 text-[13.5px] font-bold text-bone-100"
                  >
                    Open focus time instead
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {alarm ? (
          <AlarmOverlay
            task={alarm.task}
            snoozeCount={alarm.snoozeCount}
            onSnooze={snoozeAlarm}
            onStop={closeAlarm}
            onReschedule={() => {
              const t = alarm.task;
              closeAlarm();
              setTaskSheet({ mode: "edit", task: t });
            }}
            onFocus={() => {
              const t = alarm.task;
              closeAlarm();
              setFocusPreset({ label: t.title, durationMin: 25, taskId: t.id });
              setTab("focus");
            }}
          />
        ) : null}

        {/* Toast */}
        {toastState ? (
          <div
            key={toastState.id}
            className="absolute bottom-[104px] left-1/2 z-[70] max-w-[90%] -translate-x-1/2 animate-toast-in whitespace-nowrap rounded-full bg-bone-50 px-4 py-2 text-[12.5px] font-bold text-ink-950 shadow-xl"
          >
            {toastState.text}
          </div>
        ) : null}
      </div>
    </AppCtx.Provider>
  );
}
