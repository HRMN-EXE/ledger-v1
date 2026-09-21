// ─── Streak & rules sheet (port of `streak-sheet.tsx`) ──────────────────────
// The place where notifications become *your* notifications: cutoff, quiet
// hours, and which nudges are allowed to wake you.

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DayBar } from "@/ui/day-bar";
import { Btn, Chip, FieldLabel, Seg, SettingRow, Sheet, Toggle, Txt } from "@/ui/kit";
import { TimeField } from "@/ui/time-field";
import { addDays, todayISO } from "@/lib/dates";
import { PROTECTION_MAX, VACATION_LIMIT_PER_YEAR } from "@/lib/types";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, radius } from "@/theme/theme";

type VacationMode = "none" | "range" | "open";

export function StreakSheet() {
  const app = useApp();
  const { streakState, streakSettings } = app;
  const today = todayISO();

  const [mode, setMode] = useState<VacationMode>("none");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 2));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const currentYear = today.slice(0, 4);
  const usedThisYear = Array.from(app.vacationDays).filter((d) => d.startsWith(currentYear)).length;
  const upcoming = Array.from(app.vacationDays)
    .filter((d) => d >= today)
    .sort()
    .slice(0, 6);

  const schedule = async () => {
    setBusy(true);
    setErr(null);
    const problem =
      mode === "open"
        ? await app.scheduleVacation(start, start, true)
        : await app.scheduleVacation(start, end, false);
    setBusy(false);
    if (problem) {
      setErr(problem);
      return;
    }
    setMode("none");
  };

  return (
    <Sheet open={app.streakSheetOpen} title="Streak & ledger" onClose={app.closeStreakSheet}>
      <View style={{ gap: 18 }}>
        {/* stats */}
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Ionicons name="flame" size={16} color={colors.ember400} />
            <Text style={styles.statValue}>{streakState.streak}</Text>
            <Text style={styles.statLabel}>streak</Text>
          </View>
          <View style={styles.statCell}>
            <Ionicons name="trophy-outline" size={16} color={colors.gold400} />
            <Text style={styles.statValue}>{streakState.longest}</Text>
            <Text style={styles.statLabel}>longest</Text>
          </View>
          <View style={styles.statCell}>
            <Ionicons name="shield" size={16} color={colors.lilac400} />
            <Text style={styles.statValue}>
              {streakState.protections}
              <Text style={{ fontSize: 12, color: colors.fog500 }}>/{PROTECTION_MAX}</Text>
            </Text>
            <Text style={styles.statLabel}>shields</Text>
          </View>
        </View>

        <Txt variant="caption" color={colors.fog500} style={{ textAlign: "center" }}>
          {streakState.perfectRun}/15 clean days earns a shield. A shield silently saves a day you couldn&apos;t finish.
        </Txt>

        {/* vacation */}
        <View>
          <FieldLabel>Vacation — freeze the streak</FieldLabel>
          <Seg
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { value: "none" as VacationMode, label: "Off" },
              { value: "range" as VacationMode, label: "Pick range" },
              { value: "open" as VacationMode, label: "Open-ended" },
            ]}
          />
          <Txt variant="caption" color={colors.fog500} style={{ marginTop: 6 }}>
            {VACATION_LIMIT_PER_YEAR - usedThisYear} of {VACATION_LIMIT_PER_YEAR} vacation days left in {currentYear}.
          </Txt>

          {streakState.vacationOpenStart ? (
            <View style={styles.openVac}>
              <View style={{ flex: 1 }}>
                <Text style={styles.openVacTitle}>Open vacation running</Text>
                <Text style={styles.openVacSub}>Since {streakState.vacationOpenStart} — days freeze automatically.</Text>
              </View>
              <Chip label="end" color={colors.sky400} onPress={() => void app.endOpenVacation()} />
            </View>
          ) : null}

          {mode !== "none" ? (
            <View style={{ gap: 12, marginTop: 12 }}>
              <DayBar value={start} onChange={setStart} min={today} />
              {mode === "range" ? <DayBar value={end} onChange={setEnd} min={start} /> : null}
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <Btn
                label={mode === "open" ? "Start open vacation" : `Freeze ${start} → ${end}`}
                onPress={() => void schedule()}
                loading={busy}
              />
            </View>
          ) : null}

          {upcoming.length > 0 ? (
            <View style={{ gap: 6, marginTop: 12 }}>
              {upcoming.map((d) => (
                <View key={d} style={styles.vacRow}>
                  <Ionicons name="snow-outline" size={13} color={colors.sky400} />
                  <Text style={styles.vacDay}>{d}</Text>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => void app.removeVacationDay(d)} hitSlop={8}>
                    <Ionicons name="close" size={14} color={colors.fog500} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* rules */}
        <View>
          <Pressable onPress={() => setShowRules((v) => !v)} style={styles.rulesToggle}>
            <Ionicons name="options-outline" size={15} color={colors.ember400} />
            <Text style={styles.rulesText}>Rules · cutoff, quiet hours & nudges</Text>
            <Ionicons name={showRules ? "chevron-down" : "chevron-forward"} size={14} color={colors.fog500} />
          </Pressable>

          {showRules ? (
            <View style={{ gap: 12, marginTop: 12 }}>
              <View>
                <FieldLabel>Day cutoff — when the day is judged</FieldLabel>
                <TimeField value={streakSettings.cutoffTime} onChange={(v) => void app.updateStreakSettings({ cutoffTime: v || "23:59" })} fallbackHour={23} />
              </View>

              <View>
                <FieldLabel>Quiet hours — no notification sounds in this window</FieldLabel>
                <View style={{ gap: 10 }}>
                  <TimeField
                    value={streakSettings.quietStart}
                    onChange={(v) => void app.updateStreakSettings({ quietStart: v })}
                    allowEmpty
                    fallbackHour={22}
                  />
                  <TimeField
                    value={streakSettings.quietEnd}
                    onChange={(v) => void app.updateStreakSettings({ quietEnd: v })}
                    allowEmpty
                    fallbackHour={7}
                  />
                </View>
                <Txt variant="caption" color={colors.fog500} style={{ marginTop: 6 }}>
                  Alarms you set yourself still ring — only the softer nudges stay quiet.
                </Txt>
              </View>

              <View style={styles.toggleList}>
                <SettingRow
                  title="Streak warnings"
                  sub="Risk & final warnings before the cutoff"
                  right={<Toggle on={streakSettings.streakWarnings} onChange={(v) => void app.updateStreakSettings({ streakWarnings: v })} />}
                />
                <SettingRow
                  title="Task reminders"
                  sub="5 minutes before a scheduled task"
                  right={<Toggle on={streakSettings.taskReminders} onChange={(v) => void app.updateStreakSettings({ taskReminders: v })} />}
                />
                <SettingRow
                  title="Morning brief"
                  sub="One nudge between 6–12"
                  right={<Toggle on={streakSettings.morningBrief} onChange={(v) => void app.updateStreakSettings({ morningBrief: v })} />}
                />
                <SettingRow
                  title="Evening check-in"
                  sub="3 hours before cutoff"
                  right={<Toggle on={streakSettings.eveningCheckin} onChange={(v) => void app.updateStreakSettings({ eveningCheckin: v })} />}
                />
                <SettingRow
                  title="Final warning"
                  sub="30 minutes before cutoff"
                  right={<Toggle on={streakSettings.finalWarning} onChange={(v) => void app.updateStreakSettings({ finalWarning: v })} />}
                />
              </View>

              <Btn
                label="Re-arm all alarms now"
                variant="ghost"
                icon="alarm-outline"
                onPress={() => void app.forceResync()}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: "row", gap: 8 },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: colors.ink800,
    paddingVertical: 14,
  },
  statValue: { fontFamily: fonts.display, fontSize: 20, color: colors.bone50 },
  statLabel: { fontFamily: fonts.uiBold, fontSize: 9, letterSpacing: 1.2, color: colors.fog500, textTransform: "uppercase" },
  openVac: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha.hex(colors.sky400, 0.28),
    backgroundColor: alpha.hex(colors.sky400, 0.1),
    padding: 12,
  },
  openVacTitle: { fontFamily: fonts.uiBlack, fontSize: 12.5, color: colors.sky400 },
  openVacSub: { fontFamily: fonts.ui, fontSize: 10.5, color: colors.fog400, marginTop: 2 },
  vacRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.ink750,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  vacDay: { fontFamily: fonts.displaySemi, fontSize: 12.5, color: colors.bone100 },
  err: { fontFamily: fonts.uiBold, fontSize: 11.5, color: colors.coral400 },
  rulesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: colors.ink800,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rulesText: { flex: 1, fontFamily: fonts.uiBold, fontSize: 12.5, color: colors.bone100 },
  toggleList: { borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", backgroundColor: colors.ink800, paddingHorizontal: 14 },
});
