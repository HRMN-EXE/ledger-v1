// ─── Alarm engine (native-first) ────────────────────────────────────────────
// Ledger hands its plan to the `LedgerAlarm` native module, which arms real
// AlarmManager clock alarms (`setAlarmClock`), rings through a foreground
// service, takes over the lock screen, and re-arms itself after a reboot
// without the app ever being opened.
//
// When that module is missing (Expo Go, web, a dev client that predates it),
// the same plan is scheduled through expo-notifications instead, so Ledger
// always has *some* delivery channel — worst case an in-app banner.
//
// Reconciliation is a diff: plan → compare with what the OS already holds →
// cancel what vanished, schedule what is new. Cheap enough to run on every
// data change, on every foreground, and from the background worker.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import LedgerAlarm, { nativeAlarmsAvailable, type NativeAlarm } from "@/lib/ledger-alarm";
import { api } from "@/lib/api";
import { loadDB } from "@/lib/localdb";
import {
  ACTION_DONE,
  ACTION_SNOOZE,
  categoryFor,
  channelFor,
  ensureCategories,
  ensureChannels,
  soundFor,
} from "./channels";
import { planAlarms, type PlannedAlarm } from "./plan";
import {
  addExtra,
  clearExtras,
  dropExtra,
  dropOutbox,
  loadExtras,
  loadPrefs,
  loadScheduled,
  loadSnoozes,
  pushOutbox,
  saveScheduled,
  saveSnoozes,
  type ScheduledMap,
} from "./prefs";

export const MAX_SNOOZES = 2;
export const SNOOZE_MINUTES = 10;
export const REMINDER_SNOOZE_MINUTES = 5;

let syncChain: Promise<void> = Promise.resolve();
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let lastSyncAt = 0;

function signatureOf(alarm: PlannedAlarm): string {
  return [alarm.kind, alarm.fireAt, alarm.title, alarm.body, alarm.priority].join("|");
}

/** Cold-start handler: what a notification looks like while the app is open. */
export function installNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const kind = String(notification.request.content.data?.kind ?? "");
      const isAlarm = kind === "TASK_ALARM";
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        // The in-app alarm screen owns the ringing experience; the OS banner
        // still shows so the alert is never silently swallowed.
        priority: isAlarm
          ? Notifications.AndroidNotificationPriority.MAX
          : Notifications.AndroidNotificationPriority.HIGH,
      };
    },
  });
}

function toNative(alarm: PlannedAlarm): NativeAlarm {
  const data = alarm.data as Record<string, string | number | undefined>;
  return {
    key: alarm.key,
    kind: alarm.kind,
    fireAt: alarm.fireAt,
    priority: alarm.priority,
    title: alarm.title,
    body: alarm.body,
    taskId: typeof data?.taskId === "number" ? data.taskId : null,
    ritualId: typeof data?.ritualId === "number" ? data.ritualId : null,
    day: typeof data?.day === "string" ? data.day : null,
  };
}

/**
 * armNative — the whole plan goes over in one call. The native side diffs it
 * against what AlarmManager already holds, so this is safe to call constantly.
 */
async function armNative(planned: PlannedAlarm[]): Promise<number> {
  const extras = loadExtras();
  const payload: NativeAlarm[] = [
    ...planned.map(toNative),
    ...extras.map((extra) => ({
      key: extra.key,
      kind: extra.kind,
      fireAt: extra.fireAt,
      priority: extra.priority,
      title: extra.title,
      body: extra.body,
      taskId: typeof extra.data?.taskId === "number" ? extra.data.taskId : null,
      ritualId: typeof extra.data?.ritualId === "number" ? extra.data.ritualId : null,
      day: typeof extra.data?.day === "string" ? extra.data.day : null,
    })),
  ];
  // A key can exist in both sets after a re-plan re-creates a snoozed alarm —
  // the surviving copy with the newest fireAt wins.
  const deduped = new Map<string, NativeAlarm>();
  for (const alarm of payload) {
    const previous = deduped.get(alarm.key);
    if (!previous || alarm.fireAt > previous.fireAt) deduped.set(alarm.key, alarm);
  }
  return LedgerAlarm.setAlarms([...deduped.values()]);
}

