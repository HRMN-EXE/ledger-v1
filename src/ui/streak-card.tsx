// ─── Streak hero (ported from the web `streak-card.tsx`) ────────────────────

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/store/app-context";
import type { StreakStatusKind } from "@/lib/streak-engine";
import { PROTECTION_MAX } from "@/lib/types";
import { alpha, colors, fonts, hairline, STATUS_ACCENT } from "@/theme/theme";

export function StreakCard({ compact = false }: { compact?: boolean }) {
  const app = useApp();
  const { streakState, status } = app;
  const alive = streakState.streak > 0;
  const accent = STATUS_ACCENT[status.kind as StreakStatusKind] ?? colors.fog400;

  return (
    <Pressable
      onPress={app.openStreakSheet}
      style={({ pressed }) => [styles.card, pressed ? { opacity: 0.9 } : null]}
    >
      <View style={styles.heat} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ alignItems: "center", gap: 8 }}>
          <View
            style={[
              styles.flameTile,
              { width: compact ? 48 : 56, height: compact ? 48 : 56 },
              alive
                ? { backgroundColor: alpha.hex(colors.ember500, 0.15), borderColor: alpha.hex(colors.ember500, 0.32) }
                : { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "transparent" },
            ]}
          >
            <Ionicons
              name="flame"
              size={compact ? 24 : 28}
              color={alive ? colors.ember400 : colors.fog500}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 3 }}>
            {Array.from({ length: PROTECTION_MAX }, (_, i) => (
              <Ionicons
                key={i}
                name="shield"
                size={13}
                color={i < streakState.protections ? colors.lilac400 : alpha.hex(colors.fog600, 0.5)}
              />
            ))}
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <Text style={[styles.big, { fontSize: compact ? 28 : 36 }]}>{streakState.streak}</Text>
            <Text style={styles.bigLabel}>day{"\n"}streak</Text>
          </View>
          <View style={styles.chipRow}>
            <View style={[styles.chip, { borderColor: alpha.hex(accent, 0.3), backgroundColor: alpha.hex(accent, 0.14) }]}>
              <Text style={[styles.chipText, { color: accent }]} numberOfLines={1}>
                {status.headline}
              </Text>
            </View>
            <View style={[styles.chip, { borderColor: hairline, backgroundColor: "rgba(255,255,255,0.05)" }]}>
              <Text style={[styles.chipText, { color: colors.fog400 }]}>best {streakState.longest}</Text>
            </View>
          </View>
          <Text numberOfLines={1} style={styles.detail}>
            {status.detail}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.fog600} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: alpha.hex(colors.ember500, 0.22),
    backgroundColor: colors.ink800,
    padding: 16,
    overflow: "hidden",
    shadowColor: colors.ember500,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  heat: {
    position: "absolute",
    right: -40,
    top: -60,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: alpha.hex(colors.ember500, 0.14),
  },
  flameTile: { borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  big: { fontFamily: fonts.display, color: colors.bone50, lineHeight: 38 },
  bigLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.fog500,
    textTransform: "uppercase",
    lineHeight: 12,
    paddingBottom: 4,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, maxWidth: 200 },
  chipText: { fontFamily: fonts.uiBold, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase" },
  detail: { fontFamily: fonts.ui, fontSize: 10.5, color: colors.fog500, marginTop: 6 },
});
