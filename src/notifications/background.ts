// ─── Background safety net ──────────────────────────────────────────────────
// Scheduled alarms live in AlarmManager, so they fire with the app closed —
// this worker is the *repair* path: if the plan changes while the app is
// killed (a new day rolling over, a streak warning that no longer applies),
// Android wakes us every ~15+ minutes to re-plan and top the queue back up.

import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { flushDB, loadDB } from "@/lib/localdb";
import { syncAlarms } from "./engine";

export const BACKGROUND_SYNC_TASK = "ledger-alarm-sync";

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    // Touch the DB first: this hydrates the cache from SQLite in the headless
    // JS context, which is a different runtime than the UI process.
    loadDB();
    await syncAlarms("background-task", { immediate: true });
    flushDB();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (already) return true;
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 30, // minutes — Android's floor is 15
    });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (already) await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
  } catch {
    // ignore
  }
}

export async function backgroundStatus(): Promise<string> {
  if (Platform.OS === "web") return "unavailable";
  try {
    const status = await BackgroundTask.getStatusAsync();
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    return `${status}${registered ? " · registered" : ""}`;
  } catch {
    return "unknown";
  }
}
