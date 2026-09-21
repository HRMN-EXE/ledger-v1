// ─── Ledger app state ───────────────────────────────────────────────────────
// The state machine from the web build (`planner-app.tsx`), moved into a
// context and re-pointed at the OS alarm engine: anything that changes the
// plan re-plans Android's alarms, and anything the OS fires comes back here as
// an in-app ringing screen.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { api, HttpError } from "@/lib/api";
import { flushDB, loadDB, onDBPersist, reloadDB, replaceDB, setProfileName } from "@/lib/localdb";
import { buildDTOs, localRitualSync } from "@/lib/local-rituals";
import { fromISO, todayISO } from "@/lib/dates";
import { pendingCarryTasks } from "@/lib/streak";
import {
  evaluateDueDays,
  getStreakStatus,
  type EvalInput,
  type StreakEvent,
  type StreakStatus,
} from "@/lib/streak-engine";
import { TAG_PALETTE, type AppData, type DayRecordDTO, type HabitInput, type RitualDTO, type SessionDTO, type StreakSettingsDTO, type StreakStateDTO, type TaskDTO, type TaskInput, VACATION_LIMIT_PER_YEAR, CARRY_LIMIT, type Priority } from "@/lib/types";
import { ensureOpenedOn } from "@/lib/localdb";

import { ensureChannels, ensureCategories } from "@/notifications/channels";
import {
  addAlarmRingListener,
  bootstrapNotifications,
  drainNativeActions,
  installNativeAlarmHandlers,
  ringingOnLaunch,
  clearSnooze,
  snoozeAlarm,
  snoozeCountFor,
  syncAlarms,
} from "@/notifications/engine";
import { registerBackgroundSync } from "@/notifications/background";
import {
  getPermissionSnapshot,
  requestBatteryExemption,
  requestDndAccess,
  requestExactAlarmPermission,
  requestNotificationPermission,
  type PermissionSnapshot,
} from "@/notifications/permissions";
import { loadPrefs, savePrefs, type NotificationPrefs } from "@/notifications/prefs";
import LedgerAlarm, { nativeAlarmsAvailable } from "@/lib/ledger-alarm";
import { startRinging, stopRinging } from "@/notifications/sound";

export type TabId = "today" | "plan" | "focus" | "habits" | "stats";

export type TaskSheetState = { mode: "create"; day: string } | { mode: "edit"; task: TaskDTO } | null;
export type RitualFormState = { mode: "create" } | { mode: "edit"; ritualId: number } | null;

export interface RitualCreateInput {
  name: string;
  icon: string;
  category: string;
  priority: Priority;
  scheduleType: string;
  config: Record<string, unknown>;
  tenureValue: number;
  tenureUnit: string;
  vacationBehavior: "pause" | "continue";
}

export interface FocusPreset {
  label: string;
  durationMin: number;
}

export interface TaskPatch {
  title?: string;
  notes?: string;
  day?: string;
  time?: string | null;
  priority?: Priority;
  tag?: string;
  done?: boolean;
  missed?: boolean;
  carries?: number;
}

export interface ActiveAlarm {
  key: string;
  kind: string;
  taskId: number | null;
  ritualId: number | null;
  title: string;
  body: string;
  snoozeCount: number;
}

export interface ReminderItem {
  key: string;
  task: TaskDTO;
  headline?: string;
}

export interface StreakNotice {
  id: number;
  title: string;
  body: string;
}

export interface AppApi {
  ready: boolean;
  data: AppData;
  profileName: string;
  openedOn: string;
  setProfileName: (name: string) => void;

  tab: TabId;
  setTab: (tab: TabId) => void;

  openTaskSheet: (day?: string) => void;
  editTaskSheet: (task: TaskDTO) => void;
  openHabitSheet: () => void;
  openSettings: () => void;

  // sheet visibility lives here so any screen (or a notification) can open one
  taskSheet: TaskSheetState;
  closeTaskSheet: () => void;
  habitSheetOpen: boolean;
  closeHabitSheet: () => void;
  streakSheetOpen: boolean;
  closeStreakSheet: () => void;
  settingsOpen: boolean;
  closeSettings: () => void;
  ritualForm: RitualFormState;
  closeRitualForm: () => void;
  ritualDetail: RitualDTO | null;
  closeRitualDetail: () => void;

