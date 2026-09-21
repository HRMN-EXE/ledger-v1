// ─── Settings: alarms, permissions, backup ──────────────────────────────────
// This screen is the honest contract between Ledger and Android: what is
// guaranteed, what the OS still controls, and exactly how to fix a phone that
// refuses to wake up on time (aggressive battery savers).

import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { Btn, Chip, Divider, SettingRow, Sheet, Toggle, Txt } from "@/ui/kit";
import { dbSizeLabel, importBackupFromFile, shareBackup, copyBackupToClipboard } from "@/lib/backup";
import { addDays, fmtShort, todayISO } from "@/lib/dates";
import { storageLabel } from "@/lib/storage";
import { backgroundStatus } from "@/notifications/background";
import { armedAlarms, testAlarm, type ArmedAlarm } from "@/notifications/engine";
import {
  openAppSettings,
  openAutostartSettings,
  openNotificationChannelSettings,
  oemAutostartHint,
  requestBatteryExemption,
  requestDndAccess,
  requestExactAlarmPermission,
  requestFullScreenIntentPermission,
  requestNotificationPermission,
} from "@/notifications/permissions";
import { playPreview } from "@/notifications/sound";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, radius } from "@/theme/theme";

const KIND_LABEL: Record<string, string> = {
  TASK_ALARM: "Alarm",
  TASK_REMINDER: "Reminder",
  MUST_LEAD: "30-min warning",
  MORNING_BRIEF: "Morning brief",
  EVENING_CHECKIN: "Evening check-in",
  FINAL_WARNING: "Final warning",
  RITUAL: "Ritual",
  FOCUS_END: "Focus end",
};

