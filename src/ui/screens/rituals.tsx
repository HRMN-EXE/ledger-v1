// ─── Rituals: commitments + light habits (port of `views/habits.tsx`) ───────

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Btn, Card, Chip, EmptyState, ProgressBar, SectionLabel, Txt } from "@/ui/kit";
import { todayISO, weekOf } from "@/lib/dates";
import { commitmentStatusLabel, scheduleLabel, tenureLabel } from "@/lib/ritual-meta";
import type { RitualDTO, WeekCellDTO } from "@/lib/types";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, HABIT_COLORS, hairline, radius, TAG_COLORS, FALLBACK_TAG } from "@/theme/theme";

const CELL: Record<WeekCellDTO["state"], { bg: string; border?: string }> = {
  done: { bg: colors.mint500 },
  missed: { bg: alpha.hex(colors.coral400, 0.85) },
  vacation: { bg: alpha.hex(colors.sky400, 0.8) },
  neutral: { bg: "rgba(255,255,255,0.16)" },
  today: { bg: alpha.hex(colors.ember500, 0.25), border: colors.ember500 },
  upcoming: { bg: "rgba(255,255,255,0.06)" },
  none: { bg: "rgba(255,255,255,0.03)" },
};

export function WeekStrip({ ritual, size = 20 }: { ritual: RitualDTO; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap" }}>
      {ritual.week.days.map((d) => {
        const cell = CELL[d.state];
        return (
          <View
            key={d.day}
            style={{
              width: size,
              height: size,
              borderRadius: 6,
              backgroundColor: cell.bg,
              borderWidth: cell.border ? 1.5 : 0,
              borderColor: cell.border,
            }}
          />
        );
      })}
    </View>
  );
}

function RitualCard({ ritual }: { ritual: RitualDTO }) {
  const app = useApp();
  const c = ritual.commitment;
  const status = c ? commitmentStatusLabel(c.status) : null;
  const progress = c && c.requiredDays > 0 ? Math.min(1, c.activeDays / c.requiredDays) : 0;
  const tag = TAG_COLORS[ritual.category] ?? FALLBACK_TAG;

  const statusColor =
    c?.status === "ACTIVE"
      ? colors.ember400
      : c?.status === "COMPLETE"
        ? colors.mint400
        : c?.status === "EARLY_EXIT"
          ? colors.coral400
          : colors.fog400;

  return (
    <Pressable
      onPress={() => app.openRitualDetail(ritual)}
      style={({ pressed }) => [styles.ritualCard, pressed ? { opacity: 0.92 } : null]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={styles.ritualEmoji}>
          <Text style={{ fontSize: 20 }}>{ritual.icon}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.ritualName}>
            {ritual.name}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.tag, { backgroundColor: tag.soft }]}>
              <Text style={[styles.tagText, { color: tag.text }]}>{ritual.category}</Text>
            </View>
            {status ? (
              <View style={[styles.tag, { backgroundColor: alpha.hex(statusColor, 0.13) }]}>
                <Text style={[styles.tagText, { color: statusColor }]}>{status.label}</Text>
              </View>
            ) : null}
            {c ? (
              <Text style={styles.tenureText}>
                {tenureLabel(c.tenureValue, c.tenureUnit)} · {c.remainingDays} left
              </Text>
            ) : null}
          </View>
        </View>
        {ritual.schedule ? (
          <Text style={styles.scheduleText}>{scheduleLabel(ritual.schedule.type, ritual.schedule.config)}</Text>
        ) : null}
      </View>

      {c && c.status === "ACTIVE" ? (
        <View style={{ marginTop: 12 }}>
          <ProgressBar value={progress} />
          <Text style={styles.tenureLine}>
            tenure {c.activeDays}/{c.requiredDays} days
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 12 }}>
        <WeekStrip ritual={ritual} />
      </View>
      <Text style={styles.windowText}>
        {ritual.week.done} of {ritual.week.target} this window
      </Text>
    </Pressable>
  );
}

