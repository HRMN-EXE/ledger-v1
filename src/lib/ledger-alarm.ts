// ─── LedgerAlarm — the native alarm clock ───────────────────────────────────
// JS owns the plan; Android's AlarmManager owns the wake-up. Everything here
// degrades to a no-op when the module is missing (Expo Go, web, a dev client
// that has not been rebuilt), so the JS engine can fall back to
// expo-notifications without any special casing.

import { EventEmitter, requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export interface NativeAlarm {
  /** Stable identity from the JS plan. */
  key: string;
  kind: string;
  fireAt: number;
  priority: "alarm" | "reminder" | "brief";
  title: string;
  body: string;
  taskId?: number | null;
  ritualId?: number | null;
  day?: string | null;
}

export interface NativeAction {
  action: "done" | "snooze" | "stop";
  source: "notification" | "screen";
  at: number;
  key: string;
  kind: string;
  priority: string;
  title: string;
  body: string;
  taskId: number | null;
  ritualId: number | null;
  day: string | null;
  fireAt: number;
}

export interface NativeFired {
  key: string;
  kind: string;
  title: string;
  body: string;
  taskId: number | null;
  ritualId: number | null;
  priority: string;
  firedAt: number;
}

interface LedgerAlarmNativeModule {
  setAlarms(json: string): Promise<number>;
  cancelAll(): Promise<number>;
  getArmed(): string;
  getRinging(): string | null;
  isRinging(): boolean;
  stopRinging(): boolean;
  ringNow(json: string): Promise<boolean>;
  drainActions(): string;
  getLastFired(): string | null;
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): boolean;
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): boolean;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): boolean;
  openBatterySettings(): boolean;
  openAutostartSettings(): boolean;
  openAppNotificationSettings(): boolean;
}

const nativeModule =
  Platform.OS === "android"
    ? requireOptionalNativeModule<LedgerAlarmNativeModule>("LedgerAlarm")
    : null;

/** True when the real alarm engine is present in this build. */
export const nativeAlarmsAvailable = nativeModule != null;

type Emitter = {
  addListener(event: string, listener: (payload: unknown) => void): { remove(): void };
};

const emitter: Emitter | null = nativeModule ? (new EventEmitter(nativeModule as never) as Emitter) : null;

function noop<T>(value: T) {
  return () => value;
}

export const LedgerAlarm = {
  available: nativeAlarmsAvailable,

  async setAlarms(alarms: NativeAlarm[]): Promise<number> {
    if (!nativeModule) return 0;
    try {
      return await nativeModule.setAlarms(JSON.stringify(alarms));
    } catch {
      return 0;
    }
  },

  async cancelAll(): Promise<void> {
    try {
      await nativeModule?.cancelAll();
    } catch {
      // ignore
    }
  },

  armed(): NativeAlarm[] {
    if (!nativeModule) return [];
    try {
      return JSON.parse(nativeModule.getArmed()) as NativeAlarm[];
    } catch {
      return [];
    }
  },

  /** The alarm ringing right now — survives the app being killed. */
  ringing(): NativeAlarm | null {
    if (!nativeModule) return null;
    try {
      const raw = nativeModule.getRinging();
      return raw ? (JSON.parse(raw) as NativeAlarm) : null;
    } catch {
      return null;
    }
  },

  lastFired(): NativeAlarm | null {
    if (!nativeModule) return null;
    try {
      const raw = nativeModule.getLastFired();
      return raw ? (JSON.parse(raw) as NativeAlarm) : null;
    } catch {
      return null;
    }
  },

  stopRinging(): void {
    try {
      nativeModule?.stopRinging();
    } catch {
      // ignore
    }
  },

  isRinging(): boolean {
    try {
      return nativeModule?.isRinging() ?? false;
    } catch {
      return false;
    }
  },

  /** Ring in about a second — how the user proves the whole chain works. */
  async ringNow(alarm: NativeAlarm): Promise<boolean> {
    if (!nativeModule) return false;
    try {
      return await nativeModule.ringNow(JSON.stringify(alarm));
    } catch {
      return false;
    }
  },

  /** Actions taken while Ledger was closed; drained exactly once. */
  drainActions(): NativeAction[] {
    if (!nativeModule) return [];
    try {
      const raw = nativeModule.drainActions();
      const parsed = JSON.parse(raw) as NativeAction[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  canUseFullScreenIntent: nativeModule
    ? () => {
        try {
          return nativeModule.canUseFullScreenIntent();
        } catch {
          return false;
        }
      }
    : noop(false),

  openFullScreenIntentSettings: nativeModule
    ? () => {
        try {
          return nativeModule.openFullScreenIntentSettings();
        } catch {
          return false;
        }
      }
    : noop(false),

  canScheduleExactAlarms: nativeModule
    ? () => {
        try {
          return nativeModule.canScheduleExactAlarms();
        } catch {
          return true;
        }
      }
    : noop(true),

  openExactAlarmSettings: nativeModule
    ? () => {
        try {
          return nativeModule.openExactAlarmSettings();
        } catch {
          return false;
        }
      }
    : noop(false),

  isIgnoringBatteryOptimizations: nativeModule
    ? () => {
        try {
          return nativeModule.isIgnoringBatteryOptimizations();
        } catch {
          return false;
        }
      }
    : noop(false),

  requestIgnoreBatteryOptimizations: nativeModule
    ? () => {
        try {
          return nativeModule.requestIgnoreBatteryOptimizations();
        } catch {
          return false;
        }
      }
    : noop(false),

  openBatterySettings: nativeModule
    ? () => {
        try {
          return nativeModule.openBatterySettings();
        } catch {
          return false;
        }
      }
    : noop(false),

  openAutostartSettings: nativeModule
    ? () => {
        try {
          return nativeModule.openAutostartSettings();
        } catch {
          return false;
        }
      }
    : noop(false),

  openAppNotificationSettings: nativeModule
    ? () => {
        try {
          return nativeModule.openAppNotificationSettings();
        } catch {
          return false;
        }
      }
    : noop(false),

  /** Alarm rang (app may be foreground). */
  onFired(listener: (payload: NativeFired) => void): () => void {
    if (!emitter) return () => {};
    const sub = emitter.addListener("onAlarmFired", (payload) => listener(payload as NativeFired));
    return () => sub.remove();
  },

  /** Done / Snooze / Stop pressed while the app was alive but backgrounded. */
  onAction(listener: (payload: NativeAction) => void): () => void {
    if (!emitter) return () => {};
    const sub = emitter.addListener("onAlarmAction", (payload) => listener(payload as NativeAction));
    return () => sub.remove();
  },
};

export default LedgerAlarm;
