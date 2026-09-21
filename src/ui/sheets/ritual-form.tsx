// ─── Ritual form: create or re-shape a vow (port of `ritual-form.tsx`) ──────

import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Btn, Chip, FieldLabel, Seg, Sheet, Txt } from "@/ui/kit";
import { TimeField } from "@/ui/time-field";
import { weekdayShort } from "@/lib/dates";
import { RITUAL_CATEGORIES, RITUAL_ICONS, type Priority, type ScheduleType, type TenureUnit } from "@/lib/types";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, radius, TAG_COLORS, FALLBACK_TAG } from "@/theme/theme";

const SCHEDULES: { value: ScheduleType; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "days", label: "Pick days" },
  { value: "every_n", label: "Every N" },
  { value: "monthly", label: "Monthly" },
  { value: "flex_week", label: "Flexible" },
];

const UNITS: TenureUnit[] = ["DAY", "WEEK", "MONTH", "YEAR"];

const PRESETS: Record<TenureUnit, number[]> = {
  DAY: [7, 14, 21, 30, 60, 90, 100, 365],
  WEEK: [1, 2, 4, 6, 8, 12, 26, 52],
  MONTH: [1, 2, 3, 6, 9, 12, 24],
  YEAR: [1, 2, 3, 5, 10],
};

const WD = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06", "2024-01-07"];