async function scheduleOne(alarm: PlannedAlarm): Promise<string | null> {
  if (nativeAlarmsAvailable) {
    // Snoozes (and anything else scheduled outside the plan) are remembered in
    // storage and pushed to AlarmManager straight away — the diff would
    // otherwise forget them the next time the plan is rebuilt.
    addExtra({
      key: alarm.key,
      kind: alarm.kind,
      fireAt: alarm.fireAt,
      priority: alarm.priority,
      title: alarm.title,
      body: alarm.body,
      data: alarm.data,
    });
    await armNative(planAlarms(loadDB(), new Date(), { prefs: loadPrefs() }));
    return `native:${alarm.key}`;
  }
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: alarm.title,
        body: alarm.body,
        sound: soundFor(alarm.priority),
        categoryIdentifier: categoryFor(alarm.kind),
        // Android: required for expo-notifications to ask AlarmManager for an
        // *exact* alarm (setExactAndAllowWhileIdle) instead of an inexact one.
        priority:
          alarm.priority === "alarm"
            ? Notifications.AndroidNotificationPriority.MAX
            : alarm.priority === "reminder"
              ? Notifications.AndroidNotificationPriority.HIGH
              : Notifications.AndroidNotificationPriority.DEFAULT,
        interruptionLevel: alarm.priority === "alarm" ? "timeSensitive" : "active",
        autoDismiss: true,
        data: { ...alarm.data, plannedAt: Date.now() },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(alarm.fireAt),
        channelId: channelFor(alarm.priority),
      },
    });
  } catch {
    return null;
  }
}

async function cancelOne(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired or already gone
  }
}

