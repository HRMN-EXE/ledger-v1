// ─── App shell: tabs, FABs, banners, sheets (port of `planner-app.tsx`) ─────

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip, Toast } from "@/ui/kit";
import { FocusScreen } from "@/ui/screens/focus";
import { LedgerScreen } from "@/ui/screens/ledger";
import { PlanScreen } from "@/ui/screens/plan";
import { RitualsScreen } from "@/ui/screens/rituals";
import { TodayScreen } from "@/ui/screens/today";
import { AlarmOverlay } from "@/ui/sheets/alarm-overlay";
import { HabitSheet } from "@/ui/sheets/habit-sheet";
import { ResolverSheet } from "@/ui/sheets/resolver-sheet";
import { RitualDetailSheet } from "@/ui/sheets/ritual-detail";
import { RitualFormSheet } from "@/ui/sheets/ritual-form";
import { SettingsSheet } from "@/ui/sheets/settings-sheet";
import { StreakSheet } from "@/ui/sheets/streak-sheet";
import { TaskSheet } from "@/ui/sheets/task-sheet";
import { fmtTime } from "@/lib/dates";
import { useApp, type TabId } from "@/store/app-context";
import { alpha, colors, fonts, hairline } from "@/theme/theme";

const TABS: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "today", label: "Today", icon: "sunny-outline" },
  { id: "plan", label: "Plan", icon: "calendar-outline" },
  { id: "focus", label: "Focus", icon: "timer-outline" },
  { id: "habits", label: "Rituals", icon: "repeat-outline" },
  { id: "stats", label: "Ledger", icon: "stats-chart-outline" },
];

export function Shell() {
  const app = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {app.tab === "today" ? <TodayScreen /> : null}
        {app.tab === "plan" ? <PlanScreen /> : null}
        {app.tab === "focus" ? <FocusScreen /> : null}
        {app.tab === "habits" ? <RitualsScreen /> : null}
        {app.tab === "stats" ? <LedgerScreen /> : null}
      </View>

      {/* Top banners: streak notices + reminders */}
      {app.notice || app.reminders.length > 0 ? (
        <View style={[styles.bannerWrap, { top: insets.top + 8 }]} pointerEvents="box-none">
          {app.notice ? (
            <View style={styles.notice}>
              <Ionicons name="notifications-outline" size={15} color={colors.lilac400} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.noticeTitle}>{app.notice.title}</Text>
                <Text style={styles.noticeBody}>{app.notice.body}</Text>
              </View>
              <Pressable onPress={app.dismissNotice} hitSlop={8}>
                <Ionicons name="close" size={14} color={colors.fog500} />
              </Pressable>
            </View>
          ) : null}

          {app.reminders.slice(0, 2).map((r) => (
            <View key={r.key} style={styles.reminder}>
              <Ionicons name="time-outline" size={16} color={colors.ember400} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.reminderTitle}>
                  {r.headline ?? r.task.title}
                </Text>
                <Text style={styles.reminderBody}>
                  {fmtTime(r.task.time)} · {r.task.priority === 1 ? "Must" : r.task.priority === 2 ? "Should" : "Could"} task
                </Text>
              </View>
              <Chip label="done" color={colors.mint400} onPress={() => { void app.toggleTask(r.task.id); app.dismissReminder(r.key); }} />
              <Pressable onPress={() => app.dismissReminder(r.key)} hitSlop={8}>
                <Text style={styles.dismiss}>Dismiss</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* Floating actions */}
      <View style={[styles.fabStack, { bottom: 96 + insets.bottom }]} pointerEvents="box-none">
        <Pressable onPress={app.openSettings} style={styles.fabGhost} accessibilityLabel="Settings">
          <Ionicons name="settings-outline" size={20} color={colors.bone300} />
        </Pressable>
        <Pressable onPress={() => app.openTaskSheet()} style={styles.fab} accessibilityLabel="Add task">
          <Ionicons name="add" size={26} color={colors.ink950} />
        </Pressable>
      </View>

      {/* Bottom nav */}
      <View style={[styles.nav, { paddingBottom: Math.max(10, insets.bottom) }]}>
        {TABS.map((t) => {
          const active = app.tab === t.id;
          return (
            <Pressable key={t.id} onPress={() => app.setTab(t.id)} style={styles.navItem}>
              <View style={[styles.navIcon, active ? { backgroundColor: alpha.hex(colors.ember500, 0.15) } : null]}>
                <Ionicons name={t.icon} size={20} color={active ? colors.ember400 : colors.fog500} />
              </View>
              <Text style={[styles.navLabel, active ? { color: colors.bone100 } : null]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Toast text={app.alarm ? null : app.toastText} />

      {/* Sheets & overlays */}
      <TaskSheet />
      <HabitSheet />
      <StreakSheet />
      <RitualFormSheet />
      <RitualDetailSheet />
      <ResolverSheet />
      <SettingsSheet />
      <AlarmOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink900 },
  bannerWrap: { position: "absolute", left: 12, right: 12, gap: 8, zIndex: 60 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: alpha.hex(colors.lilac400, 0.28),
    backgroundColor: alpha.hex(colors.ink750, 0.97),
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeTitle: { fontFamily: fonts.uiBlack, fontSize: 12.5, color: colors.bone50 },
  noticeBody: { fontFamily: fonts.ui, fontSize: 11.5, color: colors.fog400, marginTop: 2 },
  reminder: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: alpha.hex(colors.ink750, 0.97),
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reminderTitle: { fontFamily: fonts.uiBlack, fontSize: 12.5, color: colors.bone50 },
  reminderBody: { fontFamily: fonts.ui, fontSize: 11, color: colors.fog400, marginTop: 2 },
  dismiss: { fontFamily: fonts.uiSemi, fontSize: 11, color: colors.fog400, paddingTop: 4 },
  fabStack: { position: "absolute", right: 18, alignItems: "flex-end", gap: 10, zIndex: 40 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.ember500,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ember500,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  fabGhost: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: alpha.hex(colors.ink750, 0.95),
    alignItems: "center",
    justifyContent: "center",
  },
  nav: {
    borderTopWidth: 1,
    borderTopColor: hairline,
    backgroundColor: alpha.hex(colors.ink900, 0.98),
    paddingTop: 8,
    flexDirection: "row",
  },
  navItem: { flex: 1, alignItems: "center", gap: 4 },
  navIcon: { width: 56, height: 30, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  navLabel: { fontFamily: fonts.uiBold, fontSize: 9.5, color: colors.fog600 },
});