export function RitualFormSheet() {
  const app = useApp();
  const state = app.ritualForm;
  const editing = state?.mode === "edit" ? app.rituals.find((r) => r.id === state.ritualId) ?? null : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? RITUAL_ICONS[0]);
  const [category, setCategory] = useState(editing?.category ?? "personal");
  const [priority, setPriority] = useState<Priority>(editing?.schedule?.priority ?? 1);
  const [scheduleType, setScheduleType] = useState<ScheduleType>(editing?.schedule?.type ?? "daily");
  const [days, setDays] = useState<number[]>(editing?.schedule?.config.days ?? []);
  const [every, setEvery] = useState(editing?.schedule?.config.every ?? 2);
  const [monthDay, setMonthDay] = useState(editing?.schedule?.config.monthDay ?? 1);
  const [flexN, setFlexN] = useState(editing?.schedule?.config.n ?? 3);
  const [time, setTime] = useState(editing?.schedule?.config.time ?? "");
  const [tenureValue, setTenureValue] = useState(editing?.commitment?.tenureValue ?? 30);
  const [tenureUnit, setTenureUnit] = useState<TenureUnit>(editing?.commitment?.tenureUnit ?? "DAY");
  const [vacationBehavior, setVacationBehavior] = useState<"pause" | "continue">(
    editing?.commitment?.vacationBehavior ?? "continue"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<string | null>(null);

  const key = state ? (state.mode === "edit" ? `edit-${state.ritualId}` : "create") : null;
  if (state && hydrated !== key) {
    setHydrated(key);
    setName(editing?.name ?? "");
    setIcon(editing?.icon ?? RITUAL_ICONS[0]);
    setCategory(editing?.category ?? "personal");
    setPriority(editing?.schedule?.priority ?? 1);
    setScheduleType(editing?.schedule?.type ?? "daily");
    setDays(editing?.schedule?.config.days ?? []);
    setEvery(editing?.schedule?.config.every ?? 2);
    setMonthDay(editing?.schedule?.config.monthDay ?? 1);
    setFlexN(editing?.schedule?.config.n ?? 3);
    setTime(editing?.schedule?.config.time ?? "");
    setTenureValue(editing?.commitment?.tenureValue ?? 30);
    setTenureUnit(editing?.commitment?.tenureUnit ?? "DAY");
    setVacationBehavior(editing?.commitment?.vacationBehavior ?? "continue");
    setError(null);
    setBusy(false);
  }

  const config = () => {
    switch (scheduleType) {
      case "days":
        return { days };
      case "every_n":
        return { every };
      case "monthly":
        return { monthDay };
      case "flex_week":
        return { n: flexN };
      default:
        return {};
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Give the ritual a name.");
      return;
    }
    if (scheduleType === "days" && days.length === 0) {
      setError("Pick at least one day.");
      return;
    }
    setBusy(true);
    setError(null);

    const payload = {
      name: name.trim(),
      icon,
      category,
      priority,
      scheduleType,
      config: { ...config(), time: time || null },
      tenureValue,
      tenureUnit,
      vacationBehavior,
    };

    try {
      if (editing) {
        await app.ritualAction(editing.id, "edit", { ...payload, config: { ...config(), time: time || null } });
        app.closeRitualForm();
      } else {
        const duplicate = await app.createRitual(payload);
        if (duplicate) {
          setBusy(false);
          Alert.alert(
            "Already tracking that",
            `"${duplicate.name}" already has a commitment. Start another one anyway?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Start anyway",
                onPress: () => {
                  void app.createRitual(payload, true);
                },
              },
            ]
          );
          return;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the ritual.");
    }
    setBusy(false);
  };

  return (
    <Sheet
      open={state != null}
      title={editing ? "Edit ritual" : "New ritual"}
      subtitle={editing ? "Schedule changes apply from today" : "A vow with a tenure"}
      onClose={app.closeRitualForm}
    >
      <View style={{ gap: 16 }}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View>
          <FieldLabel>Name</FieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Morning pages"
            placeholderTextColor={colors.fog600}
            style={styles.input}
          />
        </View>

        <View>
          <FieldLabel>Icon</FieldLabel>
          <View style={styles.iconGrid}>
            {RITUAL_ICONS.map((i) => {
              const active = i === icon;
              return (
                <Pressable
                  key={i}
                  onPress={() => setIcon(i)}
                  style={[styles.iconCell, active ? { borderColor: colors.ember500 } : null]}
                >
                  <Text style={{ fontSize: 17 }}>{i}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <FieldLabel>Category</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {RITUAL_CATEGORIES.map((c) => {
              const active = c === category;
              const tone = TAG_COLORS[c] ?? FALLBACK_TAG;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    styles.pill,
                    active ? { backgroundColor: tone.soft, borderColor: alpha.hex(tone.text, 0.5) } : null,
                  ]}
                >
                  <Text style={[styles.pillText, active ? { color: tone.text } : null]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <FieldLabel>Cadence</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {SCHEDULES.map((s) => {
              const active = s.value === scheduleType;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => setScheduleType(s.value)}
                  style={[styles.pill, active ? { backgroundColor: alpha.hex(colors.ember500, 0.14), borderColor: alpha.hex(colors.ember500, 0.5) } : null]}
                >
                  <Text style={[styles.pillText, active ? { color: colors.ember400 } : null]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {scheduleType === "days" ? (
            <View style={{ flexDirection: "row", gap: 5, marginTop: 10 }}>
              {WD.map((d, idx) => {
                const active = days.includes(idx);
                return (
                  <Pressable
                    key={d}
                    onPress={() =>
                      setDays((prev) => (prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx].sort()))
                    }
                    style={[styles.dayChip, active ? { backgroundColor: colors.bone50 } : null]}
                  >
                    <Text style={[styles.dayChipText, active ? { color: colors.ink950 } : null]}>
                      {weekdayShort(d).slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {scheduleType === "every_n" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
              {[2, 3, 4, 5, 7, 10, 14, 21, 30].map((n) => (
                <Chip
                  key={n}
                  label={`every ${n}`}
                  color={every === n ? colors.ember400 : colors.fog400}
                  bg={every === n ? alpha.hex(colors.ember500, 0.16) : undefined}
                  onPress={() => setEvery(n)}
                />
              ))}
            </View>
          ) : null}

          {scheduleType === "monthly" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
              {[1, 5, 10, 15, 20, 25, 28].map((n) => (
                <Chip
                  key={n}
                  label={`day ${n}`}
                  color={monthDay === n ? colors.ember400 : colors.fog400}
                  onPress={() => setMonthDay(n)}
                />
              ))}
            </View>
          ) : null}

          {scheduleType === "flex_week" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <Chip
                  key={n}
                  label={`${n}×/week`}
                  color={flexN === n ? colors.ember400 : colors.fog400}
                  onPress={() => setFlexN(n)}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View>
          <FieldLabel>Time (optional — arms an alarm)</FieldLabel>
          <TimeField value={time} onChange={setTime} allowEmpty fallbackHour={7} />
        </View>

        <View>
          <FieldLabel>Priority</FieldLabel>
          <Seg
            value={priority}
            onChange={setPriority}
            options={[
              { value: 1 as Priority, label: "Must", color: colors.ember500 },
              { value: 2 as Priority, label: "Should", color: colors.gold400 },
              { value: 3 as Priority, label: "Could", color: colors.fog500 },
            ]}
          />
        </View>

        <View>
          <FieldLabel>Tenure — how long you commit</FieldLabel>
          <Seg value={tenureUnit} onChange={(u) => setTenureUnit(u)} options={UNITS.map((u) => ({ value: u, label: u[0] + u.slice(1).toLowerCase() }))} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {PRESETS[tenureUnit].map((v) => (
              <Chip
                key={v}
                label={String(v)}
                color={tenureValue === v ? colors.ember400 : colors.fog400}
                bg={tenureValue === v ? alpha.hex(colors.ember500, 0.16) : undefined}
                onPress={() => setTenureValue(v)}
              />
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
            <TextInput
              value={String(tenureValue)}
              onChangeText={(t) => setTenureValue(Math.max(1, Math.min(999, Number(t.replace(/[^0-9]/g, "")) || 1)))}
              keyboardType="number-pad"
              style={[styles.input, { width: 90, textAlign: "center" }]}
            />
            <Txt variant="caption" color={colors.fog500}>
              {tenureValue} {tenureUnit.toLowerCase()}
              {tenureValue === 1 ? "" : "s"} from today
            </Txt>
          </View>
        </View>

        <View>
          <FieldLabel>On vacation</FieldLabel>
          <Seg
            value={vacationBehavior}
            onChange={(v) => setVacationBehavior(v)}
            options={[
              { value: "continue" as const, label: "Keep counting" },
              { value: "pause" as const, label: "Pause tenure" },
            ]}
          />
        </View>

        <Btn label={editing ? "Save ritual" : "Start the ritual"} onPress={() => void submit()} loading={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: radius.lg,
    backgroundColor: colors.ink750,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: fonts.uiSemi,
    fontSize: 15,
    color: colors.bone50,
  },
  error: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.coral400 },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink750,
    borderWidth: 2,
    borderColor: "transparent",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: colors.ink750,
  },
  pillText: { fontFamily: fonts.uiBold, fontSize: 11.5, color: colors.fog400 },
  dayChip: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10, backgroundColor: colors.ink750 },
  dayChipText: { fontFamily: fonts.displaySemi, fontSize: 10.5, color: colors.bone100 },
});
