// ─── Android notification channels ──────────────────────────────────────────
// Channel config is what makes an alarm *behave* like an alarm: MAX importance
// (heads-up, never silenced by the priority system), the ALARM audio stream,
// DND bypass when the user allows it, and lock-screen visibility. Channels are
// created once at boot; Android ignores later edits to most fields, so the ids
// are versioned deliberately (…-v2 suffix if the config ever changes).

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const CHANNEL_ALARM = "ledger-alarms-v1";
export const CHANNEL_REMINDER = "ledger-reminders-v1";
export const CHANNEL_BRIEF = "ledger-briefs-v1";

export const SOUND_ALARM = "ledger_alarm.wav";
export const SOUND_CHIME = "ledger_chime.wav";
export const SOUND_NUDGE = "ledger_nudge.wav";

export const CATEGORY_TASK_ALARM = "ledger-task-alarm";
export const CATEGORY_TASK_REMINDER = "ledger-task-reminder";
export const CATEGORY_STREAK = "ledger-streak";
export const CATEGORY_RITUAL = "ledger-ritual";
export const CATEGORY_FOCUS = "ledger-focus";

export const ACTION_DONE = "ledger-done";
export const ACTION_SNOOZE = "ledger-snooze";
export const ACTION_OPEN = "ledger-open";

let ready = false;

async function safe(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    // Channels are best-effort: never block the app on a channel failure.
  }
}

/** Idempotent — call on every cold start, before anything is scheduled. */
export async function ensureChannels(): Promise<void> {
  if (ready || Platform.OS !== "android") {
    ready = true;
    return;
  }
  ready = true;

  await safe(() =>
    Notifications.setNotificationChannelAsync(CHANNEL_ALARM, {
      name: "Alarms",
      description: "Alarms that ring at the exact time you set.",
      importance: Notifications.AndroidImportance.MAX,
      sound: SOUND_ALARM,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      enableVibrate: true,
      enableLights: true,
      lightColor: "#ff6a2b",
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      showBadge: true,
    })
  );

  await safe(() =>
    Notifications.setNotificationChannelAsync(CHANNEL_REMINDER, {
      name: "Reminders",
      description: "Heads-up before a task is due.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: SOUND_CHIME,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: [0, 220, 160, 220],
      enableVibrate: true,
      enableLights: true,
      lightColor: "#ffb238",
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.NOTIFICATION,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: false,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      showBadge: true,
    })
  );

  await safe(() =>
    Notifications.setNotificationChannelAsync(CHANNEL_BRIEF, {
      name: "Daily briefs",
      description: "Morning plan and evening check-in.",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: SOUND_NUDGE,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: [0, 160],
      enableVibrate: true,
      enableLights: false,
      showBadge: true,
    })
  );
}

/** Action buttons on the notification itself (Android + iOS). */
export async function ensureCategories(): Promise<void> {
  await safe(() =>
    Notifications.setNotificationCategoryAsync(CATEGORY_TASK_ALARM, [
      { identifier: ACTION_DONE, buttonTitle: "Mark done", options: { opensAppToForeground: false } },
      { identifier: ACTION_SNOOZE, buttonTitle: "Snooze 10m", options: { opensAppToForeground: false } },
    ])
  );
  await safe(() =>
    Notifications.setNotificationCategoryAsync(CATEGORY_TASK_REMINDER, [
      { identifier: ACTION_DONE, buttonTitle: "Mark done", options: { opensAppToForeground: false } },
      { identifier: ACTION_SNOOZE, buttonTitle: "Snooze 5m", options: { opensAppToForeground: false } },
    ])
  );
  await safe(() =>
    Notifications.setNotificationCategoryAsync(CATEGORY_STREAK, [
      { identifier: ACTION_OPEN, buttonTitle: "Open Ledger", options: { opensAppToForeground: true } },
    ])
  );
  await safe(() =>
    Notifications.setNotificationCategoryAsync(CATEGORY_RITUAL, [
      { identifier: ACTION_DONE, buttonTitle: "Done today", options: { opensAppToForeground: false } },
      { identifier: ACTION_SNOOZE, buttonTitle: "Remind me later", options: { opensAppToForeground: false } },
    ])
  );
  await safe(() =>
    Notifications.setNotificationCategoryAsync(CATEGORY_FOCUS, [
      { identifier: ACTION_OPEN, buttonTitle: "Open Ledger", options: { opensAppToForeground: true } },
    ])
  );
}

export function channelFor(priority: "alarm" | "reminder" | "brief"): string {
  if (priority === "alarm") return CHANNEL_ALARM;
  if (priority === "reminder") return CHANNEL_REMINDER;
  return CHANNEL_BRIEF;
}

export function soundFor(priority: "alarm" | "reminder" | "brief"): string {
  if (priority === "alarm") return SOUND_ALARM;
  if (priority === "reminder") return SOUND_CHIME;
  return SOUND_NUDGE;
}

export function categoryFor(kind: string): string | undefined {
  switch (kind) {
    case "TASK_ALARM":
    case "MUST_LEAD":
      return CATEGORY_TASK_ALARM;
    case "TASK_REMINDER":
      return CATEGORY_TASK_REMINDER;
    case "RITUAL":
      return CATEGORY_RITUAL;
    case "FOCUS_END":
      return CATEGORY_FOCUS;
    case "MORNING_BRIEF":
    case "EVENING_CHECKIN":
    case "FINAL_WARNING":
      return CATEGORY_STREAK;
    default:
      return undefined;
  }
}