export function RitualsScreen() {
  const app = useApp();
  const today = todayISO();
  const rituals = app.rituals;
  const habits = app.data.habits;
  const week = weekOf(today);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Txt variant="micro" color={colors.fog500}>
            Rituals
          </Txt>
          <Text style={styles.h1}>Small daily vows</Text>
        </View>
        <Btn
          label="New ritual"
          icon="add"
          onPress={app.openRitualCreate}
          style={{ paddingHorizontal: 14, paddingVertical: 10 }}
        />
      </View>

      <View style={{ gap: 12, marginTop: 20 }}>
        {rituals.length === 0 ? (
          <EmptyState
            title="No rituals yet"
            sub="A ritual is a vow with a tenure: daily pages, cold showers, training. Pick the cadence, commit for a season."
            action={<Btn label="Start your first ritual" onPress={app.openRitualCreate} />}
          />
        ) : (
          rituals.map((r) => <RitualCard key={r.id} ritual={r} />)
        )}
      </View>

      <View style={{ marginTop: 30 }}>
        <SectionLabel
          right={
            <Text onPress={app.openHabitSheet} style={styles.link}>
              {habits.length > 0 ? "+ quick habit" : "+ add"}
            </Text>
          }
        >
          Habits
        </SectionLabel>
        {habits.length > 0 ? (
          <View style={{ gap: 8 }}>
            {habits.map((h) => {
              const color = HABIT_COLORS[h.color] ?? HABIT_COLORS.ember;
              const logsThisWeek = app.data.logs.filter((l) => l.habitId === h.id && week.includes(l.day));
              const todayOn = logsThisWeek.some((l) => l.day === today);
              return (
                <View key={h.id} style={styles.habitRow}>
                  <View style={[styles.habitIcon, { backgroundColor: color.soft }]}>
                    <Text style={{ fontSize: 16 }}>{h.icon}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.habitName}>
                      {h.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }}>
                      {Array.from({ length: h.weekTarget }, (_, i) => (
                        <View
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: i < logsThisWeek.length ? color.dot : "rgba(255,255,255,0.12)",
                          }}
                        />
                      ))}
                      <Text style={styles.habitCount}>
                        {logsThisWeek.length}/{h.weekTarget} this week
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => void app.deleteHabit(h.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={14} color={colors.fog600} />
                  </Pressable>
                  <Pressable
                    onPress={() => void app.toggleLog(h.id, today)}
                    style={[
                      styles.habitCheck,
                      todayOn
                        ? { backgroundColor: color.soft, borderColor: "transparent" }
                        : { borderColor: alpha.hex(colors.fog500, 0.5) },
                    ]}
                  >
                    {todayOn ? <Text style={{ fontSize: 13 }}>{h.icon}</Text> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.habitHint}>
            Light tracking for the tiny things — water, pages, stretches.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 24, color: colors.bone50, marginTop: 4 },
  ritualCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: colors.ink800,
    padding: 16,
  },
  ritualEmoji: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink750,
  },
  ritualName: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.bone100 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontFamily: fonts.uiBold, fontSize: 9 },
  tenureText: { fontFamily: fonts.uiSemi, fontSize: 9.5, color: colors.fog500 },
  scheduleText: { fontFamily: fonts.uiBold, fontSize: 10, color: colors.fog500, textAlign: "right", maxWidth: 96, lineHeight: 14 },
  tenureLine: { fontFamily: fonts.uiSemi, fontSize: 10, color: colors.fog500, marginTop: 6 },
  windowText: { fontFamily: fonts.uiBold, fontSize: 10.5, color: colors.fog500, marginTop: 6 },
  link: { fontFamily: fonts.uiBold, fontSize: 11, color: colors.ember400 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: colors.ink800,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  habitIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  habitName: { fontFamily: fonts.uiBold, fontSize: 13.5, color: colors.bone100 },
  habitCount: { fontFamily: fonts.uiBold, fontSize: 9.5, color: colors.fog500, marginLeft: 4 },
  habitCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  habitHint: {
    fontFamily: fonts.uiSemi,
    fontSize: 12,
    color: colors.fog500,
    textAlign: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: alpha.hex(colors.ink800, 0.4),
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
});
