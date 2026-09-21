// ─── Today ──────────────────────────────────────────────────────────────────
// Direct port of the web `views/today.tsx`: greeting + day ring, the streak
// hero, "the one thing", rituals due today, then the stack split by priority.

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Btn, Card, Chip, Dot, EmptyState, ProgressBar, Ring } from "@/ui/kit";
import { StreakCard } from "@/ui/streak-card";
import { TaskRow, TimeChip } from "@/ui/task-row";
import { dayNum, greeting, minutesUntil, monthShort, pad, todayISO, weekdayLong } from "@/lib/dates";
import { scheduleLabel } from "@/lib/ritual-meta";
import type { StreakStatus } from "@/lib/streak-engine";
import type { Priority, TaskDTO } from "@/lib/types";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, hairline, hairlineStrong, radius, STATUS_ACCENT } from "@/theme/theme";

function sublineFor(status: StreakStatus): string {
  const s = status.remaining;
  switch (status.kind) {
    case "SAFE":
      return "Everything's handled. You're dangerous today.";
    case "AT_RISK":
      return `${s} loose end${s === 1 ? "" : "s"} on the stack. Hunt them down.`;
    case "FINAL_WARNING":
      return `${s} left and the sun's already going down. Move.`;
    case "VACATION":
      return "Streak's on ice. Touch grass guilt-free.";
    case "INACTIVE":
      return "Empty runway. Stack one real task and light it.";
    case "INACTIVE_WARNING":
      return "Careful — a second quiet day resets the flame.";
    case "PROTECTED":
      return `${s} pending, shield up. Finish it anyway.`;
    default:
      return "";
  }
}

const GROUP_TAGLINE: Record<Priority, string> = {
  1: "do or die",
  2: "keep the promise",
  3: "if there's air",
};

const GROUP_COLOR: Record<Priority, string> = {
  1: colors.ember500,
  2: colors.gold400,
  3: colors.fog400,
};

function ClockPill() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={styles.clockPill}>
      <Ionicons name="time-outline" size={11} color={colors.bone300} />
      <Text style={styles.clockText}>
        {pad(now.getHours())}:{pad(now.getMinutes())}
      </Text>
      <Dot color={colors.ember500} size={6} />
    </View>
  );
}

function Group({ priority, tasks }: { priority: Priority; tasks: TaskDTO[] }) {
  const app = useApp();
  if (tasks.length === 0) return null;
  const color = GROUP_COLOR[priority];
  const label = priority === 1 ? "Must" : priority === 2 ? "Should" : "Could";
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.groupHead}>
        <Dot color={color} size={8} glow />
        <Text style={[styles.groupLabel, { color }]}>{label}</Text>
        <Text style={styles.groupTagline}>{GROUP_TAGLINE[priority]}</Text>
        <View style={styles.groupRule} />
        <Text style={styles.groupCount}>{tasks.length}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={() => void app.toggleTask(t.id)} onOpen={() => app.editTaskSheet(t)} />
        ))}
      </View>
    </View>
  );
}

