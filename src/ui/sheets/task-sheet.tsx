// ─── Task sheet: create / edit, with the alarm-grade time picker ────────────

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { DayBar } from "@/ui/day-bar";
import { Btn, Chip, FieldLabel, Seg, Sheet, Txt } from "@/ui/kit";
import { fmtTime } from "@/lib/dates";
import { CARRY_LIMIT, type Priority } from "@/lib/types";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, radius } from "@/theme/theme";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(":").map(Number) : [null, null];
  const set = (hh: number | null, mm: number | null) => {
    if (hh == null || mm == null) return;
    onChange(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  };

  return (
    <View style={styles.timeBox}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={styles.timeValue}>{value ? fmtTime(value) : "No time"}</Text>
        {value ? (
          <Chip label="clear" color={colors.fog400} onPress={() => onChange("")} />
        ) : (
          <Txt variant="caption" color={colors.fog600}>
            no alarm
          </Txt>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {HOURS.map((hh) => {
          const active = h === hh;
          return (
            <Pressable
              key={hh}
              onPress={() => set(hh, m ?? 0)}
              style={[styles.numChip, active ? styles.numChipActive : null]}
            >
              <Text style={[styles.numChipText, active ? { color: colors.ink950 } : null]}>
                {String(hh).padStart(2, "0")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {MINUTES.map((mm) => {
          const active = m === mm;
          return (
            <Pressable
              key={mm}
              onPress={() => set(h ?? 9, mm)}
              style={[styles.numChip, active ? styles.numChipActive : null]}
            >
              <Text style={[styles.numChipText, active ? { color: colors.ink950 } : null]}>
                :{String(mm).padStart(2, "0")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function TaskSheet() {
  const app = useApp();
  const state = app.taskSheet;
  const editing = state?.mode === "edit" ? state.task : null;

  const [title, setTitle] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [tag, setTag] = useState("personal");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [editTags, setEditTags] = useState(false);
  const [hydrated, setHydrated] = useState<string | null>(null);

  // Re-hydrate whenever a different task/day is opened.
  const key = state ? (state.mode === "edit" ? `edit-${state.task.id}` : `create-${state.day}`) : null;
  if (state && hydrated !== key) {
    setHydrated(key);
    setTitle(editing?.title ?? "");
    setDay(editing?.day ?? (state.mode === "create" ? state.day : ""));
    setTime(editing?.time ?? "");
    setPriority(editing?.priority ?? 2);
    setTag(editing?.tag ?? "personal");
    setNotes(editing?.notes ?? "");
    setError(null);
    setBusy(false);
  }

  const isRitualTask = editing?.ritualInstanceId != null;

  const save = async () => {
    if (!title.trim()) {
      setError("Give it a title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await app.updateTask(editing.id, { title: title.trim(), day, time: time || null, priority, tag, notes });
      } else {
        await app.addTask({ title: title.trim(), day, time: time || null, priority, tag, notes });
      }
      app.closeTaskSheet();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    try {
      await app.deleteTask(editing.id);
      app.closeTaskSheet();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
    }
  };

  const submitNewTag = async () => {
    const clean = newTag.trim();
    setNewTag("");
    setAddingTag(false);
    if (!clean) return;
    const created = await app.addTag(clean);
    if (created) setTag(created);
  };

  return (
    <Sheet
      open={state != null}
      title={editing ? "Edit task" : "Create task"}
      subtitle={time ? `Alarm armed for ${fmtTime(time)}` : "Add a time and Ledger rings you"}
      onClose={app.closeTaskSheet}
    >
      <View style={{ gap: 18 }}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View>
          <FieldLabel>Title</FieldLabel>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What needs doing?"
            placeholderTextColor={colors.fog600}
            style={styles.input}
            returnKeyType="done"
          />
        </View>

        <DayBar value={day} onChange={setDay} min={editing ? undefined : undefined} />

        <View>
          <FieldLabel>Time — this is what fires the alarm</FieldLabel>
          <TimeField value={time} onChange={setTime} />
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
          <Txt variant="caption" color={colors.fog500} style={{ marginTop: 6 }}>
            Must & should count toward your streak. Must tasks also get a 30-minute warning.
          </Txt>
        </View>

        <View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <FieldLabel>Tag</FieldLabel>
            <Pressable onPress={() => setEditTags((v) => !v)} hitSlop={8}>
              <Ionicons name="pencil" size={13} color={editTags ? colors.ember400 : colors.fog600} />
            </Pressable>
          </View>
          <View style={styles.tagRow}>
            {app.data.tags.map((t) => {
              const active = tag === t.name;
              return (
                <View key={t.name} style={[styles.tagPill, active ? { backgroundColor: colors.ember500 } : null]}>
                  <Pressable onPress={() => setTag(t.name)}>
                    <Text style={[styles.tagPillText, active ? { color: colors.ink950 } : null]}>{t.name}</Text>
                  </Pressable>
                  {editTags ? (
                    <Pressable
                      onPress={() => {
                        const remaining = app.data.tags.filter((x) => x.name !== t.name).map((x) => x.name);
                        if (tag === t.name) setTag(remaining[0] ?? "personal");
                        void app.deleteTag(t.name);
                      }}
                      hitSlop={6}
                    >
                      <Ionicons name="close" size={11} color={active ? "rgba(6,7,8,0.6)" : colors.fog600} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {addingTag ? (
              <TextInput
                autoFocus
                value={newTag}
                onChangeText={setNewTag}
                onSubmitEditing={() => void submitNewTag()}
                onBlur={() => void submitNewTag()}
                placeholder="tag name"
                placeholderTextColor={colors.fog600}
                style={styles.newTagInput}
              />
            ) : (
              <Pressable onPress={() => setAddingTag(true)} style={styles.newTagBtn}>
                <Text style={styles.newTagText}>+ new</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View>
          <FieldLabel>Notes</FieldLabel>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional context…"
            placeholderTextColor={colors.fog600}
            multiline
            style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
          />
        </View>

        {isRitualTask ? (
          <Txt variant="caption" color={colors.fog500}>
            Ritual task — managed from the Rituals tab. Completes on its due date.
          </Txt>
        ) : null}

        {editing && editing.carries > 0 ? (
          <Txt variant="caption" color={colors.fog500}>
            Carried {editing.carries}/{CARRY_LIMIT} times.
          </Txt>
        ) : null}

        <Btn label={editing ? "Save changes" : "Create task"} onPress={() => void save()} loading={busy} />

        {editing && !editing.done && !isRitualTask ? (
          <Btn label="Delete task" variant="danger" icon="trash-outline" onPress={() => void remove()} />
        ) : null}
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
  errorBox: { borderRadius: radius.md, backgroundColor: alpha.hex(colors.coral400, 0.12), paddingHorizontal: 12, paddingVertical: 8 },
  errorText: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.coral400 },
  timeBox: { borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", backgroundColor: colors.ink800, padding: 12 },
  timeValue: { fontFamily: fonts.display, fontSize: 18, color: colors.bone50 },
  chipRow: { gap: 6, paddingVertical: 8 },
  numChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.ink750 },
  numChipActive: { backgroundColor: colors.bone50 },
  numChipText: { fontFamily: fonts.displaySemi, fontSize: 13, color: colors.bone100 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.ink750,
  },
  tagPillText: { fontFamily: fonts.uiBold, fontSize: 11.5, color: colors.fog400 },
  newTagInput: {
    width: 120,
    borderRadius: 999,
    backgroundColor: colors.ink750,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontFamily: fonts.uiBold,
    fontSize: 11.5,
    color: colors.bone50,
  },
  newTagBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.16)",
  },
  newTagText: { fontFamily: fonts.uiBold, fontSize: 11.5, color: colors.fog500 },
});
