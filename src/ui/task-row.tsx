// ─── Task row + urgency chip (ported from the web `task-row.tsx`) ───────────

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/store/app-context";
import { fmtDelta, fmtTime, minutesUntil, todayISO } from "@/lib/dates";
import type { TaskDTO } from "@/lib/types";
import { alpha, colors, fonts, radius, TAG_COLORS, FALLBACK_TAG } from "@/theme/theme";

function tagColor(name: string, tags: { name: string; color: string }[]) {
  const tag = tags.find((t) => t.name === name);
  return TAG_COLORS[tag?.color ?? name] ?? TAG_COLORS[name] ?? FALLBACK_TAG;
}

/**
 * Time-aware chip: ember (scheduled) → gold (≤30 min) → pulsing coral (late).
 */
export function TimeChip({ day, time, done }: { day: string; time: string; done: boolean }) {
  const isToday = day === todayISO();
  const base = [styles.timeChip];

  if (!isToday || done) {
    return (
      <View style={[...base, { backgroundColor: alpha.hex(colors.ember500, 0.15) }]}>
        <Ionicons name="time-outline" size={10} color={colors.ember300} />
        <Text style={[styles.timeText, { color: colors.ember300 }]}>{fmtTime(time)}</Text>
      </View>
    );
  }
  const mins = minutesUntil(day, time);
  if (mins < 0) {
    return (
      <View style={[...base, { backgroundColor: alpha.hex(colors.coral400, 0.2) }]}>
        <Ionicons name="alarm-outline" size={10} color={colors.coral400} />
        <Text style={[styles.timeText, { color: colors.coral400 }]}>{fmtDelta(mins)} late</Text>
      </View>
    );
  }
  if (mins <= 30) {
    return (
      <View style={[...base, { backgroundColor: alpha.hex(colors.gold400, 0.2) }]}>
        <Ionicons name="time-outline" size={10} color={colors.gold400} />
        <Text style={[styles.timeText, { color: colors.gold400 }]}>
          {mins === 0 ? "now" : `in ${fmtDelta(mins)}`}
        </Text>
      </View>
    );
  }
  return (
    <View style={[...base, { backgroundColor: alpha.hex(colors.ember500, 0.15) }]}>
      <Ionicons name="time-outline" size={10} color={colors.ember300} />
      <Text style={[styles.timeText, { color: colors.ember300 }]}>
        {fmtTime(time)} · in {fmtDelta(mins)}
      </Text>
    </View>
  );
}

const PRIORITY_DOT: Record<1 | 2 | 3, string> = {
  1: colors.ember500,
  2: colors.gold400,
  3: colors.fog500,
};

export function TaskRow({
  task,
  onToggle,
  onOpen,
}: {
  task: TaskDTO;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const app = useApp();
  const dot = PRIORITY_DOT[task.priority];
  const tag = tagColor(task.tag, app.data.tags);
  const isRitual = task.ritualInstanceId != null;

  return (
    <View style={[styles.row, task.done ? styles.rowDone : null]}>
      <View style={[styles.spine, { backgroundColor: task.done ? alpha.hex(colors.fog600, 0.4) : dot }]} />

      <Pressable onPress={onToggle} hitSlop={6} style={[styles.check, task.done ? styles.checkDone : null]}>
        {task.done ? <Ionicons name="checkmark" size={14} color={colors.ink950} /> : null}
      </Pressable>

      <Pressable onPress={onOpen} style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={[styles.title, task.done ? styles.titleDone : null]}
        >
          {task.title}
        </Text>
        <View style={styles.metaRow}>
          {task.time ? <TimeChip day={task.day} time={task.time} done={task.done} /> : null}
          <View style={[styles.tag, { backgroundColor: tag.soft }]}>
            <Text style={[styles.tagText, { color: tag.text }]}>{task.tag}</Text>
          </View>
          {isRitual ? (
            <View style={[styles.tag, { backgroundColor: alpha.hex(colors.lilac400, 0.12), flexDirection: "row", gap: 3 }]}>
              <Ionicons name="repeat" size={9} color={colors.lilac400} />
              <Text style={[styles.tagText, { color: colors.lilac400 }]}>ritual</Text>
            </View>
          ) : null}
          {task.carries > 0 ? (
            <View style={[styles.tag, { backgroundColor: alpha.hex(colors.gold400, 0.12) }]}>
              <Text style={[styles.tagText, { color: colors.gold400 }]}>↻ ×{task.carries}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: task.done ? alpha.hex(colors.fog600, 0.5) : dot,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: colors.ink800,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
    overflow: "hidden",
  },
  rowDone: { backgroundColor: alpha.hex(colors.ink850, 0.75) },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: alpha.hex(colors.fog500, 0.55),
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: {
    borderColor: colors.mint500,
    backgroundColor: colors.mint500,
    shadowColor: colors.mint500,
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  title: { fontFamily: fonts.uiBold, fontSize: 14.5, color: colors.bone100 },
  titleDone: { color: colors.fog600, textDecorationLine: "line-through" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeText: { fontFamily: fonts.displaySemi, fontSize: 10.5 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  tagText: { fontFamily: fonts.uiBold, fontSize: 9.5 },
});
