// ─── Notification delivery: what the OS guarantees, and where it doesn't ────
//
// Android request: POST_NOTIFICATIONS (runtime, Android 13+), SCHEDULE_EXACT_ALARM
// / USE_EXACT_ALARM (exact `setExactAndAllowWhileIdle` delivery), and the
// battery-optimisation exemption (the difference between "rings at 06:00" and
// "rings at 06:07" on Xiaomi/Oppo/Vivo/Realme ROMs). All three are declared in
// `plugins/withLedgerAlarm.js`; the code below walks the user through granting
// them and remembers what was already asked.

import * as Device from "expo-device";
import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import { applicationId } from "expo-application";
import { Linking, Platform } from "react-native";

import LedgerAlarm, { nativeAlarmsAvailable } from "@/lib/ledger-alarm";
import { loadPrefs, savePrefs } from "./prefs";

export type PermissionState = "granted" | "denied" | "undetermined" | "unknown";

export interface PermissionSnapshot {
  notifications: PermissionState;
  /** Android <13 grants this implicitly. */
  exactAlarm: PermissionState;
  batteryExempt: PermissionState;
  dndAccess: PermissionState;
  /** Android 14+: required before an alarm may take over the lock screen. */
  fullScreenIntent: PermissionState;
  isPhysicalDevice: boolean;
  androidSdk: number;
  /** True when this build ships the native AlarmManager engine. */
  nativeAlarms: boolean;
}

const pkg = (): string => applicationId ?? "com.harmansane.ledger";

async function canLaunch(action: string): Promise<boolean> {
  try {
    return await Linking.canOpenURL(`intent:#Intent;action=${action};end`);
  } catch {
    return false;
  }
}

async function openAndroidSetting(action: string, params?: { data?: string; packageName?: string }): Promise<boolean> {
  try {
    await IntentLauncher.startActivityAsync(action as never, {
      data: params?.data,
      packageName: params?.packageName,
      flags: 0x10000000, // FLAG_ACTIVITY_NEW_TASK — required from a non-activity context
    });
    return true;
  } catch {
    try {
      const fallback = action === "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"
        ? "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS"
        : "android.settings.APPLICATION_DETAILS_SETTINGS";
      await IntentLauncher.startActivityAsync(fallback as never, {
        data: `package:${pkg()}`,
        flags: 0x10000000,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/** Reads the current state of everything the alarm engine depends on. */
export async function getPermissionSnapshot(): Promise<PermissionSnapshot> {
  const isPhysicalDevice = Device.isDevice;
  const androidSdk = typeof Platform.Version === "number" ? Platform.Version : Number(Platform.Version) || 0;

  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return {
      notifications: "unknown",
      exactAlarm: "unknown",
      batteryExempt: "unknown",
      dndAccess: "unknown",
      fullScreenIntent: "unknown",
      isPhysicalDevice,
      androidSdk,
      nativeAlarms: false,
    };
  }

  let notifications: PermissionState = "unknown";
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.granted) notifications = "granted";
    else if (perm.status === "undetermined" || perm.canAskAgain) notifications = "undetermined";
    else notifications = "denied";
  } catch {
    notifications = "unknown";
  }

  // The native engine can answer these honestly instead of guessing; the
  // prefs-based fallback is only for builds without it.
  const prefs = loadPrefs();
  let exactAlarm: PermissionState;
  let batteryExempt: PermissionState;
  let fullScreenIntent: PermissionState;

  if (Platform.OS !== "android") {
    exactAlarm = "unknown";
    batteryExempt = "unknown";
    fullScreenIntent = "unknown";
  } else if (nativeAlarmsAvailable) {
    exactAlarm = LedgerAlarm.canScheduleExactAlarms() ? "granted" : "denied";
    batteryExempt = LedgerAlarm.isIgnoringBatteryOptimizations() ? "granted" : "denied";
    fullScreenIntent =
      androidSdk >= 34 ? (LedgerAlarm.canUseFullScreenIntent() ? "granted" : "denied") : "granted";
  } else {
    exactAlarm = androidSdk >= 33 ? "granted" : prefs.exactAlarmAsked ? "undetermined" : "unknown";
    batteryExempt = prefs.batteryAskedAt ? "undetermined" : "unknown";
    fullScreenIntent = androidSdk >= 34 ? "undetermined" : "granted";
  }

  const dndAccess: PermissionState = Platform.OS !== "android" ? "unknown" : prefs.dndAsked ? "undetermined" : "unknown";

  return {
    notifications,
    exactAlarm,
    batteryExempt,
    dndAccess,
    fullScreenIntent,
    isPhysicalDevice,
    androidSdk,
    nativeAlarms: nativeAlarmsAvailable,
  };
}

/** Runtime permission (Android 13+). Safe to call repeatedly. */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (Platform.OS === "web") return "unknown";
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
    return asked.granted ? "granted" : asked.canAskAgain ? "undetermined" : "denied";
  } catch {
    return "unknown";
  }
}

