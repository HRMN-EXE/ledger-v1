// ─── Compact HH:MM picker (native has no `<input type="time">`) ─────────────

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip, Txt } from "@/ui/kit";
import { fmtTime } from "@/lib/dates";
import { colors, fonts, radius } from "@/theme/theme";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function TimeField({
  value,
  onChange,
  allowEmpty = false,
  fallbackHour = 22,
}: {
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
  fallbackHour?: number;
}) {
  const [h, m] = value ? value.split(":").map(Number) : [null, null];

  return (
    <View style={styles.wrap}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={styles.value}>{value ? fmtTime(value) : "Not set"}</Text>
        {allowEmpty && value ? <Chip label="clear" color={colors.fog400} onPress={() => onChange("")} /> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {HOURS.map((hh) => {
          const active = h === hh;
          return (
            <Pressable
              key={hh}
              onPress={() => onChange(`${String(hh).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, active ? { color: colors.ink950 } : null]}>{String(hh).padStart(2, "0")}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {MINUTES.map((mm) => {
          const active = m === mm;
          return (
            <Pressable
              key={mm}
              onPress={() => onChange(`${String(h ?? fallbackHour).padStart(2, "0")}:${String(mm).padStart(2, "0")}`)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, active ? { color: colors.ink950 } : null]}>:{String(mm).padStart(2, "0")}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Txt variant="caption" color={colors.fog600}>
        Scroll the rows — hours then minutes.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", backgroundColor: colors.ink800, padding: 12 },
  value: { fontFamily: fonts.display, fontSize: 17, color: colors.bone50, marginBottom: 4 },
  row: { gap: 6, paddingVertical: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.ink750 },
  chipActive: { backgroundColor: colors.bone50 },
  chipText: { fontFamily: fonts.displaySemi, fontSize: 13, color: colors.bone100 },
});
