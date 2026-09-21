// ─── Ledger (stats) — port of `views/stats.tsx` + the backup/restore tools ──

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, SectionLabel, Txt } from "@/ui/kit";
import { addDays, todayISO, weekdayLetter } from "@/lib/dates";
import { PERFECT_RUN_TARGET, PROTECTION_MAX } from "@/lib/types";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, hairline, radius } from "@/theme/theme";

function Stat({
  icon,
  color,
  value,
  suffix,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: string | number;
  suffix?: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={17} color={color} />
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 8 }}>
        <Text style={styles.statValue}>{value}</Text>
        {suffix ? <Text style={styles.statSuffix}>{suffix}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function LedgerScreen() {
  const app = useApp();
  const { streakState } = app;
  const doneTasks = app.data.tasks.filter((t) => t.done).length;
  const focusMin = app.data.sessions.reduce((acc, s) => acc + s.durationMin, 0);

  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const closedByDay = new Map<string, number>();
  for (const t of app.data.tasks) {
    if (t.done && t.doneAt) {
      const d = t.doneAt.slice(0, 10);
      closedByDay.set(d, (closedByDay.get(d) ?? 0) + 1);
    }
  }
  const counts = days.map((d) => closedByDay.get(d) ?? 0);
  const max = Math.max(1, ...counts);
  const weekTotal = counts.reduce((a, b) => a + b, 0);

  const recordColors: Record<string, string> = {
    PERFECT: colors.mint500,
    MISSED: colors.coral400,
    PROTECTED: colors.lilac400,
    NEUTRAL: colors.fog500,
    INACTIVE: alpha.hex(colors.fog600, 0.7),
    VACATION: colors.sky400,
  };
  const recentRecords = [...app.records].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 12);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
      <Txt variant="micro" color={colors.fog500}>
        Ledger
      </Txt>
      <Text style={styles.h1}>What the days say</Text>

      <View style={styles.statGrid}>
        <Stat icon="flame" color={colors.ember500} value={streakState.streak} label={`current streak · best ${streakState.longest}`} />
        <Stat
          icon="shield"
          color={colors.lilac400}
          value={streakState.protections}
          suffix={`/${PROTECTION_MAX}`}
          label={`shields · ${streakState.perfectRun}/${PERFECT_RUN_TARGET} to next`}
        />
        <Stat icon="checkmark" color={colors.mint400} value={doneTasks} label="tasks closed" />
        <Stat icon="timer-outline" color={colors.gold400} value={focusMin} label="focus minutes" />
      </View>

      <Card style={{ marginTop: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={styles.cardLabel}>Closed per day</Text>
          <Text style={styles.cardMeta}>{weekTotal} this week</Text>
        </View>
        <View style={styles.chart}>
          {days.map((d, i) => {
            const c = counts[i];
            const isToday = d === today;
            const h = c === 0 ? 3 : Math.max(18, Math.round((c / max) * 76));
            return (
              <View key={d} style={{ flex: 1, alignItems: "center", gap: 8 }}>
                <View style={styles.barSlot}>
                  {c > 0 ? <Text style={styles.barValue}>{c}</Text> : null}
                  <View
                    style={{
                      width: 30,
                      height: h,
                      borderRadius: c > 0 ? 10 : 2,
                      backgroundColor: c > 0 ? colors.ember500 : "rgba(255,255,255,0.1)",
                    }}
                  />
                </View>
                <Text style={[styles.barDay, isToday ? { color: colors.ember400 } : null]}>{weekdayLetter(d)}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {weekTotal === 0 ? (
        <Text style={styles.hint}>Close tasks and the bars start stacking — one per day, seven at a time.</Text>
      ) : null}

      <View style={{ marginTop: 26 }}>
        <SectionLabel right={<Txt variant="caption" color={colors.fog500}>{app.records.length} sealed</Txt>}>Day records</SectionLabel>
        {recentRecords.length === 0 ? (
          <Text style={styles.hint}>No day sealed yet. Finish a must/should task and the ledger writes itself.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {recentRecords.map((r) => (
              <View key={r.day} style={styles.recordRow}>
                <View style={[styles.recordDot, { backgroundColor: recordColors[r.status] ?? colors.fog500 }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.recordDay}>{r.day}</Text>
                  <Text numberOfLines={1} style={styles.recordNote}>
                    {r.note}
                  </Text>
                </View>
                <View style={styles.recordBadge}>
                  <Text style={[styles.recordStatus, { color: recordColors[r.status] ?? colors.fog400 }]}>{r.status}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={{ marginTop: 26 }}>
        <SectionLabel>Device</SectionLabel>
        <Card style={{ gap: 12 }}>
          <View style={styles.infoRow}>
            <Ionicons name="phone-portrait-outline" size={15} color={colors.fog400} />
            <Text style={styles.infoText}>{app.profileName ? `${app.profileName} · since ${app.openedOn}` : `since ${app.openedOn}`}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cloud-offline-outline" size={15} color={colors.mint400} />
            <Text style={styles.infoText}>100% offline — no account, no server, no sync</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="notifications-outline" size={15} color={app.notifPrefs.alarms ? colors.mint400 : colors.coral400} />
            <Text style={styles.infoText}>
              {app.notifPrefs.alarms ? "Alarms armed in the system clock" : "Alarms switched off in Settings"}
            </Text>
          </View>
        </Card>
        <Text style={styles.hint}>Open Settings (gear, top-right) for alarms, permissions and backup.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 24, color: colors.bone50, marginTop: 4 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20 },
  stat: {
    flexGrow: 1,
    flexBasis: "47%",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: colors.ink800,
    padding: 16,
  },
  statValue: { fontFamily: fonts.display, fontSize: 24, color: colors.bone50, lineHeight: 26 },
  statSuffix: { fontFamily: fonts.displaySemi, fontSize: 13, color: colors.fog500, paddingBottom: 2 },
  statLabel: { fontFamily: fonts.uiBold, fontSize: 9.5, letterSpacing: 1.2, color: colors.fog500, marginTop: 6, textTransform: "uppercase" },
  cardLabel: { fontFamily: fonts.displaySemi, fontSize: 11, letterSpacing: 2, color: colors.fog500, textTransform: "uppercase" },
  cardMeta: { fontFamily: fonts.displaySemi, fontSize: 10.5, color: colors.fog500 },
  chart: { flexDirection: "row", gap: 8, marginTop: 18 },
  barSlot: { height: 96, width: "100%", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  barValue: { fontFamily: fonts.uiBold, fontSize: 10.5, color: colors.bone100 },
  barDay: { fontFamily: fonts.uiBold, fontSize: 10, color: colors.fog500, textTransform: "uppercase" },
  hint: { fontFamily: fonts.ui, fontSize: 11.5, color: colors.fog600, textAlign: "center", marginTop: 12, lineHeight: 17 },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: colors.ink800,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recordDot: { width: 8, height: 8, borderRadius: 4 },
  recordDay: { fontFamily: fonts.displaySemi, fontSize: 11.5, color: colors.bone100 },
  recordNote: { fontFamily: fonts.ui, fontSize: 10.5, color: colors.fog500, marginTop: 2 },
  recordBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)" },
  recordStatus: { fontFamily: fonts.uiBold, fontSize: 8.5, letterSpacing: 0.8 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontFamily: fonts.uiSemi, fontSize: 12, color: colors.fog400, flex: 1 },
});
