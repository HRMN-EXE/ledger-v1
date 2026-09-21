// ─── The ringing screen (port of the web `AlarmOverlay`) ────────────────────
// Shows when the OS fires an alarm while Ledger is open, or when the user taps
// an alarm notification. Sound + vibration are owned by `notifications/sound`.

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Btn, Txt } from "@/ui/kit";
import { fmtTime, todayISO } from "@/lib/dates";
import { MAX_SNOOZES, SNOOZE_MINUTES } from "@/notifications/engine";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, radius, shadow } from "@/theme/theme";

export function AlarmOverlay() {
  const app = useApp();
  const alarm = app.alarm;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!alarm) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [alarm, pulse]);

  if (!alarm) return null;

  const task = alarm.taskId != null ? app.data.tasks.find((t) => t.id === alarm.taskId) : undefined;
  const priorityLabel = task ? (task.priority === 1 ? "Must" : task.priority === 2 ? "Should" : "Could") : "";
  const snoozeLeft = alarm.snoozeCount < MAX_SNOOZES;
  const snoozeMinutes = SNOOZE_MINUTES * (alarm.snoozeCount + 1);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={app.closeAlarm}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.flame,
              {
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
              },
            ]}
          >
            <Ionicons name="flame" size={32} color={colors.ember400} />
          </Animated.View>

          <Text style={styles.kicker}>
            {priorityLabel ? `${priorityLabel} · ` : ""}
            {task?.time ?? fmtTime(todayISO().slice(11, 16)) ?? "Alarm"}
          </Text>
          <Text style={styles.title}>{alarm.title}</Text>
          <Text style={styles.sub}>
            {alarm.body || "The hour is yours. Move."}
          </Text>

          <View style={{ gap: 10, marginTop: 22, width: "100%" }}>
            {task && !task.done ? (
              <Btn label="Mark done" icon="checkmark" onPress={() => void app.resolveAlarmTask(task.id)} />
            ) : (
              <Btn label="Stop" onPress={app.closeAlarm} />
            )}

            {snoozeLeft ? (
              <Btn
                label={`Snooze ${snoozeMinutes} min`}
                variant="soft"
                icon="time-outline"
                onPress={() => void app.snoozeActiveAlarm()}
              />
            ) : (
              <Txt variant="caption" color={colors.fog600} style={{ textAlign: "center" }}>
                No snoozes left — this is it.
              </Txt>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => {
                  const t = task;
                  app.closeAlarm();
                  if (t) app.editTaskSheet(t);
                }}
                style={styles.ghost}
              >
                <Text style={styles.ghostText}>Reschedule</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const title = alarm.title;
                  app.closeAlarm();
                  app.setFocusPreset({ label: title, durationMin: 25 });
                  app.setTab("focus");
                }}
                style={[styles.ghost, { backgroundColor: alpha.hex(colors.ember500, 0.12), borderColor: "transparent" }]}
              >
                <Ionicons name="timer-outline" size={15} color={colors.ember400} />
                <Text style={[styles.ghostText, { color: colors.ember400 }]}>Focus</Text>
              </Pressable>
            </View>

            <Pressable onPress={app.closeAlarm} style={{ alignSelf: "center", padding: 8 }}>
              <Text style={styles.stopText}>Stop ringing</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(6,7,8,0.94)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: colors.ink850,
    padding: 24,
    alignItems: "center",
    ...shadow.card,
  },
  flame: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha.hex(colors.ember500, 0.16),
  },
  kicker: {
    fontFamily: fonts.uiBold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.ember400,
    textTransform: "uppercase",
    marginTop: 16,
  },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.bone50, textAlign: "center", marginTop: 6, lineHeight: 29 },
  sub: { fontFamily: fonts.ui, fontSize: 12.5, color: colors.fog400, marginTop: 8, textAlign: "center", lineHeight: 18 },
  ghost: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  ghostText: { fontFamily: fonts.uiBold, fontSize: 13, color: colors.bone100 },
  stopText: { fontFamily: fonts.uiSemi, fontSize: 12, color: colors.fog500 },
});
