// ─── First run: name + the permission asks (port of the app-shell gate) ─────
// Two steps, both skippable except the name. The permission step exists
// because alarms are worthless without it — but we explain, never nag.

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Chip, SettingRow, Txt } from "@/ui/kit";
import {
  requestBatteryExemption,
  requestExactAlarmPermission,
  requestNotificationPermission,
} from "@/notifications/permissions";
import { useApp } from "@/store/app-context";
import { alpha, colors, fonts, hairline, radius } from "@/theme/theme";

export function OnboardingScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState("");
  const [notif, setNotif] = useState<string | null>(null);
  const [exact, setExact] = useState<string | null>(null);
  const [battery, setBattery] = useState<string | null>(null);

  const ask = async (set: (v: string) => void, fn: () => Promise<unknown>) => {
    set("asking…");
    const res = await fn();
    set(typeof res === "string" ? res : res ? "granted" : "not granted");
  };

  const finish = () => {
    void app.setProfileName(name.trim() || "Friend");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.mark}>
          <Ionicons name="flame" size={40} color={colors.ember500} />
        </View>

        {step === 0 ? (
          <>
            <Text style={styles.title}>Welcome to Ledger</Text>
            <Text style={styles.sub}>Your day, your rituals, your streak — planned like it matters.</Text>

            <View style={{ height: 28 }} />
            <Text style={styles.label}>What should we call you?</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.fog600}
              style={styles.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => setStep(1)}
            />

            <View style={{ height: 22 }} />
            <Btn label="Continue" icon="arrow-forward" onPress={() => setStep(1)} disabled={!name.trim()} />

            <View style={styles.privacy}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.fog500} />
              <Text style={styles.privacyText}>
                Private by design — everything lives in this device&apos;s storage. No accounts. No cloud. No tracking.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Wake me on time</Text>
            <Text style={styles.sub}>
              An alarm is only as good as Android allows it to be. Three switches make Ledger ring like your phone&apos;s
              own clock — with the app closed and the screen locked.
            </Text>

            <View style={styles.permCard}>
              <SettingRow
                title="Notifications"
                sub="Required — without it nothing can fire"
                right={<Chip label={notif ?? "allow"} color={notif === "granted" ? colors.mint400 : colors.ember400} onPress={() => void ask(setNotif, requestNotificationPermission)} />}
              />
              <View style={styles.hr} />
              <SettingRow
                title="Exact alarms"
                sub="Android 12+ precision scheduling"
                right={<Chip label={exact ?? "grant"} color={exact === "granted" ? colors.mint400 : colors.ember400} onPress={() => void ask(setExact, requestExactAlarmPermission)} />}
              />
              <View style={styles.hr} />
              <SettingRow
                title="Battery: unrestricted"
                sub="The fix for alarms that arrive late"
                right={<Chip label={battery ?? "allow"} color={battery === "granted" ? colors.mint400 : colors.ember400} onPress={() => void ask(setBattery, requestBatteryExemption)} />}
              />
            </View>

            <View style={{ height: 22 }} />
            <Btn label="Start planning" icon="checkmark" onPress={finish} />

            <Pressable onPress={finish} style={styles.later}>
              <Text style={styles.laterText}>I&apos;ll grant these later</Text>
            </Pressable>

            <Txt variant="caption" color={colors.fog600} style={{ textAlign: "center", marginTop: 14 }}>
              You can re-open all three from Settings → Permissions at any time.
            </Txt>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink950, paddingHorizontal: 26 },
  scroll: { flexGrow: 1, justifyContent: "center" },
  mark: {
    width: 78,
    height: 78,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: alpha.hex(colors.ember500, 0.12),
    borderWidth: 1,
    borderColor: alpha.hex(colors.ember500, 0.28),
    marginBottom: 22,
  },
  title: { fontFamily: fonts.display, fontSize: 27, color: colors.bone50, textAlign: "center" },
  sub: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 20, color: colors.fog400, textAlign: "center", marginTop: 10 },
  label: { fontFamily: fonts.uiBold, fontSize: 10.5, letterSpacing: 1.4, color: colors.fog500, textTransform: "uppercase", marginBottom: 8 },
  input: {
    borderRadius: radius.lg,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: hairline,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: fonts.uiSemi,
    fontSize: 16,
    color: colors.bone50,
  },
  privacy: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 22, paddingHorizontal: 4 },
  privacyText: { flex: 1, fontFamily: fonts.ui, fontSize: 11, lineHeight: 16, color: colors.fog500 },
  permCard: { marginTop: 22, borderRadius: radius.lg, borderWidth: 1, borderColor: hairline, backgroundColor: colors.ink800, paddingHorizontal: 14 },
  hr: { height: 1, backgroundColor: hairline },
  later: { alignSelf: "center", paddingVertical: 14 },
  laterText: { fontFamily: fonts.uiSemi, fontSize: 12, color: colors.fog500 },
});