/** Diff the plan against the OS and make them agree. */
async function reconcile(reason: string, force: boolean): Promise<void> {
  const prefs = loadPrefs();
  const db = loadDB();
  const planned = prefs.alarms || prefs.reminders || prefs.ritualReminders
    ? planAlarms(db, new Date(), { prefs })
    : [];

  if (nativeAlarmsAvailable) {
    // One call, native diffing, real clock alarms. Nothing to mirror here:
    // `getArmed()` is the truth and it lives in AlarmManager.
    const armed = await armNative(planned);
    lastSyncAt = Date.now();
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[alarms] ${reason}: ${armed} armed (native, ${planned.length} planned)`);
    }
    return;
  }

  const existing: ScheduledMap = force ? {} : loadScheduled();
  const next: ScheduledMap = {};
  let cancelled = 0;
  let scheduled = 0;

  const plannedKeys = new Set(planned.map((a) => a.key));

  const extras = loadExtras();
  if (extras.length > 0) {
    // Snoozes live outside the plan diff (the plan only ever describes the
    // *data*, not the user's one-off deferrals), so they are mirrored here.
    for (const extra of extras) {
      const id = await scheduleOne(extra as unknown as PlannedAlarm);
      if (id) next[extra.key] = { id, at: extra.fireAt, signature: `extra|${extra.kind}|${extra.fireAt}` };
    }
  }


  for (const [key, entry] of Object.entries(existing)) {
    if (!plannedKeys.has(key)) {
      await cancelOne(entry.id);
      cancelled++;
    }
  }

  for (const alarm of planned) {
    const signature = signatureOf(alarm);
    const prev = existing[alarm.key];
    if (prev && prev.signature === signature && prev.at === alarm.fireAt) {
      next[alarm.key] = prev;
      continue;
    }
    if (prev) {
      await cancelOne(prev.id);
      cancelled++;
    }
    const id = await scheduleOne(alarm);
    if (id) {
      next[alarm.key] = { id, at: alarm.fireAt, signature };
      scheduled++;
    }
  }

  if (force) {
    // Anything the OS still holds that we no longer track (app reinstall,
    // interrupted write) would otherwise linger forever.
    try {
      const osScheduled = await Notifications.getAllScheduledNotificationsAsync();
      const known = new Set(Object.values(next).map((e) => e.id));
      for (const item of osScheduled) {
        if (!known.has(item.identifier)) {
          await cancelOne(item.identifier);
          cancelled++;
        }
      }
    } catch {
      // best effort
    }
  }

  saveScheduled(next);
  lastSyncAt = Date.now();
  if (__DEV__ && (scheduled || cancelled)) {
    // eslint-disable-next-line no-console
    console.log(`[alarms] ${reason}: +${scheduled} −${cancelled} (${planned.length} planned)`);
  }
}

/** Serialised + debounced — safe to call from anywhere, as often as you like. */
export function syncAlarms(reason = "manual", options: { immediate?: boolean; force?: boolean } = {}): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve();
  const immediate = options.immediate ?? false;
  const force = options.force ?? false;

  if (immediate) {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    syncChain = syncChain.then(() => reconcile(reason, force)).catch(() => undefined);
    return syncChain;
  }

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncChain = syncChain.then(() => reconcile(reason, force)).catch(() => undefined);
  }, 600);
  return syncChain;
}

/** Wipe every pending alarm (used by Settings → "Alarms off"). */
export async function cancelAllAlarms(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
  saveScheduled({});
  clearExtras();
  if (nativeAlarmsAvailable) await LedgerAlarm.cancelAll();
}

// ─── Snooze ─────────────────────────────────────────────────────────────────

export function snoozeCountFor(key: string): number {
  return loadSnoozes()[key] ?? 0;
}

export function bumpSnooze(key: string): number {
  const map = loadSnoozes();
  const next = (map[key] ?? 0) + 1;
  map[key] = next;
  saveSnoozes(map);
  return next;
}

export function clearSnooze(key: string): void {
  const map = loadSnoozes();
  if (map[key] != null) {
    delete map[key];
    saveSnoozes(map);
  }
}

/**
 * Re-arm an alarm a few minutes out. Returns false when the snooze budget for
 * that alarm is spent.
 */
export async function snoozeAlarm(data: {
  key: string;
  kind?: string;
  day?: string;
  taskId?: number;
  ritualId?: number;
  title: string;
  body: string;
  minutes?: number;
  soft?: boolean;
}): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const count = snoozeCountFor(data.key);
  if (count >= MAX_SNOOZES) return false;
  const minutes = data.minutes ?? (data.kind === "TASK_REMINDER" ? REMINDER_SNOOZE_MINUTES : SNOOZE_MINUTES);
  bumpSnooze(data.key);

  const fireAt = Date.now() + minutes * 60_000;
  const priority = data.soft ? "reminder" : "alarm";
  const alarm: PlannedAlarm = {
    key: `snooze:${data.key}:${count + 1}`,
    kind: (data.kind as PlannedAlarm["kind"]) ?? "TASK_ALARM",
    fireAt,
    priority,
    title: data.title,
    body: `Snoozed ${minutes} min · ${data.body}`,
    data: {
      kind: (data.kind as PlannedAlarm["kind"]) ?? "TASK_ALARM",
      key: data.key,
      day: data.day ?? "",
      taskId: data.taskId,
      ritualId: data.ritualId,
    },
  };
  const id = await scheduleOne(alarm);
  if (!id) return false;
  const map = loadScheduled();
  map[alarm.key] = { id, at: fireAt, signature: signatureOf(alarm) };
  saveScheduled(map);
  return true;
}

// ─── Notification interactions ──────────────────────────────────────────────

export interface FiredAlarm {
  key: string;
  kind: string;
  title: string;
  body: string;
  taskId: number | null;
  ritualId: number | null;
  firedAt: number;
}

type RingListener = (alarm: FiredAlarm) => void;
const ringListeners = new Set<RingListener>();

/** UI subscribes here to show the in-app ringing screen. */
export function addAlarmRingListener(fn: RingListener): () => void {
  ringListeners.add(fn);
  return () => ringListeners.delete(fn);
}

export function emitInAppRing(alarm: FiredAlarm): void {
  for (const fn of [...ringListeners]) {
    try {
      fn(alarm);
    } catch {
      // listener errors never break the alarm
    }
  }
}

export function isAlarmKind(kind: string): boolean {
  return kind === "TASK_ALARM" || kind === "RITUAL" || kind === "MUST_LEAD";
}

/** Mark a task (or its ritual instance) complete straight from the shade. */
export async function completeFromNotification(taskId: number | null, title: string): Promise<void> {
  if (taskId == null) return;
  try {
    await api(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ done: true }) });
    clearSnooze(`alarm:${taskId}`);
    void syncAlarms("task-completed", { immediate: true });
  } catch {
    // task may already be gone
  }
  void title;
}

/** Called for every notification the user interacts with (or cold-start tap). */
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<void> {
  const content = response.notification.request.content;
  const data = (content.data ?? {}) as Record<string, string | number | undefined>;
  const kind = String(data.kind ?? "");
  const key = String(data.key ?? response.notification.request.identifier);
  const taskId = typeof data.taskId === "number" ? data.taskId : null;
  const ritualId = typeof data.ritualId === "number" ? data.ritualId : null;
  const title = content.title ?? "Ledger";
  const body = content.body ?? "";

  if (response.actionIdentifier === ACTION_DONE) {
    await completeFromNotification(taskId, title);
    dropOutbox(key);
    return;
  }

  if (response.actionIdentifier === ACTION_SNOOZE) {
    await snoozeAlarm({
      key,
      kind,
      day: typeof data.day === "string" ? data.day : undefined,
      taskId: taskId ?? undefined,
      ritualId: ritualId ?? undefined,
      title,
      body,
      soft: kind === "TASK_REMINDER" || kind === "MUST_LEAD",
      minutes: kind === "TASK_REMINDER" ? REMINDER_SNOOZE_MINUTES : SNOOZE_MINUTES,
    });
    dropOutbox(key);
    return;
  }

  // Plain tap → the app opens on the ringing screen for alarms, and simply
  // acknowledges the notification for everything else.
  dropOutbox(key);
  if (isAlarmKind(kind)) {
    emitInAppRing({
      key,
      kind,
      title,
      body,
      taskId,
      ritualId,
      firedAt: Date.now(),
    });
  }
}

/** Wires the listeners once per process. */
export async function bootstrapNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  await ensureChannels();
  await ensureCategories();
  installNotificationHandler();

  Notifications.addNotificationReceivedListener((notification) => {
    const content = notification.request.content;
    const data = (content.data ?? {}) as Record<string, string | number | undefined>;
    const kind = String(data.kind ?? "");
    const key = String(data.key ?? notification.request.identifier);
    const firedAt = Date.now();
    pushOutbox({
      key,
      kind,
      taskId: typeof data.taskId === "number" ? data.taskId : null,
      ritualId: typeof data.ritualId === "number" ? data.ritualId : null,
      title: content.title ?? "Ledger",
      body: content.body ?? "",
      firedAt,
    });
    if (isAlarmKind(kind)) {
      emitInAppRing({
        key,
        kind,
        title: content.title ?? "Ledger",
        body: content.body ?? "",
        taskId: typeof data.taskId === "number" ? data.taskId : null,
        ritualId: typeof data.ritualId === "number" ? data.ritualId : null,
        firedAt,
      });
    }
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    void handleNotificationResponse(response);
  });

  // Cold start: the tap that launched the app.
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) await handleNotificationResponse(last);
  } catch {
    // no response recorded
  }

  // Re-arm everything from scratch on launch: heals dropped alarms after an
  // APK update, a reboot, or a data restore.
  await syncAlarms("boot", { immediate: true, force: true });
}


// ─── Focus sessions ─────────────────────────────────────────────────────────
// A running focus session arms a one-off OS alarm, so the "session complete"
// alert still lands when the phone is locked or Ledger is closed.

export async function scheduleFocusEnd(minutes: number, label: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const fireAt = Date.now() + Math.max(1, Math.round(minutes)) * 60_000;
  const key = `focus:${fireAt}`;
  const alarm: PlannedAlarm = {
    key,
    kind: "FOCUS_END",
    fireAt,
    priority: "reminder",
    title: "Focus complete",
    body: `${label} · ${Math.round(minutes)} min logged.`,
    data: { kind: "FOCUS_END", key, day: "", time: null },
  };
  const id = await scheduleOne(alarm);
  if (id) {
    const map = loadScheduled();
    map[key] = { id, at: fireAt, signature: signatureOf(alarm) };
    saveScheduled(map);
  }
  return key;
}

export async function cancelFocusEnd(key: string | null): Promise<void> {
  if (!key || Platform.OS === "web") return;
  const map = loadScheduled();
  const entry = map[key];
  if (entry) {
    await cancelOne(entry.id);
    delete map[key];
    saveScheduled(map);
  }
}

export function lastSyncTimestamp(): number {
  return lastSyncAt;
}

/** Delivered-and-ignored alarms still sitting in the shade, for the UI hint. */
export async function dismissDeliveredAlarms(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // ignore
  }
}

export { pushOutbox };

// ─── Native bridge ──────────────────────────────────────────────────────────
// The RingActivity and the notification buttons live outside React. Whatever
// they decide arrives here — as an event while JS is alive, or as an outbox
// entry to be replayed on the next cold start.

function fromNative(payload: {
  key: string;
  kind: string;
  title: string;
  body: string;
  taskId?: number | null;
  ritualId?: number | null;
  firedAt?: number;
  at?: number;
}): FiredAlarm {
  return {
    key: payload.key,
    kind: payload.kind,
    title: payload.title,
    body: payload.body,
    taskId: payload.taskId ?? null,
    ritualId: payload.ritualId ?? null,
    firedAt: payload.firedAt ?? payload.at ?? Date.now(),
  };
}

/** An alarm rang while Ledger was in the background: show the ringing screen. */
export function installNativeAlarmHandlers(): void {
  if (!nativeAlarmsAvailable) return;

  LedgerAlarm.onFired((payload) => {
    pushOutbox({
      key: payload.key,
      kind: payload.kind,
      taskId: payload.taskId ?? null,
      ritualId: payload.ritualId ?? null,
      title: payload.title,
      body: payload.body,
      firedAt: payload.firedAt ?? Date.now(),
    });
    if (isAlarmKind(payload.kind)) emitInAppRing(fromNative(payload));
  });

  LedgerAlarm.onAction(() => {
    // The outbox is drained by the store on the next tick; nothing to do here
    // beyond making sure the ringing state is reflected immediately.
    if (!LedgerAlarm.isRinging()) return;
  });
}

/**
 * Apply everything that was pressed while Ledger was closed. Safe to call on
 * every launch and every foreground — the native outbox is drained once.
 */
export async function drainNativeActions(): Promise<{ done: number; snoozed: number }> {
  if (!nativeAlarmsAvailable) return { done: 0, snoozed: 0 };
  const actions = LedgerAlarm.drainActions();
  let done = 0;
  let snoozed = 0;
  let touched = false;

  for (const action of actions) {
    if (action.action === "done") {
      await completeFromNotification(action.taskId ?? null, action.title);
      clearSnooze(`alarm:${action.taskId ?? action.key}`);
      touched = true;
      done++;
    } else if (action.action === "snooze") {
      bumpSnooze(action.key);
      snoozed++;
    } else {
      dropOutbox(action.key);
    }
  }

  if (touched) await syncAlarms("native-action", { immediate: true });
  return { done, snoozed };
}

/**
 * The alarm that is ringing as this process starts — either because the user
 * tapped it, or because the full-screen intent launched us. Native state is
 * authoritative: it survives the process being killed mid-ring.
 */
export function ringingOnLaunch(): FiredAlarm | null {
  if (!nativeAlarmsAvailable) return null;
  const ringing = LedgerAlarm.ringing();
  if (ringing) return fromNative(ringing);
  if (LedgerAlarm.isRinging()) {
    const last = LedgerAlarm.lastFired();
    if (last) return fromNative(last);
  }
  return null;
}

/** How many alarms AlarmManager is actually holding right now. */
export function nativeArmedCount(): number {
  return nativeAlarmsAvailable ? LedgerAlarm.armed().length : 0;
}

export interface ArmedAlarm {
  key: string;
  kind: string;
  title: string;
  body: string;
  fireAt: number;
  priority: "alarm" | "reminder" | "brief";
}

/**
 * The alarms the OS is genuinely holding. On a native build that is
 * AlarmManager's own list — the honest answer to "is my alarm really set?".
 * Without the module we can only report what this session scheduled.
 */
export function armedAlarms(): ArmedAlarm[] {
  if (nativeAlarmsAvailable) {
    return LedgerAlarm.armed()
      .map((alarm) => ({
        key: alarm.key,
        kind: alarm.kind,
        title: alarm.title,
        body: alarm.body,
        fireAt: alarm.fireAt,
        priority: alarm.priority,
      }))
      .sort((a, b) => a.fireAt - b.fireAt);
  }
  return Object.entries(loadScheduled())
    .map(([key, entry]) => ({
      key,
      kind: key.split(":")[0] ?? "TASK_REMINDER",
      title: key,
      body: "",
      fireAt: entry.at,
      priority: "reminder" as const,
    }))
    .sort((a, b) => a.fireAt - b.fireAt);
}

/**
 * Prove the whole chain on this specific phone: arm an alarm a second from
 * now. On a native build that means the real ring screen, the real sound
 * service and the real notification.
 */
export async function testAlarm(): Promise<boolean> {
  const title = "Test alarm";
  const body = "Ledger can wake you like this every time.";

  if (nativeAlarmsAvailable) {
    return LedgerAlarm.ringNow({
      key: `test:${Date.now()}`,
      kind: "TASK_ALARM",
      priority: "alarm",
      fireAt: Date.now() + 1200,
      title,
      body,
      taskId: null,
      ritualId: null,
      day: null,
    });
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: soundFor("alarm"),
        categoryIdentifier: categoryFor("TASK_ALARM"),
        priority: Notifications.AndroidNotificationPriority.MAX,
        interruptionLevel: "timeSensitive",
        data: { kind: "TASK_ALARM", key: `test:${Date.now()}` },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 3000),
        channelId: channelFor("alarm"),
      },
    });
    return true;
  } catch {
    return false;
  }
}