/** Android 12+: takes the user to "Alarms & reminders". */
export async function requestExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  savePrefs({ exactAlarmAsked: true });
  if (nativeAlarmsAvailable && LedgerAlarm.canScheduleExactAlarms()) return true;
  if (nativeAlarmsAvailable) return LedgerAlarm.openExactAlarmSettings();
  return openAndroidSetting("android.settings.REQUEST_SCHEDULE_EXACT_ALARM", { data: `package:${pkg()}` });
}

/** Android 14+: the permission that lets an alarm cover the lock screen. */
export async function requestFullScreenIntentPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (nativeAlarmsAvailable && LedgerAlarm.canUseFullScreenIntent()) return true;
  if (nativeAlarmsAvailable) return LedgerAlarm.openFullScreenIntentSettings();
  return openAndroidSetting("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT", { data: `package:${pkg()}` });
}

/**
 * Battery-optimisation exemption. Without this, OEM ROMs (and Doze on stock
 * Android) can hold an alarm back by minutes — the single biggest reason
 * "my reminder was late" happens on real phones.
 */
export async function requestBatteryExemption(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  savePrefs({ batteryAskedAt: Date.now() });
  if (nativeAlarmsAvailable && LedgerAlarm.isIgnoringBatteryOptimizations()) return true;
  if (nativeAlarmsAvailable) return LedgerAlarm.requestIgnoreBatteryOptimizations();
  return openAndroidSetting("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", { data: `package:${pkg()}` });
}

/** OEM autostart screens — the last mile on Xiaomi/OPPO/Vivo/Huawei. */
export async function openAutostartSettings(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (nativeAlarmsAvailable) return LedgerAlarm.openAutostartSettings();
  return openAndroidSetting("android.settings.APPLICATION_DETAILS_SETTINGS", { data: `package:${pkg()}` });
}

/** Opens the app's battery screen — used as the "still late?" fallback. */
export async function openAppSettings(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  return openAndroidSetting("android.settings.APPLICATION_DETAILS_SETTINGS", { data: `package:${pkg()}` });
}

/** Do Not Disturb access — lets the alarm channel bypass silent/DND. */
export async function requestDndAccess(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  savePrefs({ dndAsked: true });
  return openAndroidSetting("android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS");
}

/** Stock-Android battery-optimisation list (for users who prefer it). */
export async function openBatterySettings(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  return openAndroidSetting("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
}

export async function openNotificationChannelSettings(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (nativeAlarmsAvailable && LedgerAlarm.openAppNotificationSettings()) return true;
  try {
    await IntentLauncher.startActivityAsync("android.settings.APP_NOTIFICATION_SETTINGS" as never, {
      extra: { "android.provider.extra.APP_PACKAGE": pkg() },
      flags: 0x10000000,
    });
    return true;
  } catch {
    return openAndroidSetting("android.settings.APPLICATION_DETAILS_SETTINGS", { data: `package:${pkg()}` });
  }
}

export interface OemHint {
  name: string;
  steps: string;
}

/** Known aggressive-Android OEMs, matched from the device brand. */
export function oemAutostartHint(): OemHint | null {
  if (Platform.OS !== "android") return null;
  const brand = `${Device.brand ?? ""} ${Device.manufacturer ?? ""}`.toLowerCase();
  if (/xiaomi|redmi|poco/.test(brand))
    return {
      name: "Xiaomi / Redmi / POCO",
      steps: "Settings → Apps → Ledger → Autostart ON, and Battery saver → No restrictions.",
    };
  if (/oppo|realme|oneplus/.test(brand))
    return {
      name: "OPPO / Realme / OnePlus",
      steps: "Settings → Battery → App battery management → Ledger → Allow background activity + Auto-launch ON.",
    };
  if (/vivo|iqoo/.test(brand))
    return {
      name: "Vivo / iQOO",
      steps: "Settings → Battery → Background power consumption management → Ledger → Allow.",
    };
  if (/samsung/.test(brand))
    return {
      name: "Samsung",
      steps: "Settings → Battery → Background usage limits → remove Ledger from 'Sleeping apps'.",
    };
  if (/huawei|honor/.test(brand))
    return {
      name: "Huawei / Honor",
      steps: "Settings → Battery → App launch → Ledger → Manage manually (all three toggles).",
    };
  if (/asus|infinix|tecno|itel|lava|micromax|nothing/.test(brand))
    return {
      name: "Aggressive battery saver",
      steps: "Settings → Battery → Ledger → allow background activity / remove from 'restricted' list.",
    };
  return null;
}

export { canLaunch };
