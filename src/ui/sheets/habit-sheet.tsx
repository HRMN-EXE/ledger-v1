// ─── Quick habit sheet (port of `habit-sheet.tsx`) ──────────────────────────

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Btn, FieldLabel, Sheet, Txt } from "@/ui/kit";
import { HABIT_ICONS } from "@/lib/types";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, radius, HABIT_COLORS } from "@/theme/theme";

const COLOR_KEYS = Object.keys(HABIT_COLORS);

export function HabitSheet() {
  const app = useApp();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(HABIT_ICONS[0]);
  const [color, setColor] = useState("ember");
  const [weekTarget, setWeekTarget] = useState(3);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setName("");
    setIcon(HABIT_ICONS[0]);
    setColor("ember");
    setWeekTarget(3);
    app.closeHabitSheet();
  };

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await app.addHabit({ name: name.trim(), icon, color, weekTarget });
    setBusy(false);
    close();
  };

  return (
    <Sheet open={app.habitSheetOpen} title="New habit" subtitle="Light tracking for the tiny things" onClose={close}>
      <View style={{ gap: 18 }}>
        <View>
          <FieldLabel>What is it?</FieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Drink water"
            placeholderTextColor={colors.fog600}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
        </View>

        <View>
          <FieldLabel>Icon</FieldLabel>
          <View style={styles.iconGrid}>
            {HABIT_ICONS.map((i) => {
              const active = i === icon;
              return (
                <Pressable
                  key={i}
                  onPress={() => setIcon(i)}
                  style={[styles.iconCell, active ? { borderColor: colors.ember500, borderWidth: 2 } : null]}
                >
                  <Text style={{ fontSize: 18 }}>{i}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <FieldLabel>Colour</FieldLabel>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {COLOR_KEYS.map((key) => {
              const active = key === color;
              return (
                <Pressable
                  key={key}
                  onPress={() => setColor(key)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: HABIT_COLORS[key].dot },
                    active ? { borderWidth: 2, borderColor: colors.bone50 } : null,
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View>
          <FieldLabel>Target per week</FieldLabel>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => {
              const active = n === weekTarget;
              return (
                <Pressable
                  key={n}
                  onPress={() => setWeekTarget(n)}
                  style={[styles.numChip, active ? { backgroundColor: colors.bone50 } : null]}
                >
                  <Text style={[styles.numChipText, active ? { color: colors.ink950 } : null]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          <Txt variant="caption" color={colors.fog500} style={{ marginTop: 8 }}>
            {weekTarget}× per week — dots fill as you log days.
          </Txt>
        </View>

        <Btn label="Create habit" onPress={() => void submit()} loading={busy} disabled={!name.trim()} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: radius.lg,
    backgroundColor: colors.ink750,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.uiSemi,
    fontSize: 15,
    color: colors.bone50,
  },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink750,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  numChip: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10, backgroundColor: colors.ink750 },
  numChipText: { fontFamily: fonts.displaySemi, fontSize: 13, color: colors.bone100 },
});
