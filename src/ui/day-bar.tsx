// ─── Day bar: this week as seven tactile cells + full calendar expander ─────

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CalendarPicker } from "@/ui/calendar-picker";
import { fmtDateLongGB, todayISO, weekOf, weekdayLetter } from "@/lib/dates";
import { colors, fonts, radius } from "@/theme/theme";

export function DayBar({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (day: string) => void;
  min?: string;
}) {
  const [fullOpen, setFullOpen] = useState(false);
  const today = todayISO();
  const week = weekOf(value);

  return (
    <View style={styles.wrap}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={styles.label}>Day</Text>
        <Text style={styles.hint}>{min ? "Past dates locked" : "Any day"}</Text>
      </View>

      <Text style={styles.selected}>{fmtDateLongGB(value)}</Text>

      <View style={styles.weekRow}>
        {week.map((day) => {
          const locked = min != null && day < min;
          const selected = day === value;
          const isToday = day === today;
          return (
            <Pressable
              key={day}
              disabled={locked}
              onPress={() => onChange(day)}
              style={[
                styles.cell,
                selected
                  ? { backgroundColor: colors.bone50, borderColor: "transparent" }
                  : locked
                    ? { borderColor: "rgba(255,255,255,0.05)", backgroundColor: "rgba(31,33,39,0.6)", opacity: 0.3 }
                    : { borderColor: isToday ? "rgba(255,106,43,0.4)" : "rgba(255,255,255,0.05)", backgroundColor: colors.ink750 },
              ]}
            >
              <Text style={[styles.cellLetter, selected ? { color: "rgba(6,7,8,0.5)" } : null]}>
                {weekdayLetter(day)}
              </Text>
              <Text style={[styles.cellNum, selected ? { color: colors.ink950 } : null]}>{Number(day.slice(8, 10))}</Text>
              {isToday ? (
                <Text style={[styles.cellNow, selected ? { color: "rgba(6,7,8,0.6)" } : null]}>now</Text>
              ) : (
                <View style={{ height: 8 }} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => setFullOpen((v) => !v)} style={styles.expander}>
        <Ionicons name="calendar-outline" size={15} color={colors.ember400} />
        <Text style={styles.expanderText}>Full calendar — any month, any year</Text>
        <Ionicons name={fullOpen ? "chevron-down" : "chevron-forward"} size={14} color={colors.fog500} />
      </Pressable>

      {fullOpen ? (
        <View style={{ marginTop: 10 }}>
          <CalendarPicker value={value} onChange={onChange} min={min} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", backgroundColor: colors.ink800, padding: 14 },
  label: { fontFamily: fonts.displaySemi, fontSize: 10, letterSpacing: 1.8, color: colors.fog500, textTransform: "uppercase" },
  hint: { fontFamily: fonts.uiBold, fontSize: 9, letterSpacing: 1, color: colors.fog600, textTransform: "uppercase" },
  selected: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.bone50, marginTop: 8 },
  weekRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  cell: {
    flex: 1,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  cellLetter: { fontFamily: fonts.uiBold, fontSize: 8.5, color: colors.fog500, textTransform: "uppercase" },
  cellNum: { fontFamily: fonts.display, fontSize: 14.5, color: colors.bone100 },
  cellNow: { fontFamily: fonts.uiBold, fontSize: 6.5, letterSpacing: 1, color: colors.ember400, textTransform: "uppercase" },
  expander: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(31,33,39,0.8)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  expanderText: { flex: 1, fontFamily: fonts.uiSemi, fontSize: 12.5, color: colors.bone100 },
});