export function TodayScreen() {
  const app = useApp();
  const today = todayISO();
  const tasks = app.data.tasks;
  const status = app.status;

  const todays = tasks.filter((t) => t.day === today && !t.missed);
  const open = todays.filter((t) => !t.done);
  const doneItems = todays
    .filter((t) => t.done)
    .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const byPriority = (p: Priority) =>
    open.filter((t) => t.priority === p).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  const mustOpen = open.filter((t) => t.priority === 1).length;
  const lateCount = open.filter((t) => t.time && minutesUntil(t.day, t.time) < 0).length;
  const totalLive = todays.length;
  const dayProgress = totalLive > 0 ? doneItems.length / totalLive : 0;

  const ritualTasks = todays.filter((t) => t.ritualInstanceId != null);
  const honored = ritualTasks.filter((t) => t.done).length;
  const activeRituals = app.rituals.filter((r) => r.commitment?.status === "ACTIVE");
  const ritualProgress = ritualTasks.length > 0 ? honored / ritualTasks.length : 0;

  const intent = app.data.intent;
  const [editingIntent, setEditingIntent] = useState(false);
  const [intentText, setIntentText] = useState("");

  const saveIntent = () => {
    setEditingIntent(false);
    const text = intentText.trim();
    if (text === (intent?.text ?? "")) return;
    void app.setIntent(text);
  };

  const accent = STATUS_ACCENT[status.kind] ?? colors.fog400;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>LEDGER</Text>
          <ClockPill />
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, marginTop: 22 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.h1}>{greeting()}</Text>
            <Text style={styles.h1Accent}>{app.profileName ? `${app.profileName}.` : "let's move."}</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateText}>{weekdayLong(today)}</Text>
              <Dot color={colors.ember400} size={4} />
              <Text style={styles.dateText}>
                {monthShort(today)} {dayNum(today)}
              </Text>
            </View>
            <Text style={styles.subline}>{sublineFor(status)}</Text>
          </View>
          <Ring value={dayProgress} size={76} stroke={6}>
            {totalLive > 0 ? (
              <View style={{ alignItems: "center" }}>
                <Text style={styles.ringValue}>
                  {doneItems.length}/{totalLive}
                </Text>
                <Text style={styles.ringLabel}>today</Text>
              </View>
            ) : (
              <Text style={{ fontFamily: fonts.display, color: colors.fog500, fontSize: 16 }}>–</Text>
            )}
          </Ring>
        </View>

        <View style={styles.pulseRow}>
          {status.kind === "VACATION" ? (
            <Chip label="❄ streak frozen" color={colors.sky400} />
          ) : (
            <>
              <Chip
                label={open.length === 0 && totalLive > 0 ? "all clear ✓" : `${open.length} pending`}
                color={open.length === 0 && totalLive > 0 ? colors.mint400 : colors.ember400}
              />
              <Chip label={`${mustOpen} must`} color={colors.gold400} />
              {lateCount > 0 ? <Chip label={`${lateCount} late`} color={colors.coral400} /> : null}
              {app.notifPrefs.alarms ? (
                <Chip label="alarms on" color={colors.mint400} icon="alarm-outline" onPress={app.openSettings} />
              ) : (
                <Chip label="alarms off" color={colors.coral400} icon="alarm-outline" onPress={app.openSettings} />
              )}
            </>
          )}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, gap: 20 }}>
        <StreakCard />

        {/* missed alarms while the app was closed */}
        {app.missedAlarms.length > 0 ? (
          <Card style={{ borderColor: alpha.hex(colors.coral400, 0.3), backgroundColor: alpha.hex(colors.coral400, 0.07) }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="alarm-outline" size={16} color={colors.coral400} />
              <Text style={styles.cardTitle}>Rang while you were away</Text>
            </View>
            <Text style={styles.cardSub}>
              {app.missedAlarms.length} alarm{app.missedAlarms.length === 1 ? "" : "s"} fired today and the task is still open.
            </Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              {app.missedAlarms.slice(0, 3).map((t) => (
                <View key={t.id} style={styles.missedRow}>
                  <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => app.editTaskSheet(t)}>
                    <Text numberOfLines={1} style={styles.missedTitle}>
                      {t.title}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                      {t.time ? <TimeChip day={t.day} time={t.time} done={t.done} /> : null}
                    </View>
                  </Pressable>
                  <Chip label="done" color={colors.mint400} onPress={() => { app.dismissMissed(t.id); void app.toggleTask(t.id); }} />
                  <Chip label="missed" color={colors.fog400} onPress={() => void app.missTask(t.id)} />
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* ── The one thing ── */}
        {editingIntent ? (
          <View>
            <TextInput
              autoFocus
              value={intentText}
              onChangeText={setIntentText}
              onBlur={saveIntent}
              onSubmitEditing={saveIntent}
              returnKeyType="done"
              placeholder="What would make today a win?"
              placeholderTextColor={colors.fog600}
              style={styles.intentInput}
              multiline
            />
            <Text style={styles.intentHint}>Tap outside to lock it in</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setIntentText(intent?.text ?? "");
              setEditingIntent(true);
            }}
            style={({ pressed }) => [styles.intentCard, pressed ? { opacity: 0.9 } : null]}
          >
            <View style={styles.intentSpine} />
            <View style={styles.intentHead}>
              <Ionicons name="sparkles-outline" size={11} color={colors.ember400} />
              <Text style={styles.intentLabel}>The one thing</Text>
              <View style={{ flex: 1 }} />
              <Ionicons name="pencil" size={13} color={colors.fog600} />
            </View>
            <Text
              style={[
                styles.intentText,
                intent?.text ? { color: colors.bone50 } : { color: colors.fog600 },
              ]}
            >
              {intent?.text || "What would make today a win?"}
            </Text>
            {intent?.text ? (
              <View style={styles.lockedChip}>
                <Text style={styles.lockedText}>locked in</Text>
              </View>
            ) : null}
          </Pressable>
        )}

        {/* ── Rituals today ── */}
        {activeRituals.length > 0 ? (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <View style={styles.ritualHead}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.ritualIcon}>
                  <Ionicons name="repeat" size={16} color={colors.lilac400} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Rituals today</Text>
                  <Text style={styles.cardMicro}>vows, not vibes</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.countPill}>
                  <Text style={styles.countText}>
                    {honored}
                    <Text style={{ color: colors.fog500 }}>/{ritualTasks.length}</Text>
                  </Text>
                </View>
                <Chip label="all →" color={colors.fog400} onPress={() => app.setTab("habits")} />
              </View>
            </View>

            <View style={{ paddingHorizontal: 16 }}>
              <ProgressBar value={ritualProgress} color={colors.lilac400} />
            </View>

            {ritualTasks.length === 0 ? (
              <View style={{ padding: 16 }}>
                <View style={styles.dashedBox}>
                  <Text style={styles.cardSub}>Nothing due from your rituals today. Enjoy the slack.</Text>
                </View>
              </View>
            ) : (
              <View style={{ padding: 12, gap: 8 }}>
                {ritualTasks.map((t) => {
                  const ritual = app.rituals.find((r) => r.id === t.ritualId);
                  return (
                    <View key={t.id} style={[styles.ritualRow, t.done ? styles.ritualRowDone : null]}>
                      <View style={styles.ritualEmoji}>
                        <Text style={{ fontSize: 18 }}>{ritual?.icon ?? "●"}</Text>
                      </View>
                      <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => app.editTaskSheet(t)}>
                        <Text numberOfLines={1} style={[styles.ritualTitle, t.done ? styles.titleDone : null]}>
                          {t.title}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                          {t.time ? <TimeChip day={t.day} time={t.time} done={t.done} /> : null}
                          <Text numberOfLines={1} style={styles.cardMicro}>
                            {ritual?.schedule ? scheduleLabel(ritual.schedule.type, ritual.schedule.config) : "ritual"}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => void app.toggleTask(t.id)}
                        style={[styles.ritualCheck, t.done ? styles.ritualCheckDone : null]}
                      >
                        {t.done ? <Ionicons name="checkmark" size={15} color={colors.ink950} /> : null}
                      </Pressable>
                    </View>
                  );
                })}
                {ritualTasks.length > 0 && honored === ritualTasks.length ? (
                  <View style={styles.cleanSweep}>
                    <Text style={styles.cleanSweepText}>✦ clean sweep — every ritual honored</Text>
                  </View>
                ) : null}
              </View>
            )}
          </Card>
        ) : (
          <View style={styles.ritualEmpty}>
            <Text style={[styles.cardTitle, { color: colors.bone300 }]}>No rituals yet.</Text>
            <Text style={[styles.cardSub, { textAlign: "center", marginTop: 4 }]}>
              Small daily vows compound. Start one that scares you a little.
            </Text>
            <Btn
              label="Start a ritual"
              icon="flame"
              onPress={app.openRitualCreate}
              style={{ marginTop: 14, paddingHorizontal: 18, paddingVertical: 10 }}
            />
          </View>
        )}

        {/* ── Today's stack ── */}
        <View>
          <View style={styles.stackHead}>
            <Text style={styles.stackLabel}>Today&apos;s stack</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Chip label={`${open.length} pending`} color={colors.ember400} />
              <Chip label={`${doneItems.length} done`} color={colors.mint400} />
            </View>
          </View>

          {todays.length === 0 ? (
            <EmptyState
              title="Nothing planned yet."
              sub={`Tap + and claim the day\nbefore it claims itself.`}
              action={<Btn label="Add a task" icon="add" onPress={() => app.openTaskSheet()} />}
            />
          ) : (
            <>
              <Group priority={1} tasks={byPriority(1)} />
              <Group priority={2} tasks={byPriority(2)} />
              <Group priority={3} tasks={byPriority(3)} />
            </>
          )}

          {doneItems.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              <View style={styles.groupHead}>
                <Dot color={colors.mint500} size={8} glow />
                <Text style={[styles.groupLabel, { color: colors.mint400 }]}>Closed out</Text>
                <View style={styles.groupRule} />
                <Text style={styles.groupCount}>{doneItems.length}</Text>
              </View>
              <View style={{ gap: 8 }}>
                {doneItems.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onToggle={() => void app.toggleTask(t.id)}
                    onOpen={() => app.editTaskSheet(t)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <Text style={styles.footerNote}>
          {app.missedAlarms.length > 0
            ? "Tap an alarm to re-plan it."
            : `${ritualTasks.length > 0 ? "Honor the vows. " : ""}Everything you log stays on this device.`}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 3, color: colors.fog500 },
  clockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: hairlineStrong,
    backgroundColor: alpha.hex(colors.ink800, 0.85),
  },
  clockText: { fontFamily: fonts.displaySemi, fontSize: 12, color: colors.bone50 },
  h1: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.bone50 },
  h1Accent: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.ember400 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  dateText: { fontFamily: fonts.displaySemi, fontSize: 12.5, letterSpacing: 1.8, color: colors.bone100, textTransform: "uppercase" },
  subline: { fontFamily: fonts.uiSemi, fontSize: 13, color: colors.fog400, marginTop: 10, lineHeight: 19 },
  ringValue: { fontFamily: fonts.display, fontSize: 14, color: colors.bone100 },
  ringLabel: { fontFamily: fonts.uiBold, fontSize: 7.5, letterSpacing: 1, color: colors.fog500, textTransform: "uppercase" },
  pulseRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 16 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  groupLabel: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 1.8, textTransform: "uppercase" },
  groupTagline: { fontFamily: fonts.uiSemi, fontSize: 9.5, color: colors.fog600 },
  groupRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: hairline },
  groupCount: { fontFamily: fonts.displaySemi, fontSize: 10.5, color: colors.fog500 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 14, color: colors.bone50 },
  cardSub: { fontFamily: fonts.ui, fontSize: 12, color: colors.fog500, lineHeight: 18 },
  cardMicro: { fontFamily: fonts.uiSemi, fontSize: 9.5, letterSpacing: 0.8, color: colors.fog600, textTransform: "uppercase" },
  missedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  missedTitle: { fontFamily: fonts.uiBold, fontSize: 13.5, color: colors.bone100 },
  intentCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: colors.ink800,
    padding: 18,
    overflow: "hidden",
  },
  intentSpine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.ember500 },
  intentHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  intentLabel: { fontFamily: fonts.displaySemi, fontSize: 10, letterSpacing: 1.8, color: colors.fog500, textTransform: "uppercase" },
  intentText: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 24, marginTop: 10 },
  lockedChip: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: alpha.hex(colors.ember500, 0.12),
  },
  lockedText: { fontFamily: fonts.uiBold, fontSize: 9, letterSpacing: 1.4, color: colors.ember400, textTransform: "uppercase" },
  intentInput: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: alpha.hex(colors.ember500, 0.45),
    backgroundColor: colors.ink800,
    padding: 18,
    fontFamily: fonts.displaySemi,
    fontSize: 17,
    color: colors.bone50,
    minHeight: 96,
  },
  intentHint: { fontFamily: fonts.uiSemi, fontSize: 10.5, color: colors.fog600, marginTop: 6, letterSpacing: 0.6 },
  ritualHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 12 },
  ritualIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha.hex(colors.lilac400, 0.14),
  },
  countPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: hairline, backgroundColor: colors.ink750 },
  countText: { fontFamily: fonts.displaySemi, fontSize: 11, color: colors.bone100 },
  ritualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: alpha.hex(colors.ink750, 0.7),
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  ritualRowDone: { borderColor: alpha.hex(colors.mint500, 0.14), backgroundColor: alpha.hex(colors.ink850, 0.7) },
  ritualEmoji: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink700,
  },
  ritualTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.bone100 },
  titleDone: { color: colors.fog600, textDecorationLine: "line-through" },
  ritualCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: alpha.hex(colors.fog500, 0.5),
    alignItems: "center",
    justifyContent: "center",
  },
  ritualCheckDone: { borderColor: colors.mint500, backgroundColor: colors.mint500 },
  cleanSweep: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha.hex(colors.mint500, 0.24),
    backgroundColor: alpha.hex(colors.mint500, 0.12),
    paddingVertical: 10,
    alignItems: "center",
  },
  cleanSweepText: { fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1, color: colors.mint400, textTransform: "uppercase" },
  ritualEmpty: {
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: alpha.hex(colors.ink800, 0.5),
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
  },
  dashedBox: { borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.12)", padding: 14, alignItems: "center" },
  stackHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  stackLabel: { fontFamily: fonts.displaySemi, fontSize: 11, letterSpacing: 2, color: colors.fog500, textTransform: "uppercase" },
  footerNote: { fontFamily: fonts.ui, fontSize: 11, color: colors.fog600, textAlign: "center", marginTop: 8 },
});
