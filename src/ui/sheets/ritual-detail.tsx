// ─── Ritual detail: tenure clock, week strip, history, actions ──────────────

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Btn, Chip, ProgressBar, Sheet, Txt } from "@/ui/kit";
import { WeekStrip } from "@/ui/screens/rituals";
import { fmtShort, todayISO } from "@/lib/dates";
import { commitmentStatusLabel, scheduleLabel, tenureLabel } from "@/lib/ritual-meta";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, radius } from "@/theme/theme";

export function RitualDetailSheet() {
  const app = useApp();
  const ritual = app.ritualDetail;
  const c = ritual?.commitment ?? null;
  const progress = c && c.requiredDays > 0 ? Math.min(1, c.activeDays / c.requiredDays) : 0;
  const status = c ? commitmentStatusLabel(c.status) : null;

  const confirmEnd = () => {
    if (!ritual) return;
    Alert.alert("End this commitment?", "The vow closes early — the tenure stops counting.", [
      { text: "Keep going", style: "cancel" },
      {
        text: "End early",
        style: "destructive",
        onPress: () => {
          void app.ritualAction(ritual.id, "end-early", { reason: "Ended early" });
          app.closeRitualDetail();
        },
      },
    ]);
  };

  const confirmDelete = () => {
    if (!ritual) return;
    Alert.alert("Delete this ritual?", "History and its pending tasks are removed. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void app.deleteRitual(ritual.id);
          app.closeRitualDetail();
        },
      },
    ]);
  };

  return (
    <Sheet
      open={ritual != null}
      title={ritual ? `${ritual.icon} ${ritual.name}` : "Ritual"}
      subtitle={ritual?.schedule ? scheduleLabel(ritual.schedule.type, ritual.schedule.config) : undefined}
      onClose={app.closeRitualDetail}
    >
      {ritual ? (
        <View style={{ gap: 18 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Chip label={ritual.category} color={colors.fog400} />
            {status ? <Chip label={status.label} color={c?.status === "ACTIVE" ? colors.ember400 : colors.mint400} /> : null}
            {c ? <Chip label={tenureLabel(c.tenureValue, c.tenureUnit)} color={colors.lilac400} /> : null}
            {c ? <Chip label={`started ${fmtShort(c.startDate)}`} color={colors.fog400} /> : null}
          </View>

          {c ? (
            <View style={styles.block}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.blockTitle}>Tenure clock</Text>
                <Text style={styles.blockMeta}>
                  {c.activeDays}/{c.requiredDays} days
                </Text>
              </View>
              <View style={{ marginTop: 10 }}>
                <ProgressBar value={progress} />
              </View>
              <View style={styles.statRow}>
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{c.remainingDays}</Text>
                  <Text style={styles.statLabel}>days left</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{c.pausedDays}</Text>
                  <Text style={styles.statLabel}>paused</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{c.complete ? "done" : c.projectedCompletion ? fmtShort(c.projectedCompletion) : "—"}</Text>
                  <Text style={styles.statLabel}>projects to</Text>
                </View>
              </View>
              <Txt variant="caption" color={colors.fog500} style={{ marginTop: 8 }}>
                {c.vacationBehavior === "pause"
                  ? "Vacation days pause the tenure — the clock waits for you."
                  : "Vacation days keep counting — the clock never stops."}
              </Txt>
            </View>
          ) : (
            <Txt variant="caption" color={colors.fog500}>
              No commitment attached — this ritual is a shell. Start a tenure to make it count.
            </Txt>
          )}

          <View style={styles.block}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.blockTitle}>This window</Text>
              <Text style={styles.blockMeta}>
                {ritual.week.done} of {ritual.week.target}
              </Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <WeekStrip ritual={ritual} size={26} />
            </View>
          </View>

          {ritual.history.length > 0 ? (
            <View>
              <Text style={styles.blockTitle}>History</Text>
              <View style={{ gap: 8, marginTop: 10 }}>
                {[...ritual.history].reverse().map((h) => (
                  <View key={h.id} style={styles.historyRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.historyTitle}>
                        #{h.no} · {tenureLabel(h.tenureValue, h.tenureUnit)}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {fmtShort(h.startDate)}
                        {h.closedAt ? ` → ${fmtShort(h.closedAt)}` : " → running"}
                        {h.closeReason ? ` · ${h.closeReason}` : ""}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.historyStatus,
                        {
                          color:
                            h.status === "ACTIVE"
                              ? colors.ember400
                              : h.status === "COMPLETE"
                                ? colors.mint400
                                : h.status === "EARLY_EXIT"
                                  ? colors.coral400
                                  : colors.fog400,
                        },
                      ]}
                    >
                      {h.status}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            {c && c.status !== "ACTIVE" ? (
              <Btn label="Renew — commit again" icon="refresh" onPress={() => void app.ritualAction(ritual.id, "renew")} />
            ) : null}
            <Btn label="Edit schedule" variant="ghost" icon="create-outline" onPress={() => app.openRitualEdit(ritual.id)} />
            {c && c.status === "ACTIVE" ? (
              <Btn
                label="Edit rule for new habits only"
                variant="soft"
                icon="help-circle-outline"
                onPress={() =>
                  Alert.alert(
                    "How editing works",
                    "Changing the cadence adds a new schedule version from today. Past days keep the rule they were judged by.",
                    [{ text: "Got it" }]
                  )
                }
              />
            ) : null}
            {c && c.status === "ACTIVE" ? (
              <Btn label="End commitment early" variant="danger" icon="close-circle-outline" onPress={confirmEnd} />
            ) : null}
            <Btn label="Delete ritual" variant="danger" icon="trash-outline" onPress={confirmDelete} />
          </View>

          <View style={styles.footnote}>
            <Ionicons name="information-circle-outline" size={13} color={colors.fog600} />
            <Text style={styles.footnoteText}>
              Ritual tasks appear on their due day with a real alarm when a time is set. Today is {todayISO()}.
            </Text>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: colors.ink800, padding: 14 },
  blockTitle: { fontFamily: fonts.displaySemi, fontSize: 12, letterSpacing: 1.6, color: colors.fog500, textTransform: "uppercase" },
  blockMeta: { fontFamily: fonts.displaySemi, fontSize: 11.5, color: colors.bone100 },
  statRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  statCell: { flex: 1, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.ink750, paddingVertical: 10 },
  statValue: { fontFamily: fonts.display, fontSize: 16, color: colors.bone50 },
  statLabel: { fontFamily: fonts.uiBold, fontSize: 8.5, letterSpacing: 1, color: colors.fog500, textTransform: "uppercase", marginTop: 2 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.md,
    backgroundColor: colors.ink750,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  historyTitle: { fontFamily: fonts.uiBold, fontSize: 12.5, color: colors.bone100 },
  historyMeta: { fontFamily: fonts.ui, fontSize: 10.5, color: colors.fog500, marginTop: 2 },
  historyStatus: { fontFamily: fonts.uiBold, fontSize: 9, letterSpacing: 0.8 },
  footnote: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  footnoteText: { flex: 1, fontFamily: fonts.ui, fontSize: 10.5, color: colors.fog600, lineHeight: 15 },
});