function relativeLabel(at: number): string {
  const now = Date.now();
  const day = new Date(at);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  const iso = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  const time = `${pad(day.getHours())}:${pad(day.getMinutes())}`;
  const today = todayISO();
  const label = iso === today ? "Today" : iso === addDays(today, 1) ? "Tomorrow" : fmtShort(iso);
  const mins = Math.round((at - now) / 60000);
  const delta = mins < 60 ? `${Math.max(1, mins)}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return `${label} ${time} · in ${delta}`;
}

export function SettingsSheet() {
  const app = useApp();
  const [planned, setPlanned] = useState<ArmedAlarm[]>([]);
  const [bg, setBg] = useState<string>("checking…");
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    if (!app.settingsOpen) return;
    try {
      setPlanned(armedAlarms());
    } catch {
      setPlanned([]);
    }
    void backgroundStatus().then(setBg);
  }, [app.settingsOpen, app.notifPrefs, app.alarmsSyncedAt]);

  const hint = oemAutostartHint();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const pkg = Constants.expoConfig?.android?.package ?? "com.harmansane.ledger";

  const notifState = app.permissions?.notifications ?? "unknown";
  const notifColor =
    notifState === "granted" ? colors.mint400 : notifState === "denied" ? colors.coral400 : colors.gold400;

  const ask = (key: string, fn: () => Promise<unknown>) => {
    setWorking(key);
    void fn().then(() => {
      setWorking(null);
      void app.refreshPermissions();
    });
  };

  const doImport = async () => {
    setWorking("import");
    const res = await importBackupFromFile();
    setWorking(null);
    if (res.message === "cancelled") return;
    if (res.ok) {
      app.reloadFromDisk();
      Alert.alert("Restored", res.message);
    } else {
      Alert.alert("Could not restore", res.message);
    }
  };

  const doExport = async () => {
    setWorking("export");
    const ok = await shareBackup();
    setWorking(null);
    if (!ok) Alert.alert("Export failed", "Couldn't open the share sheet on this device.");
  };

  const confirmReset = () => {
    Alert.alert(
      "Erase everything?",
      "Tasks, rituals, streak and settings are deleted from this device. Export a backup first if you're unsure.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase",
          style: "destructive",
          onPress: () => {
            app.replaceAllData({ tasks: [], habits: [], logs: [], sessions: [], intents: [], records: [], vacations: [], rituals: [], commitments: [], versions: [], instances: [] });
          },
        },
      ]
    );
  };

  return (
    <Sheet open={app.settingsOpen} title="Settings" subtitle="Alarms, permissions & backup" onClose={app.closeSettings}>
      <View style={{ gap: 20 }}>
        {/* ── Alarms ── */}
        <View>
          <Txt variant="micro" color={colors.fog500}>
            Alarms & notifications
          </Txt>
          <View style={styles.card}>
            <SettingRow
              title="Task alarms"
              sub="Rings at the exact time you set, even with Ledger closed"
              right={
                <Toggle
                  on={app.notifPrefs.alarms}
                  onChange={(v) => void app.updateNotifPrefs({ alarms: v })}
                />
              }
            />
            <Divider />
            <SettingRow
              title="Reminders"
              sub="5 minutes before a task, plus the morning brief"
              right={<Toggle on={app.notifPrefs.reminders} onChange={(v) => void app.updateNotifPrefs({ reminders: v })} />}
            />
            <Divider />
            <SettingRow
              title="Ritual nudges"
              sub="Untimed rituals get a 09:00 nudge"
              right={<Toggle on={app.notifPrefs.ritualReminders} onChange={(v) => void app.updateNotifPrefs({ ritualReminders: v })} />}
            />
          </View>

          <View style={styles.listBox}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={styles.listTitle}>Armed in the system clock</Text>
              <Text style={styles.listMeta}>{planned.length} scheduled</Text>
            </View>
            {planned.length === 0 ? (
              <Text style={styles.listEmpty}>
                Nothing queued. Add a task with a time and Ledger arms it immediately.
              </Text>
            ) : (
              planned.slice(0, 6).map((a) => (
                <View key={a.key} style={styles.alarmRow}>
                  <View
                    style={[
                      styles.alarmDot,
                      {
                        backgroundColor:
                          a.priority === "alarm" ? colors.ember500 : a.priority === "reminder" ? colors.gold400 : colors.fog500,
                      },
                    ]}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.alarmTitle}>
                      {a.title}
                    </Text>
                    <Text style={styles.alarmMeta}>
                      {KIND_LABEL[a.kind] ?? a.kind} · {relativeLabel(a.fireAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Btn label="Re-arm now" variant="ghost" icon="alarm-outline" onPress={() => void app.forceResync()} style={{ flex: 1, paddingVertical: 10 }} />
              <Btn label="Test sound" variant="soft" icon="volume-high-outline" onPress={() => void playPreview("alarm")} style={{ flex: 1, paddingVertical: 10 }} />
            </View>
            <Btn
              label={working === "ring" ? "Ringing…" : "Ring a test alarm now"}
              icon="notifications-outline"
              variant="ghost"
              loading={working === "ring"}
              onPress={() =>
                ask("ring", async () => {
                  const ok = await testAlarm();
                  Alert.alert(
                    ok ? "Alarm armed" : "Couldn't arm the test",
                    ok
                      ? "Lock the phone — the alarm rings in about a second, with sound, vibration and the lock-screen take-over."
                      : "Grant the permissions above, then try again."
                  );
                })
              }
              style={{ marginTop: 8, paddingVertical: 10 }}
            />
          </View>
        </View>

        {/* ── Permissions ── */}
        <View>
          <Txt variant="micro" color={colors.fog500}>
            Permissions
          </Txt>
          <View style={styles.card}>
            <SettingRow
              title="Notifications"
              sub={notifState === "granted" ? "Allowed" : notifState === "denied" ? "Blocked in system settings — tap to open" : "Not granted yet"}
              right={<Chip label={notifState} color={notifColor} onPress={() => (notifState === "denied" ? void openNotificationChannelSettings() : ask("notif", requestNotificationPermission))} />}
            />
            <Divider />
            <SettingRow
              title="Exact alarms"
              sub={
                Platform.OS === "android" && (app.permissions?.androidSdk ?? 0) >= 33
                  ? "Granted at install (USE_EXACT_ALARM). Tap if your phone still delays alarms."
                  : "Android 12+: allowed by default — tap to verify"
              }
              right={<Chip label="check" color={colors.ember400} onPress={() => ask("exact", requestExactAlarmPermission)} />}
            />
            <Divider />
            <SettingRow
              title="Battery optimisation"
              sub="Unrestricted delivery — the fix for 'my alarm came late'"
              right={<Chip label="allow" color={colors.mint400} onPress={() => ask("battery", requestBatteryExemption)} />}
            />
            <Divider />
            <SettingRow
              title="Do Not Disturb access"
              sub="Lets alarms ring through silent mode"
              right={<Chip label="grant" color={colors.lilac400} onPress={() => ask("dnd", requestDndAccess)} />}
            />
            <Divider />
            <SettingRow
              title="Full-screen alarms"
              sub="Android 14+ — lets an alarm cover the lock screen"
              right={<Chip label="grant" color={colors.sky400} onPress={() => ask("fullscreen", requestFullScreenIntentPermission)} />}
            />
            <Divider />
            <SettingRow title="Autostart (OEM)" sub="Xiaomi / OPPO / Vivo / Huawei background rules" right={<Chip label="open" color={colors.gold400} onPress={() => ask("autostart", openAutostartSettings)} />} />
            <Divider />
            <SettingRow title="App settings" sub="All permissions for Ledger in one screen" right={<Chip label="open" color={colors.fog400} onPress={() => ask("app", openAppSettings)} />} />
          </View>
        </View>

        {/* ── OEM heads-up ── */}
        {hint ? (
          <View style={styles.hintCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="warning-outline" size={15} color={colors.gold400} />
              <Text style={styles.hintTitle}>{hint.name} detected</Text>
            </View>
            <Text style={styles.hintText}>{hint.steps}</Text>
            <Text style={styles.hintText}>
              Without this, the ROM can freeze background alarms for hours — it is the single most common reason a reminder
              shows up late.
            </Text>
          </View>
        ) : null}

        {/* ── Delivery ── */}
        <View>
          <Txt variant="micro" color={colors.fog500}>
            Delivery
          </Txt>
          <View style={styles.card}>
            <SettingRow title="Background re-planning" sub={`Worker: ${bg}`} right={<Chip label="30 min" color={colors.fog400} />} />
            <Divider />
            <SettingRow
              title="Last alarm sync"
              sub={app.alarmsSyncedAt ? new Date(app.alarmsSyncedAt).toLocaleTimeString() : "not yet"}
              right={<Chip label="resync" color={colors.ember400} onPress={() => void app.forceResync()} />}
            />
            <Divider />
            <SettingRow
              title="Aggressive delivery"
              sub="Asks for the battery exemption on first run"
              right={<Toggle on={app.notifPrefs.aggressiveDelivery} onChange={(v) => void app.updateNotifPrefs({ aggressiveDelivery: v })} />}
            />
          </View>
        </View>

        {/* ── Backup ── */}
        <View>
          <Txt variant="micro" color={colors.fog500}>
            Backup — your data, your file
          </Txt>
          <View style={{ gap: 10 }}>
            <Btn label="Export backup (share)" icon="share-outline" variant="ghost" onPress={() => void doExport()} loading={working === "export"} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn
                label="Copy JSON"
                icon="copy-outline"
                variant="soft"
                onPress={() => void copyBackupToClipboard()}
                style={{ flex: 1, paddingVertical: 11 }}
              />
              <Btn
                label="Restore file"
                icon="download-outline"
                variant="soft"
                onPress={() => void doImport()}
                loading={working === "import"}
                style={{ flex: 1, paddingVertical: 11 }}
              />
            </View>
            <Text style={styles.fine}>
              {storageLabel()} · {dbSizeLabel()} on device. Nothing is uploaded — the export is a plain JSON file you
              choose where to keep.
            </Text>
            <Btn label="Erase all data" variant="danger" icon="trash-outline" onPress={confirmReset} />
          </View>
        </View>

        {/* ── About ── */}
        <View style={styles.about}>
          <Text style={styles.aboutTitle}>Ledger {version}</Text>
          <Text style={styles.aboutText}>
            100% offline. No account, no analytics, no network permission needed to plan your day — every task, streak and
            alarm lives in this device&apos;s storage.
          </Text>
          <Text style={styles.aboutMeta}>{pkg}</Text>
          <Text style={styles.aboutMeta}>
            Alarms are handed to Android&apos;s AlarmManager (exact, reboot-persistent). A phone that force-stops the app
            or blocks background activity can still delay them — the permission buttons above are the fix.
          </Text>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", backgroundColor: colors.ink800, paddingHorizontal: 14, marginTop: 10 },
  listBox: { borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", backgroundColor: colors.ink800, padding: 14, marginTop: 12 },
  listTitle: { fontFamily: fonts.displaySemi, fontSize: 11, letterSpacing: 1.4, color: colors.fog500, textTransform: "uppercase" },
  listMeta: { fontFamily: fonts.uiBold, fontSize: 10.5, color: colors.fog500 },
  listEmpty: { fontFamily: fonts.ui, fontSize: 11.5, color: colors.fog600, lineHeight: 17 },
  alarmRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  alarmDot: { width: 7, height: 7, borderRadius: 4 },
  alarmTitle: { fontFamily: fonts.uiBold, fontSize: 12.5, color: colors.bone100 },
  alarmMeta: { fontFamily: fonts.ui, fontSize: 10.5, color: colors.fog500, marginTop: 2 },
  hintCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha.hex(colors.gold400, 0.3),
    backgroundColor: alpha.hex(colors.gold400, 0.08),
    padding: 14,
    gap: 6,
  },
  hintTitle: { fontFamily: fonts.uiBlack, fontSize: 12.5, color: colors.gold400 },
  hintText: { fontFamily: fonts.ui, fontSize: 11.5, color: colors.fog400, lineHeight: 17 },
  fine: { fontFamily: fonts.ui, fontSize: 10.5, color: colors.fog600, lineHeight: 16 },
  about: { gap: 6, paddingBottom: 8 },
  aboutTitle: { fontFamily: fonts.displaySemi, fontSize: 13, color: colors.bone100 },
  aboutText: { fontFamily: fonts.ui, fontSize: 11.5, color: colors.fog500, lineHeight: 17 },
  aboutMeta: { fontFamily: fonts.ui, fontSize: 10.5, color: colors.fog600, lineHeight: 16 },
});
