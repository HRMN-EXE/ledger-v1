// ─── Plan: calendar heat map + a day timeline (port of `views/plan.tsx`) ────

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CalendarPicker, type DayStats } from "@/ui/calendar-picker";
import { Btn, Chip, Dot, EmptyState, Txt } from "@/ui/kit";
import { TimeChip } from "@/ui/task-row";
import { fmtDateLongGB, relativeDayLabel, todayISO } from "@/lib/dates";
import type { TaskDTO } from "@/lib/types";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, hairline, radius, TAG_COLORS, FALLBACK_TAG } from "@/theme/theme";

type NodeKind = "done" | "missed" | "late" | "today" | "future";

const NODE_COLOR: Record<NodeKind, string> = {
  done: colors.mint500,
  missed: colors.coral400,
  late: colors.gold400,
  today: colors.ember500,
  future: alpha.hex(colors.fog500, 0.6),
};

const NODE_LABEL: Record<NodeKind, string> = {
  done: "closed",
  missed: "missed",
  late: "leftover",
  today: "today",
  future: "planned",
};

function nodeFor(t: TaskDTO, today: string): NodeKind {
  if (t.done) return "done";
  if (t.missed) return "missed";
  if (t.day < today) return "late";
  if (t.day === today) return "today";
  return "future";
}

export function PlanScreen() {
  const app = useApp();
  const today = todayISO();
  const [selected, setSelected] = useState(today);

  const marks = useMemo(() => {
    const map = new Map<string, DayStats>();
    for (const t of app.data.tasks) {
      if (t.missed) continue;
      const s = map.get(t.day) ?? { open: 0, done: 0 };
      if (t.done) s.done++;
      else s.open++;
      map.set(t.day, s);
    }
    return map;
  }, [app.data.tasks]);

  const dayTasks = app.data.tasks.filter((t) => t.day === selected);
  const open = dayTasks.filter((t) => !t.done && !t.missed);
  const done = dayTasks.filter((t) => t.done);
  const missed = dayTasks.filter((t) => t.missed);
  const isPast = selected < today;

  const sorted = [...dayTasks].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.priority - b.priority || a.title.localeCompare(b.title);
  });

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
      <Txt variant="micro" color={colors.fog500}>
        Plan
      </Txt>
      <Text style={styles.h1}>Shape the days</Text>
      <Txt variant="caption" color={colors.fog500} style={{ marginTop: 6 }}>
        Brighter cells carry more weight. Tap any day — even the ghosts — to see its story.
      </Txt>

      <View style={{ marginTop: 16 }}>
        <CalendarPicker value={selected} onChange={setSelected} marks={marks} />
      </View>

      <View style={{ marginTop: 22 }}>
        <View style={styles.dayHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.dayTitle}>{relativeDayLabel(selected)}</Text>
            <Text style={styles.daySub}>{fmtDateLongGB(selected)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              <Chip label={`${open.length} pending`} color={colors.ember400} />
              <Chip label={`${done.length} closed`} color={colors.mint400} />
              {missed.length > 0 ? <Chip label={`${missed.length} missed`} color={colors.coral400} /> : null}
            </View>
          </View>
          <Btn label="Add" icon="add" onPress={() => app.openTaskSheet(selected)} style={{ paddingHorizontal: 14, paddingVertical: 10 }} />
        </View>

        {isPast && open.length > 0 ? (
          <View style={styles.rescue}>
            <Text style={styles.rescueTitle}>{open.length} unfinished from this day.</Text>
            <Text style={styles.rescueSub}>
              Carry what still matters into today — or own the miss and move on.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Btn label="Carry to today" onPress={() => void app.resolveLeftovers(selected, "carry")} style={{ flex: 1, paddingVertical: 10 }} />
              <Btn label="Miss them all" variant="danger" onPress={() => void app.resolveLeftovers(selected, "miss")} style={{ flex: 1, paddingVertical: 10 }} />
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 14 }}>
          {sorted.length === 0 ? (
            <EmptyState
              title="Nothing on this day"
              sub={isPast ? "A quiet page in the ledger." : "Plant something here."}
              action={<Btn label="Add a task" onPress={() => app.openTaskSheet(selected)} />}
            />
          ) : (
            sorted.map((t, i) => {
              const kind = nodeFor(t, today);
              const tag = TAG_COLORS[t.tag] ?? FALLBACK_TAG;
              return (
                <View key={t.id} style={styles.timelineRow}>
                  <Text style={styles.timeCol}>{t.time ?? "—"}</Text>
                  <View style={styles.rail}>
                    <Dot color={NODE_COLOR[kind]} size={10} glow={kind !== "future"} />
                    {i < sorted.length - 1 ? <View style={styles.railLine} /> : null}
                  </View>
                  <Pressable
                    onPress={() => app.editTaskSheet(t)}
                    style={[styles.timelineCard, { marginBottom: i < sorted.length - 1 ? 10 : 0 }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.timelineTitle,
                          t.done || t.missed ? { color: colors.fog600, textDecorationLine: "line-through" } : null,
                        ]}
                      >
                        {t.title}
                      </Text>
                      <View style={{ flex: 1 }} />
                      <Text style={[styles.kindText, { color: NODE_COLOR[kind] }]}>{NODE_LABEL[kind]}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      {t.time ? <TimeChip day={t.day} time={t.time} done={t.done} /> : null}
                      <View style={[styles.tag, { backgroundColor: tag.soft }]}>
                        <Text style={[styles.tagText, { color: tag.text }]}>{t.tag}</Text>
                      </View>
                      {t.ritualInstanceId != null ? (
                        <View style={[styles.tag, { backgroundColor: alpha.hex(colors.lilac400, 0.12), flexDirection: "row", gap: 3 }]}>
                          <Ionicons name="repeat" size={9} color={colors.lilac400} />
                          <Text style={[styles.tagText, { color: colors.lilac400 }]}>ritual</Text>
                        </View>
                      ) : null}
                      {t.carries > 0 ? (
                        <View style={[styles.tag, { backgroundColor: alpha.hex(colors.gold400, 0.12) }]}>
                          <Text style={[styles.tagText, { color: colors.gold400 }]}>↻ ×{t.carries}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 24, color: colors.bone50, marginTop: 4 },
  dayHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dayTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.bone50 },
  daySub: { fontFamily: fonts.uiBold, fontSize: 10.5, letterSpacing: 1.2, color: colors.fog500, marginTop: 4, textTransform: "uppercase" },
  rescue: {
    marginTop: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha.hex(colors.gold400, 0.3),
    backgroundColor: alpha.hex(colors.gold400, 0.1),
    padding: 14,
  },
  rescueTitle: { fontFamily: fonts.uiBlack, fontSize: 12.5, color: colors.gold400 },
  rescueSub: { fontFamily: fonts.ui, fontSize: 11.5, color: colors.fog400, marginTop: 3 },
  timelineRow: { flexDirection: "row", gap: 10 },
  timeCol: { width: 48, textAlign: "right", paddingTop: 14, fontFamily: fonts.displaySemi, fontSize: 10.5, color: colors.fog500 },
  rail: { width: 12, alignItems: "center", paddingTop: 16 },
  railLine: { width: 1, flex: 1, backgroundColor: hairline },
  timelineCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: colors.ink800,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timelineTitle: { flex: 1, fontFamily: fonts.uiBold, fontSize: 14, color: colors.bone100 },
  kindText: { fontFamily: fonts.uiBold, fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 7 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontFamily: fonts.uiBold, fontSize: 9.5 },
});