  addTask: (input: TaskInput) => Promise<void>;
  updateTask: (id: number, patch: TaskPatch) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  carryTask: (id: number) => Promise<void>;
  missTask: (id: number) => Promise<void>;
  resolveLeftovers: (day: string, mode: "carry" | "miss") => Promise<void>;

  addHabit: (input: HabitInput) => Promise<void>;
  deleteHabit: (id: number) => Promise<void>;
  toggleLog: (habitId: number, day: string) => Promise<void>;

  setIntent: (text: string) => Promise<void>;
  addSession: (label: string, durationMin: number) => Promise<void>;
  toast: (text: string) => void;
  toastText: string | null;
  addTag: (name: string) => Promise<string | null>;
  deleteTag: (name: string) => Promise<void>;

  streakState: StreakStateDTO;
  records: DayRecordDTO[];
  vacationDays: Set<string>;
  streakSettings: StreakSettingsDTO;
  status: StreakStatus;
  openStreakSheet: () => void;
  scheduleVacation: (start: string, end: string, openEnded: boolean) => Promise<string | null>;
  removeVacationDay: (day: string) => Promise<void>;
  endOpenVacation: () => Promise<void>;
  updateStreakSettings: (patch: Partial<StreakSettingsDTO>) => Promise<void>;

  focusPreset: FocusPreset | null;
  consumeFocusPreset: () => void;
  setFocusPreset: (preset: FocusPreset) => void;

  rituals: RitualDTO[];
  openRitualCreate: () => void;
  openRitualEdit: (ritualId: number) => void;
  openRitualDetail: (ritual: RitualDTO) => void;
  createRitual: (input: RitualCreateInput, force?: boolean) => Promise<{ id: number; name: string } | null>;
  ritualAction: (ritualId: number, action: string, payload?: Record<string, unknown>) => Promise<void>;
  deleteRitual: (ritualId: number) => Promise<void>;
  syncRituals: () => Promise<void>;

  // ── native layer ──
  alarm: ActiveAlarm | null;
  closeAlarm: () => void;
  snoozeActiveAlarm: () => Promise<void>;
  resolveAlarmTask: (taskId: number) => Promise<void>;
  reminders: ReminderItem[];
  dismissReminder: (key: string) => void;
  resolveItems: TaskDTO[] | null;
  missedAlarms: TaskDTO[];
  dismissMissed: (id: number) => void;
  notice: StreakNotice | null;
  dismissNotice: () => void;
  permissions: PermissionSnapshot | null;
  refreshPermissions: () => Promise<void>;
  notifPrefs: NotificationPrefs;
  updateNotifPrefs: (patch: Partial<NotificationPrefs>) => Promise<void>;
  alarmsSyncedAt: number;
  forceResync: () => Promise<void>;
  reloadFromDisk: () => void;
  replaceAllData: (patch: Record<string, unknown>) => void;
}

const Ctx = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

const EVENT_PRIORITY: Record<StreakEvent["type"], number> = {
  gift: 6,
  broken: 5,
  protected: 4,
  earned: 3,
  "vacation-capped": 2,
  perfect: 1,
};

