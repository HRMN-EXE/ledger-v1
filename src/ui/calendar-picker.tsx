// ─── Heat calendar (ported from the web `calendar-picker.tsx`) ──────────────
// Month and year views; each day cell is tinted by its load — ember when work
// is still open, mint when the day is closed out.

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Txt } from "@/ui/kit";
import { addMonths, monthGrid, monthLabel, monthShort, todayISO } from "@/lib/dates";
import { alpha, colors, fonts, hairline, radius } from "@/theme/theme";

const HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

export interface DayStats {
  open: number;
  done: number;
}

function trimRows(cells: (string | null)[]): (string | null)[] {
  let out = cells;
  while (out.length >= 7 && out.slice(-7).every((c) => c === null)) {
    out = out.slice(0, out.length - 7);
  }
  return out;
}

function cellColor(day: string, value: string, marks: Map<string, DayStats> | undefined, today: string): string {
  const stats = marks?.get(day);
  const open = stats?.open ?? 0;
  const done = stats?.done ?? 0;
  if (day === value) return colors.bone50;
  if (open > 0) return alpha.hex(colors.ember500, 0.8);
  if (done > 0) return alpha.hex(colors.mint500, 0.8);
  if (day < today) return "rgba(255,255,255,0.05)";
  return "rgba(255,255,255,0.1)";
}

export function CalendarPicker({
  value,
  onChange,
  min,
  marks,
}: {
  value: string;
  onChange: (day: string) => void;
  min?: string;
  marks?: Map<string, DayStats>;
}) {
  const [anchor, setAnchor] = useState(value);
  const [view, setView] = useState<"month" | "year">("month");
  const today = todayISO();
  const cells = trimRows(monthGrid(anchor));
  const onToday = value === today;

  const jumpToday = () => {
    setAnchor(today);
    setView("month");
    onChange(today);
  };

  const step = view === "year" ? 12 : 1;

  const header = (
    <View style={styles.nav}>
      <Pressable onPress={() => setAnchor(addMonths(anchor, -step))} hitSlop={8} style={styles.navBtn}>
        <Ionicons name="chevron-back" size={16} color={colors.fog400} />
      </Pressable>
      <Text style={styles.navTitle}>
        {view === "year" ? anchor.slice(0, 4) : monthLabel(anchor)}
      </Text>
      <Pressable onPress={() => setAnchor(addMonths(anchor, step))} hitSlop={8} style={styles.navBtn}>
        <Ionicons name="chevron-forward" size={16} color={colors.fog400} />
      </Pressable>
    </View>
  );

  const toggles = (
    <View style={styles.toggleRow}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {(["month", "year"] as const).map((v) => {
          const active = view === v;
          return (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={[
                styles.toggle,
                active
                  ? { borderColor: alpha.hex(colors.ember500, 0.45), backgroundColor: alpha.hex(colors.ember500, 0.12) }
                  : { borderColor: hairlineStrong, backgroundColor: colors.ink750 },
              ]}
            >
              <Text style={[styles.toggleText, { color: active ? colors.ember400 : colors.fog400 }]}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
      {!onToday ? (
        <Pressable onPress={jumpToday} style={styles.todayBtn}>
          <Text style={styles.todayText}>Today</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const legend = (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colors.ember500 }]} />
        <Text style={styles.legendText}>pending</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colors.mint500 }]} />
        <Text style={styles.legendText}>closed</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      {header}
      {toggles}

      {view === "month" ? (
        <>
          <View style={styles.weekRow}>
            {HEADERS.map((h, i) => (
              <Text key={`${h}${i}`} style={styles.weekHead}>
                {h}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`empty-${i}`} style={styles.cellWrap} />;
              const locked = min != null && day < min;
              const selected = day === value;
              const isToday = day === today;
              return (
                <Pressable
                  key={day}
                  disabled={locked}
                  onPress={() => onChange(day)}
                  style={styles.cellWrap}
                >
                  <View
                    style={[
                      styles.cell,
                      { backgroundColor: locked ? "rgba(255,255,255,0.03)" : cellColor(day, value, marks, today) },
                      isToday && !selected ? { borderWidth: 1, borderColor: colors.ember500 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        selected ? { color: colors.ink950 } : { color: colors.bone100 },
                      ]}
                    >
                      {Number(day.slice(8, 10))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {Array.from({ length: 12 }, (_, m) => {
            const monthIso = `${anchor.slice(0, 4)}-${String(m + 1).padStart(2, "0")}-01`;
            const mCells = monthGrid(monthIso);
            return (
              <Pressable
                key={m}
                onPress={() => {
                  setAnchor(monthIso);
                  setView("month");
                }}
                style={styles.monthCard}
              >
                <Text style={styles.monthLabel}>{monthShort(monthIso)}</Text>
                <View style={styles.monthGrid}>
                  {mCells.slice(0, 35).map((day, i) =>
                    day ? (
                      <View
                        key={day}
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 3,
                          backgroundColor: cellColor(day, value, marks, today),
                        }}
                      />
                    ) : (
                      <View key={`blank-${i}`} style={{ width: 9, height: 9 }} />
                    )
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {legend}
    </View>
  );
}

const hairlineStrong = "rgba(255,255,255,0.12)";

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", backgroundColor: colors.ink800, padding: 12 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 8 },
  navBtn: { padding: 6, borderRadius: 10 },
  navTitle: { fontFamily: fonts.displaySemi, fontSize: 13, color: colors.bone50 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 6 },
  toggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  toggleText: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alpha.hex(colors.mint500, 0.3),
    backgroundColor: alpha.hex(colors.mint500, 0.1),
  },
  todayText: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 0.8, color: colors.mint400, textTransform: "uppercase" },
  weekRow: { flexDirection: "row", marginTop: 4 },
  weekHead: { flex: 1, textAlign: "center", fontFamily: fonts.uiBold, fontSize: 9, color: colors.fog600, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  cellWrap: { width: `${100 / 7}%`, padding: 2 },
  cell: { height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cellText: { fontFamily: fonts.displaySemi, fontSize: 12 },
  monthCard: { width: "31%", borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", backgroundColor: alpha.hex(colors.ink750, 0.6), padding: 6 },
  monthLabel: { fontFamily: fonts.uiBold, fontSize: 9, color: colors.fog500, textAlign: "center", letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 2, justifyContent: "center" },
  legend: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontFamily: fonts.uiBold, fontSize: 9, color: colors.fog500, letterSpacing: 0.6, textTransform: "uppercase" },
});
