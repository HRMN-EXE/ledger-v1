// ─── Alarms, reminders & notification plumbing ─────────────────────────────

const KEY = "kairos-alarm-state-v1";

export interface AlarmEntry {
  sig: string;
  reminderFired: boolean;
  mustLeadFired: boolean;
  lastAlarmAt: number | null;
  snoozeCount: number;
  nextAlarmAt: number | null;
  /** fallback ping sent when the alarm window was missed entirely */
  missedNotified: boolean;
}

export type AlarmState = Record<string, AlarmEntry>;

export function loadAlarmState(): AlarmState {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AlarmState) : {};
  } catch {
    return {};
  }
}

export function saveAlarmState(state: AlarmState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export const REMINDER_LEAD_MS = 5 * 60 * 1000;
export const ALARM_LEAD_MS = 2 * 60 * 1000;
export const MAX_SNOOZES = 2;
export const FIRST_SNOOZE_MIN = 10;

/** Two-tone ember chime, looping, via Web Audio. Returns stop(). */
export function startAlarmSound(): () => void {
  let ctx: AudioContext | null = null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return () => undefined;
    ctx = new AC();

    const beep = (freq: number, offset: number) => {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.5);
    };

    const fire = () => {
      beep(880, 0);
      beep(1174.66, 0.18);
    };
    fire();
    const iv = window.setInterval(fire, 950);
    const audio = ctx;
    return () => {
      window.clearInterval(iv);
      audio.close().catch(() => undefined);
    };
  } catch {
    return () => undefined;
  }
}

let vibeIv: number | null = null;

export function startVibrate(): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate([200, 120, 200]);
    vibeIv = window.setInterval(() => {
      try {
        navigator.vibrate([200, 120, 200]);
      } catch {
        // ignore
      }
    }, 1200);
  } catch {
    // ignore
  }
}

export function stopVibrate(): void {
  if (vibeIv != null) {
    window.clearInterval(vibeIv);
    vibeIv = null;
  }
  try {
    navigator.vibrate?.(0);
  } catch {
    // ignore
  }
}

export function notifySystem(title: string, body: string, tag?: string): void {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    new Notification(title, { body, tag: tag ?? undefined, silent: true });
  } catch {
    // mobile browsers may require SW registration — ignore
  }
}

export function requestNotificationPermission(): void {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    // ignore
  }
}