function buildAppData(): AppData {
  localRitualSync();
  const db = loadDB();
  return {
    tasks: db.tasks,
    rituals: buildDTOs(db),
    tags: db.tags,
    habits: db.habits,
    logs: db.logs,
    sessions: db.sessions,
    intent: db.intents.find((i) => i.day === todayISO()) ?? null,
    streak: {
      state: db.streakState,
      records: db.records,
      vacationDays: db.vacations,
      settings: db.settings,
    },
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(() => buildAppData());
  const [name, setName] = useState("");
  const [openedOn, setOpenedOn] = useState(() => todayISO());
  const [tab, setTab] = useState<TabId>("today");

  const [taskSheet, setTaskSheet] = useState<TaskSheetState>(null);
  const [habitSheetOpen, setHabitSheetOpen] = useState(false);
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ritualForm, setRitualForm] = useState<RitualFormState>(null);
  const [ritualDetailId, setRitualDetailId] = useState<number | null>(null);
  const [focusPreset, setFocusPresetState] = useState<FocusPreset | null>(null);

  const [toastState, setToastState] = useState<{ id: number; text: string } | null>(null);
  const [notice, setNotice] = useState<StreakNotice | null>(null);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [alarm, setAlarm] = useState<ActiveAlarm | null>(null);
  const [resolveItems, setResolveItems] = useState<TaskDTO[] | null>(null);
  const [missedAlarms, setMissedAlarms] = useState<TaskDTO[]>([]);

  const [streakState, setStreakState] = useState<StreakStateDTO>(() => loadDB().streakState);
  const [records, setRecords] = useState<DayRecordDTO[]>(() => loadDB().records);
  const [vacationDays, setVacationDays] = useState<Set<string>>(() => new Set(loadDB().vacations));
  const [streakSettings, setStreakSettings] = useState<StreakSettingsDTO>(() => loadDB().settings);
  const [rituals, setRituals] = useState<RitualDTO[]>(() => buildDTOs());

  const [permissions, setPermissions] = useState<PermissionSnapshot | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() => loadPrefs());
  const [alarmsSyncedAt, setAlarmsSyncedAt] = useState(0);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  const alarmRef = useRef<ActiveAlarm | null>(null);
  const streakBusyRef = useRef(false);
  const resolveRanRef = useRef(false);
  const streakStateRef = useRef(streakState);
  const recordsRef = useRef(records);
  const vacationRef = useRef(vacationDays);
  const settingsRef = useRef(streakSettings);
  const bootstrapRef = useRef(false);

  dataRef.current = data;
  alarmRef.current = alarm;

  // ── Toasts & notices ────────────────────────────────────────────────────
  const toast = useCallback((text: string) => {
    const id = Date.now();
    setToastState({ id, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastState((t) => (t && t.id === id ? null : t));
    }, 2600);
  }, []);

  const showNotice = useCallback((title: string, body: string) => {
    const id = Date.now();
    setNotice({ id, title, body });
    setTimeout(() => setNotice((n) => (n && n.id === id ? null : n)), 9000);
  }, []);

  // ── Streak evaluation (ported from the web tick) ────────────────────────
  const streakTick = useCallback(async () => {
    if (streakBusyRef.current) return;
    streakBusyRef.current = true;
    try {
      const now = new Date();
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

      if (result.events.length > 0) {
        const sorted = [...result.events].sort((a, b) => EVENT_PRIORITY[b.type] - EVENT_PRIORITY[a.type]);
        toast(sorted[0].message);
        if (result.events.some((e) => e.type === "broken" || e.type === "protected" || e.type === "earned" || e.type === "gift")) {
          const top = sorted[0];
          showNotice("Streak", top.message);
        }
      }
    } catch {
      // engine errors must never break the loop
    } finally {
      streakBusyRef.current = false;
    }
  }, [showNotice, toast]);

  // ── Boot ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (bootstrapRef.current) return;
    bootstrapRef.current = true;

    const db = loadDB();
    setName(db.profile.name);
    setOpenedOn(ensureOpenedOn());

    // First materialisation of rituals → tasks for today.
    localRitualSync();
    const fresh = buildAppData();
    setData(fresh);
    setRituals(fresh.rituals);
    setReady(true);

    // Leftovers from previous days → the resolver sheet.
    if (!resolveRanRef.current) {
      resolveRanRef.current = true;
      const pending = pendingCarryTasks(loadDB().tasks, todayISO());
      if (pending.length > 0) setResolveItems(pending);
    }
    // Alarms that rang earlier and were never acknowledged.
    const now = Date.now();
    setMissedAlarms(
      loadDB().tasks.filter((t) => {
        if (t.done || t.missed || !t.time) return false;
        const at = fromISO(t.day);
        const [h, m] = t.time.split(":").map(Number);
        at.setHours(h || 0, m || 0, 0, 0);
        const delta = now - at.getTime();
        return delta > 0 && delta < 12 * 3600 * 1000;
      })
    );

    void (async () => {
      await ensureChannels();
      await ensureCategories();
      installNativeAlarmHandlers();
      await bootstrapNotifications();
      // Whatever was pressed while Ledger was closed (Done / Snooze / Stop on
      // a notification, or a button on the lock-screen ring) is applied once.
      await drainNativeActions();
      await registerBackgroundSync();
      setAlarmsSyncedAt(Date.now());
      setPermissions(await getPermissionSnapshot());
      // A soft first ask; the onboarding screen owns the full permission walk.
      const prefs = loadPrefs();
      if (prefs.alarms || prefs.reminders) void requestNotificationPermission();
    })();

    // Launched *by* an alarm: the native ring is authoritative and outlives
    // the process, so the ringing screen comes straight back up.
    const ringing = ringingOnLaunch();
    if (ringing) {
      const next: ActiveAlarm = {
        key: ringing.key,
        kind: ringing.kind,
        taskId: ringing.taskId,
        ritualId: ringing.ritualId,
        title: ringing.title,
        body: ringing.body,
        snoozeCount: snoozeCountFor(ringing.key),
      };
      alarmRef.current = next;
      setAlarm(next);
      void startRinging();
      setTab("today");
    }

    void streakTick();
  }, [streakTick]);

  // ── Timers: clock + streak tick ─────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      void streakTick();
    }, 60_000);
    return () => clearInterval(tick);
  }, [streakTick]);

  // ── Re-plan alarms whenever the data changes ────────────────────────────
  useEffect(() => {
    const off = onDBPersist(() => {
      void syncAlarms("data-change").then(() => setAlarmsSyncedAt(Date.now()));
    });
    return off;
  }, []);

  // ── Lifecycle: re-arm on foreground, flush on background ────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        void streakTick();
        void drainNativeActions().then(() => syncAlarms("foreground", { immediate: true })).then(() => setAlarmsSyncedAt(Date.now()));
        void getPermissionSnapshot().then(setPermissions);
      }
      if (state === "background" || state === "inactive") {
        flushDB();
      }
    });
    return () => sub.remove();
  }, [streakTick]);

  // ── Ringing: the OS fired an alarm, or the user tapped one ──────────────
  useEffect(() => {
    const off = addAlarmRingListener((fired) => {
      const current = alarmRef.current;
      if (current && current.key === fired.key) return;
      const next: ActiveAlarm = {
        key: fired.key,
        kind: fired.kind,
        taskId: fired.taskId,
        ritualId: fired.ritualId,
        title: fired.title,
        body: fired.body,
        snoozeCount: snoozeCountFor(fired.key),
      };
      alarmRef.current = next;
      setAlarm(next);
      void startRinging();
      setTab("today");
    });
    return off;
  }, []);

  // ── Task operations ────────────────────────────────────────────────────
  const addTask = useCallback(
    async (input: TaskInput) => {
      const created = await api<TaskDTO>("/api/tasks", { method: "POST", body: JSON.stringify(input) });
      setData((d) => ({ ...d, tasks: [...d.tasks, created] }));
      flushDB();
      void syncAlarms("task-added");
      toast("Task added");
    },
    [toast]
  );

  const updateTask = useCallback(
    async (id: number, patch: TaskPatch) => {
      const updated = await api<TaskDTO>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? updated : t)) }));
      if (patch.done || patch.missed) clearSnooze(`alarm:${updated.id}:${updated.day}:${updated.time ?? ""}`);
      flushDB();
      void syncAlarms("task-updated");
      toast("Saved");
      void streakTick();
    },
    [streakTick, toast]
  );

  const deleteTask = useCallback(
    async (id: number) => {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
      flushDB();
      void syncAlarms("task-deleted");
      toast("Task deleted");
    },
    [toast]
  );

  const toggleTask = useCallback(
    async (id: number) => {
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
      try {
        const updated = await api<TaskDTO>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: true }) });
        setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? updated : t)) }));
        clearSnooze(`alarm:${task.id}:${task.day}:${task.time ?? ""}`);
        flushDB();
        void syncAlarms("task-completed");
        toast("Done ✓");
        void streakTick();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [streakTick, toast]
  );

  const removeResolveItem = useCallback((id: number) => {
    setResolveItems((r) => {
      if (!r) return r;
      const next = r.filter((t) => t.id !== id);
      return next.length > 0 ? next : null;
    });
  }, []);

  const carryTask = useCallback(
    async (id: number) => {
      const task = dataRef.current.tasks.find((t) => t.id === id);
      if (!task) return;
      if (task.carries >= CARRY_LIMIT) {
        toast("Carry limit reached — mark it missed");
        return;
      }
      try {
        const updated = await api<TaskDTO>(`/api/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ day: todayISO(), carries: task.carries + 1 }),
        });
        setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? updated : t)) }));
        removeResolveItem(id);
        flushDB();
        void syncAlarms("task-carried");
        toast("Carried to today");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [removeResolveItem, toast]
  );

  const missTask = useCallback(
    async (id: number) => {
      try {
        const updated = await api<TaskDTO>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ missed: true }) });
        setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? updated : t)) }));
        removeResolveItem(id);
        setMissedAlarms((list) => list.filter((t) => t.id !== id));
        flushDB();
        void syncAlarms("task-missed");
        toast("Marked missed");
        void streakTick();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [removeResolveItem, streakTick, toast]
  );

  const syncRituals = useCallback(async () => {
    const res = await api<{ rituals: RitualDTO[]; tasks: TaskDTO[] }>("/api/rituals/sync", { method: "POST" });
    setRituals(res.rituals);
    setData((d) => ({ ...d, tasks: res.tasks }));
    flushDB();
    void syncAlarms("ritual-sync");
  }, []);

  const resolveLeftovers = useCallback(
    async (day: string, mode: "carry" | "miss") => {
      const today = todayISO();
      const pending = dataRef.current.tasks.filter((t) => t.day === day && !t.done && !t.missed);
      if (pending.length === 0) return;
      let carried = 0;
      let missed = 0;
      for (const t of pending) {
        if (mode === "carry" && t.carries < CARRY_LIMIT) {
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
      const fresh = buildAppData();
      setData(fresh);
      await syncRituals();
      toast(
        mode === "carry"
          ? carried > 0
            ? `Carried ${carried} to today${missed > 0 ? `, missed ${missed}` : ""}`
            : `Carry limit hit — missed ${missed}`
          : `Missed ${missed} — owned it`
      );
      void streakTick();
    },
    [streakTick, syncRituals, toast]
  );

  // ── Habits ─────────────────────────────────────────────────────────────
  const addHabit = useCallback(
    async (input: HabitInput) => {
      const created = await api<AppData["habits"][number]>("/api/habits", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setData((d) => ({ ...d, habits: [...d.habits, created] }));
      flushDB();
      toast("Ritual habit created");
    },
    [toast]
  );

  const deleteHabit = useCallback(
    async (id: number) => {
      await api(`/api/habits/${id}`, { method: "DELETE" });
      setData((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id), logs: d.logs.filter((l) => l.habitId !== id) }));
      flushDB();
      toast("Habit deleted");
    },
    [toast]
  );

  const toggleLog = useCallback(async (habitId: number, day: string) => {
    const existing = dataRef.current.logs.find((l) => l.habitId === habitId && l.day === day);
    setData((d) =>
      existing
        ? { ...d, logs: d.logs.filter((l) => l.id !== existing.id) }
        : { ...d, logs: [...d.logs, { id: -Date.now(), habitId, day }] }
    );
    await api(`/api/habits/${habitId}/toggle`, { method: "POST", body: JSON.stringify({ day }) });
    flushDB();
  }, []);

  // ── Intent, focus, tags ────────────────────────────────────────────────
  const setIntent = useCallback(async (text: string) => {
    const day = todayISO();
    setData((d) => ({ ...d, intent: text ? { day, text } : null }));
    await api("/api/intent", { method: "POST", body: JSON.stringify({ day, text }) });
    flushDB();
  }, []);

  const addSession = useCallback(
    async (label: string, durationMin: number) => {
      const s = await api<SessionDTO>("/api/focus", { method: "POST", body: JSON.stringify({ label, durationMin }) });
      setData((d) => ({ ...d, sessions: [s, ...d.sessions] }));
      flushDB();
      toast(`Logged ${durationMin} min`);
    },
    [toast]
  );

  const addTag = useCallback(async (nameRaw: string): Promise<string | null> => {
    const clean = nameRaw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) return null;
    if (dataRef.current.tags.some((t) => t.name === clean)) return clean;
    const color = TAG_PALETTE[dataRef.current.tags.length % TAG_PALETTE.length];
    setData((d) => ({ ...d, tags: [...d.tags, { name: clean, color }] }));
    try {
      await api("/api/tags", { method: "POST", body: JSON.stringify({ name: clean, color }) });
      flushDB();
      return clean;
    } catch {
      return null;
    }
  }, []);

  const deleteTag = useCallback(
    async (tagName: string) => {
      await api(`/api/tags/${encodeURIComponent(tagName)}`, { method: "DELETE" });
      setData((d) => ({ ...d, tags: d.tags.filter((t) => t.name !== tagName) }));
      flushDB();
      toast("Tag deleted");
    },
    [toast]
  );

  // ── Streak / vacation / settings ───────────────────────────────────────
  const scheduleVacation = useCallback(
    async (start: string, end: string, openEnded: boolean): Promise<string | null> => {
      try {
        const today = todayISO();
        if (openEnded) {
          if (streakStateRef.current.vacationOpenStart) return "An open vacation is already running";
          await api("/api/streak/vacation", { method: "POST", body: JSON.stringify({ startOpen: start }) });
          const s = { ...streakStateRef.current, vacationOpenStart: start };
          streakStateRef.current = s;
          setStreakState(s);
          void api("/api/streak/state", { method: "POST", body: JSON.stringify(s) });
          flushDB();
          void syncAlarms("vacation");
          toast("Vacation started — streak frozen");
          return null;
        }
        if (start < today) return "Vacation can't start in the past";
        if (end < start) return "End day must be after start day";
        const days: string[] = [];
        let cursor = start;
        while (cursor <= end && days.length < 400) {
          days.push(cursor);
          const d = fromISO(cursor);
          d.setDate(d.getDate() + 1);
          cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
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
        flushDB();
        void syncAlarms("vacation");
        toast("Vacation scheduled");
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "Failed";
      }
    },
    [toast]
  );

  const removeVacationDay = useCallback(
    async (day: string) => {
      await api("/api/streak/vacation", { method: "POST", body: JSON.stringify({ removeDay: day }) });
      const merged = new Set(vacationRef.current);
      merged.delete(day);
      vacationRef.current = merged;
      setVacationDays(merged);
      flushDB();
      void syncAlarms("vacation");
      toast("Vacation day removed");
    },
    [toast]
  );

  const endOpenVacation = useCallback(async () => {
    await api("/api/streak/vacation", { method: "POST", body: JSON.stringify({ endOpen: true }) });
    const s = { ...streakStateRef.current, vacationOpenStart: null };
    streakStateRef.current = s;
    setStreakState(s);
    void api("/api/streak/state", { method: "POST", body: JSON.stringify(s) });
    flushDB();
    void syncAlarms("vacation");
    toast("Vacation ended — the streak is live");
  }, [toast]);

  const updateStreakSettings = useCallback(
    async (patch: Partial<StreakSettingsDTO>) => {
      const merged = { ...settingsRef.current, ...patch };
      settingsRef.current = merged;
      setStreakSettings(merged);
      await api("/api/streak/settings", { method: "POST", body: JSON.stringify(patch) });
      flushDB();
      void syncAlarms("settings");
    },
    []
  );

  // ── Rituals ────────────────────────────────────────────────────────────
  const createRitual = useCallback(
    async (input: RitualCreateInput, force = false) => {
      const res = await api<{ duplicate?: { id: number; name: string }; created?: number }>("/api/rituals", {
        method: "POST",
        body: JSON.stringify({ ...input, force }),
      });
      if (res.duplicate) return res.duplicate;
      await syncRituals();
      setRitualForm(null);
      toast("Ritual created");
      return null;
    },
    [syncRituals, toast]
  );

  const ritualAction = useCallback(
    async (ritualId: number, action: string, payload?: Record<string, unknown>) => {
      await api(`/api/rituals/${ritualId}/action`, { method: "POST", body: JSON.stringify({ action, payload }) });
      await syncRituals();
      if (action === "edit") toast("Ritual updated");
      else if (action === "renew") toast("Commitment renewed");
      else if (action === "end-early") toast("Commitment ended");
      else toast("Ritual archived");
    },
    [syncRituals, toast]
  );

  const deleteRitual = useCallback(
    async (ritualId: number) => {
      await api(`/api/rituals/${ritualId}`, { method: "DELETE" });
      await syncRituals();
      toast("Ritual deleted");
    },
    [syncRituals, toast]
  );

  // ── Alarm controls ─────────────────────────────────────────────────────
  const closeAlarm = useCallback(() => {
    stopRinging();
    if (nativeAlarmsAvailable) LedgerAlarm.stopRinging();
    alarmRef.current = null;
    setAlarm(null);
  }, []);

  const snoozeActiveAlarm = useCallback(async () => {
    const current = alarmRef.current;
    if (!current) return;
    const task = current.taskId != null ? dataRef.current.tasks.find((t) => t.id === current.taskId) : undefined;
    const ok = await snoozeAlarm({
      key: current.key,
      kind: current.kind,
      day: task?.day ?? todayISO(),
      taskId: current.taskId ?? undefined,
      ritualId: current.ritualId ?? undefined,
      title: current.title,
      body: current.body,
      soft: current.kind === "TASK_REMINDER" || current.kind === "MUST_LEAD",
    });
    closeAlarm();
    toast(ok ? "Snoozed" : "Snooze limit reached");
  }, [closeAlarm, toast]);

  const resolveAlarmTask = useCallback(
    async (taskId: number) => {
      await toggleTask(taskId);
      closeAlarm();
    },
    [closeAlarm, toggleTask]
  );

  const dismissReminder = useCallback((key: string) => {
    setReminders((r) => r.filter((x) => x.key !== key));
  }, []);

  const dismissMissed = useCallback((id: number) => {
    setMissedAlarms((list) => list.filter((t) => t.id !== id));
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  // ── Permissions & notification prefs ───────────────────────────────────
  const refreshPermissions = useCallback(async () => {
    setPermissions(await getPermissionSnapshot());
  }, []);

  const updateNotifPrefs = useCallback(
    async (patch: Partial<NotificationPrefs>) => {
      const next = savePrefs(patch);
      setNotifPrefs(next);
      if (patch.aggressiveDelivery) {
        await requestBatteryExemption();
      }
      await syncAlarms("prefs", { immediate: true, force: true });
      setAlarmsSyncedAt(Date.now());
      await refreshPermissions();
    },
    [refreshPermissions]
  );

  const forceResync = useCallback(async () => {
    await syncAlarms("manual-force", { immediate: true, force: true });
    setAlarmsSyncedAt(Date.now());
  }, []);

  const reloadFromDisk = useCallback(() => {
    reloadDB();
    localRitualSync();
    const fresh = buildAppData();
    setData(fresh);
    setRituals(fresh.rituals);
    setStreakState(fresh.streak.state);
    setRecords(fresh.streak.records);
    setVacationDays(new Set(fresh.streak.vacationDays));
    setStreakSettings(fresh.streak.settings);
    streakStateRef.current = fresh.streak.state;
    recordsRef.current = fresh.streak.records;
    vacationRef.current = new Set(fresh.streak.vacationDays);
    settingsRef.current = fresh.streak.settings;
    void syncAlarms("reload", { immediate: true, force: true });
  }, []);

  const replaceAllData = useCallback(
    (patch: Record<string, unknown>) => {
      replaceDB(patch);
      reloadFromDisk();
    },
    [reloadFromDisk]
  );

  const updateProfileName = useCallback((next: string) => {
    const db = loadDB();
    setProfileName(db, next);
    setName(next);
    flushDB();
  }, []);

  const status = useMemo<StreakStatus>(
    () =>
      getStreakStatus({
        now: new Date(),
        tasks: data.tasks,
        state: streakState,
        records: Object.fromEntries(records.map((r) => [r.day, r])),
        vacationDays,
        settings: streakSettings,
      }),
    [data.tasks, records, streakSettings, streakState, vacationDays]
  );

  const apiValue = useMemo<AppApi>(
    () => ({
      ready,
      data,
      profileName: name,
      openedOn,
      setProfileName: updateProfileName,
      tab,
      setTab,
      openTaskSheet: (day?: string) => setTaskSheet({ mode: "create", day: day ?? todayISO() }),
      editTaskSheet: (task: TaskDTO) => setTaskSheet({ mode: "edit", task }),
      openHabitSheet: () => setHabitSheetOpen(true),
      openSettings: () => setSettingsOpen(true),
      taskSheet,
      closeTaskSheet: () => setTaskSheet(null),
      habitSheetOpen,
      closeHabitSheet: () => setHabitSheetOpen(false),
      streakSheetOpen,
      closeStreakSheet: () => setStreakSheetOpen(false),
      settingsOpen,
      closeSettings: () => setSettingsOpen(false),
      ritualForm,
      closeRitualForm: () => setRitualForm(null),
      ritualDetail: ritualDetailId != null ? rituals.find((r) => r.id === ritualDetailId) ?? null : null,
      closeRitualDetail: () => setRitualDetailId(null),
      addTask,
      updateTask,
      deleteTask,
      toggleTask,
      carryTask,
      missTask,
      resolveLeftovers,
      addHabit,
      deleteHabit,
      toggleLog,
      setIntent,
      addSession,
      toast,
      toastText: toastState?.text ?? null,
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
      consumeFocusPreset: () => setFocusPresetState(null),
      setFocusPreset: (preset: FocusPreset) => setFocusPresetState(preset),
      rituals,
      openRitualCreate: () => setRitualForm({ mode: "create" }),
      openRitualEdit: (ritualId: number) => setRitualForm({ mode: "edit", ritualId }),
      openRitualDetail: (ritual: RitualDTO) => setRitualDetailId(ritual.id),
      createRitual,
      ritualAction,
      deleteRitual,
      syncRituals,
      alarm,
      closeAlarm,
      snoozeActiveAlarm,
      resolveAlarmTask,
      reminders,
      dismissReminder,
      resolveItems,
      missedAlarms,
      dismissMissed,
      notice,
      dismissNotice,
      permissions,
      refreshPermissions,
      notifPrefs,
      updateNotifPrefs,
      alarmsSyncedAt,
      forceResync,
      reloadFromDisk,
      replaceAllData,
    }),
    [
      addHabit,
      addSession,
      addTag,
      addTask,
      alarm,
      alarmsSyncedAt,
      carryTask,
      closeAlarm,
      createRitual,
      data,
      deleteHabit,
      deleteRitual,
      deleteTag,
      deleteTask,
      dismissMissed,
      dismissNotice,
      dismissReminder,
      endOpenVacation,
      focusPreset,
      forceResync,
      habitSheetOpen,
      missTask,
      missedAlarms,
      name,
      notifPrefs,
      notice,
      openedOn,
      permissions,
      ready,
      records,
      refreshPermissions,
      reloadFromDisk,
      reminders,
      removeVacationDay,
      replaceAllData,
      resolveAlarmTask,
      resolveItems,
      resolveLeftovers,
      rituals,
      scheduleVacation,
      settingsOpen,
      snoozeActiveAlarm,
      status,
      streakSettings,
      streakSheetOpen,
      streakState,
      syncRituals,
      tab,
      taskSheet,
      toast,
      toastState,
      toggleLog,
      toggleTask,
      updateNotifPrefs,
      updateProfileName,
      updateStreakSettings,
      updateTask,
      vacationDays,
    ]
  );

  return <Ctx.Provider value={apiValue}>{children}</Ctx.Provider>;
}

export type { HttpError };
