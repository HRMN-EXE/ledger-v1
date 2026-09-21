// ─── Leftovers resolver (port of the web `ResolverSheet`) ───────────────────

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Btn, Sheet, Txt } from "@/ui/kit";
import { fmtShort } from "@/lib/dates";
import { CARRY_LIMIT } from "@/lib/types";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, radius } from "@/theme/theme";

const PRIORITY_COLOR: Record<1 | 2 | 3, string> = {
  1: colors.ember500,
  2: colors.gold400,
  3: colors.fog500,
};

export function ResolverSheet() {
  const app = useApp();
  const items = app.resolveItems;

  return (
    <Sheet
      open={items != null && items.length > 0}
      title="Yesterday's leftovers"
      subtitle="Carry them into today — or own the miss."
      onClose={() => void app.resolveLeftovers(items?.[0]?.day ?? "", "miss")}
    >
      <View style={{ gap: 10 }}>
        <Txt variant="caption" color={colors.fog400}>
          These tasks didn&apos;t close. The streak only counts what&apos;s real, so decide now — carry or miss.
        </Txt>
        {(items ?? []).map((t) => {
          const maxed = t.carries >= CARRY_LIMIT;
          const label = t.priority === 1 ? "Must" : t.priority === 2 ? "Should" : "Could";
          return (
            <View key={t.id} style={styles.row}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.title}>
                    {t.title}
                  </Text>
                  <Text style={styles.meta}>
                    {fmtShort(t.day)} · {label}
                    {t.carries > 0 ? ` · carried ×${t.carries}` : ""}
                  </Text>
                </View>
                <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[t.priority] }]} />
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Btn
                  label={maxed ? "Carry limit hit" : "Carry to today"}
                  disabled={maxed}
                  onPress={() => void app.carryTask(t.id)}
                  style={{ flex: 1, paddingVertical: 11 }}
                />
                <Btn label="Mark missed" variant="danger" onPress={() => void app.missTask(t.id)} style={{ flex: 1, paddingVertical: 11 }} />
              </View>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: colors.ink800,
    padding: 14,
  },
  title: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.bone100 },
  meta: { fontFamily: fonts.uiSemi, fontSize: 11, color: colors.fog500, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
