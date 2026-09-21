// ─── Focus: ring timer + snapping minute/second wheels (port of `focus.tsx`) ─
// Native upgrade over the web build: the session-end alert is armed in the OS
// alarm clock, so it lands even if the app is backgrounded or killed.

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ring, SectionLabel, Txt } from "@/ui/kit";
import { fmtClock, fmtMS, todayISO } from "@/lib/dates";
import { cancelFocusEnd, scheduleFocusEnd } from "@/notifications/engine";
import { hapticSuccess, hapticTap } from "@/notifications/sound";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, hairline, radius } from "@/theme/theme";

const ITEM = 38;
const PRESETS: { sec: number; label: string }[] = [
  { sec: 60, label: "1m" },
  { sec: 120, label: "2m" },
  { sec: 300, label: "5m" },
  { sec: 600, label: "10m" },
  { sec: 1500, label: "25m" },
  { sec: 1800, label: "30m" },
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** A looping 0–59 wheel that snaps — the native take on the web's physics reel. */
function Wheel({
  value,
  onChange,
  disabled,
  max = 59,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  max?: number;
}) {
  const ref = useRef<ScrollView | null>(null);
  const [active, setActive] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const target = value * ITEM;
    ref.current?.scrollTo({ y: target, animated: false });
  }, [value]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const v = Math.min(max, Math.max(0, Math.round(y / ITEM)));
    if (v !== value) onChange(v);
    void hapticTap();
  };

  const numbers = useMemo(() => Array.from({ length: max + 1 }, (_, i) => i), [max]);

  return (
    <View style={styles.wheelWrap}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        scrollEnabled={!disabled}
        onScrollBeginDrag={() => {
          setActive(true);
          if (idle.current) clearTimeout(idle.current);
        }}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        contentContainerStyle={{ paddingVertical: (128 - ITEM) / 2 }}
        style={{ height: 128, width: 52 }}
      >
        {numbers.map((n) => (
          <View key={n} style={{ height: ITEM, alignItems: "center", justifyContent: "center" }}>
            <Text
              style={[
                styles.wheelNum,
                n === value
                  ? { color: active ? colors.ember400 : colors.bone50, fontSize: 23 }
                  : { color: active ? colors.fog500 : alpha.hex(colors.fog500, 0.35), fontSize: 20 },
              ]}
            >
              {pad2(n)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function FocusScreen() {
  const app = useApp();
  const today = todayISO();

  const [label, setLabel] = useState("Deep focus");
  const [min, setMin] = useState(0);
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const finishedRef = useRef(false);
  const labelRef = useRef(label);
  const totalRef = useRef(0);
  labelRef.current = label;

  const totalSec = min * 60 + sec;
  totalRef.current = totalSec;

  // Preset handed over from an alarm's "Focus" action.
  useEffect(() => {
    const preset = app.focusPreset;
    if (preset) {
      app.consumeFocusPreset();
      const m = Math.min(59, preset.durationMin);
      setLabel(preset.label);
      setMin(m);
      setSec(0);
      setSecondsLeft(m * 60);
      setRunning(false);
      setEndsAt(null);
      finishedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.focusPreset]);

  useEffect(() => {
    if (!running && endsAt == null) setSecondsLeft(totalSec);
  }, [totalSec, running, endsAt]);

  useEffect(() => {
    if (!running || endsAt == null) return;
    const iv = setInterval(() => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        setRunning(false);
        setEndsAt(null);
        void hapticSuccess();
        void app.addSession(labelRef.current.trim() || "Focus", Math.max(1, Math.round(totalRef.current / 60)));
      }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, endsAt]);

  const clearArmed = async () => {
    if (armedKey) {
      await cancelFocusEnd(armedKey);
      setArmedKey(null);
    }
  };

  const start = async () => {
    finishedRef.current = false;
    const base = secondsLeft > 0 ? secondsLeft : totalSec;
    if (base <= 0) return;
    setEndsAt(Date.now() + base * 1000);
    setSecondsLeft(base);
    setRunning(true);
    void hapticTap();
    if (!armedKey) {
      const key = await scheduleFocusEnd(base / 60, label.trim() || "Focus");
      setArmedKey(key);
    }
  };

  const pause = async () => {
    setRunning(false);
    setEndsAt(null);
    await clearArmed();
  };

  const reset = async () => {
    setRunning(false);
    setEndsAt(null);
    finishedRef.current = false;
    setSecondsLeft(totalSec);
    await clearArmed();
  };

  const nudge = (dir: 1 | -1) => {
    const next = Math.min(59 * 60 + 59, Math.max(0, totalSec + dir * 60));
    setMin(Math.floor(next / 60));
    setSec(next % 60);
  };

  const applyPreset = (s: number) => {
    setMin(Math.floor(s / 60));
    setSec(s % 60);
    if (!running) {
      setEndsAt(null);
      setSecondsLeft(s);
    }
  };

  const progress = totalSec > 0 ? 1 - secondsLeft / Math.max(totalSec, secondsLeft, 1) : 0;
  const sessionsToday = app.data.sessions.filter((s) => s.startedAt.startsWith(today));
  const minutesToday = sessionsToday.reduce((acc, s) => acc + s.durationMin, 0);
  const paused = !running && endsAt == null && secondsLeft > 0 && secondsLeft !== totalSec;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, paddingTop: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Txt variant="micro" color={colors.fog500}>
        Focus
      </Txt>
      <Text style={styles.h1}>Own the hour</Text>

      <View style={{ alignItems: "center", marginTop: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => nudge(-1)}
            disabled={running || totalSec === 0}
            style={[styles.stepper, running || totalSec === 0 ? { opacity: 0.3 } : null]}
          >
            <Ionicons name="remove" size={20} color={colors.fog400} />
          </Pressable>

          <Ring value={running || paused ? progress : 0} size={216} stroke={8}>
            {running || paused ? (
              <View style={{ alignItems: "center" }}>
                <Text style={styles.countdown}>{fmtMS(secondsLeft)}</Text>
                <Text style={styles.countdownLabel}>{running ? "in session" : "paused"}</Text>
                {armedKey ? (
                  <View style={styles.armedChip}>
                    <Ionicons name="alarm-outline" size={9} color={colors.mint400} />
                    <Text style={styles.armedText}>alarm armed</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Wheel value={min} onChange={setMin} disabled={running} />
                <Text style={styles.colon}>:</Text>
                <Wheel value={sec} onChange={setSec} disabled={running} />
              </View>
            )}
          </Ring>

          <Pressable onPress={() => nudge(1)} disabled={running} style={[styles.stepper, running ? { opacity: 0.3 } : null]}>
            <Ionicons name="add" size={20} color={colors.fog400} />
          </Pressable>
        </View>

        <Text style={styles.hintUnderRing}>
          {running ? "reels locked while burning" : "flick the reels · they roll forever"}
        </Text>

        <View style={styles.presetRow}>
          {PRESETS.map((p) => {
            const active = totalSec === p.sec;
            return (
              <Pressable
                key={p.sec}
                onPress={() => applyPreset(p.sec)}
                style={[
                  styles.preset,
                  active
                    ? { borderColor: alpha.hex(colors.ember500, 0.5), backgroundColor: alpha.hex(colors.ember500, 0.15) }
                    : null,
                ]}
              >
                <Text style={[styles.presetText, active ? { color: colors.ember400 } : null]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="What are you focusing on?"
          placeholderTextColor={colors.fog600}
          style={styles.labelInput}
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 }}>
          <Pressable onPress={() => void reset()} style={styles.roundBtn}>
            <Ionicons name="refresh" size={18} color={colors.fog400} />
          </Pressable>
          <Pressable
            onPress={() => (running ? void pause() : void start())}
            disabled={!running && totalSec === 0}
            style={[styles.playBtn, !running && totalSec === 0 ? { opacity: 0.4 } : null]}
          >
            <Ionicons name={running ? "pause" : "play"} size={24} color={colors.ink950} />
          </Pressable>
          <View style={styles.minuteTile}>
            <Text style={styles.minuteTileText}>{minutesToday}</Text>
            <Text style={styles.minuteTileLabel}>min</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 30 }}>
        <SectionLabel right={<Text style={styles.metaText}>{minutesToday} min today</Text>}>Logged sessions</SectionLabel>
        {sessionsToday.length === 0 ? (
          <Text style={styles.emptyLine}>No sessions yet today. The clock is patient.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {sessionsToday.map((s) => (
              <View key={s.id} style={styles.sessionRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.sessionLabel}>
                    {s.label}
                  </Text>
                  <Text style={styles.sessionMeta}>started {fmtClock(s.startedAt)}</Text>
                </View>
                <View style={styles.sessionBadge}>
                  <Text style={styles.sessionBadgeText}>{s.durationMin} min</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 24, color: colors.bone50, marginTop: 4 },
  stepper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink750,
  },
  countdown: { fontFamily: fonts.display, fontSize: 44, color: colors.bone50 },
  countdownLabel: { fontFamily: fonts.uiBold, fontSize: 9, letterSpacing: 1.8, color: colors.fog500, textTransform: "uppercase", marginTop: 2 },
  armedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: alpha.hex(colors.mint500, 0.12),
  },
  armedText: { fontFamily: fonts.uiBold, fontSize: 8.5, letterSpacing: 0.8, color: colors.mint400, textTransform: "uppercase" },
  wheelWrap: { overflow: "hidden", borderRadius: radius.md },
  wheelNum: { fontFamily: fonts.display, fontVariant: ["tabular-nums"] },
  colon: { fontFamily: fonts.display, fontSize: 22, color: colors.fog600, marginHorizontal: 2 },
  hintUnderRing: {
    fontFamily: fonts.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: colors.fog600,
    textTransform: "uppercase",
    marginTop: 10,
  },
  presetRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 16 },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: colors.ink750,
  },
  presetText: { fontFamily: fonts.displaySemi, fontSize: 10.5, color: colors.fog400 },
  labelInput: {
    width: "100%",
    marginTop: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.ink750,
    paddingVertical: 13,
    paddingHorizontal: 16,
    textAlign: "center",
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: colors.bone50,
  },
  roundBtn: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink750 },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ember500,
    shadowColor: colors.ember500,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  minuteTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha.hex(colors.ink750, 0.6),
  },
  minuteTileText: { fontFamily: fonts.display, fontSize: 13, color: colors.fog400 },
  minuteTileLabel: { fontFamily: fonts.uiBold, fontSize: 8, color: colors.fog500, textTransform: "uppercase" },
  metaText: { fontFamily: fonts.uiBold, fontSize: 10.5, color: colors.fog500 },
  emptyLine: {
    fontFamily: fonts.uiSemi,
    fontSize: 12,
    color: colors.fog500,
    textAlign: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: alpha.hex(colors.ink800, 0.4),
    paddingVertical: 16,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: colors.ink800,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sessionLabel: { fontFamily: fonts.uiBold, fontSize: 13.5, color: colors.bone100 },
  sessionMeta: { fontFamily: fonts.uiSemi, fontSize: 10.5, color: colors.fog500, marginTop: 2 },
  sessionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: alpha.hex(colors.ember500, 0.12) },
  sessionBadgeText: { fontFamily: fonts.uiBold, fontSize: 11, color: colors.ember400 },
});
