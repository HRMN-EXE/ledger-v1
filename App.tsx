// ─── Ledger — 100% offline day planner, streak keeper, alarm clock ──────────
// No network is ever touched: fonts ship in the bundle, data lives in SQLite,
// alarms are handed to Android's AlarmManager.

import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from "@expo-google-fonts/manrope";
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Shell } from "@/ui/shell";
import { OnboardingScreen } from "@/ui/onboarding";
import { AppProvider, useApp } from "@/store/app-context";
import { alpha, colors, fonts } from "@/theme/theme";

void SplashScreen.preventAutoHideAsync().catch(() => {
  // splash already hidden — harmless
});

export default function App() {
  const [loaded, error] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // A font failure must never become a blank screen — fall back to system type.
  const fontsReady = loaded || !!error;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppProvider>
        <Gate fontsReady={fontsReady} />
      </AppProvider>
    </SafeAreaProvider>
  );
}

function Gate({ fontsReady }: { fontsReady: boolean }) {
  const app = useApp();
  const [timedOut, setTimedOut] = useState(false);

  // Boot watchdog: if storage hydration stalls, show the app anyway rather
  // than sitting on a spinner forever.
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const booted = fontsReady && (app.ready || timedOut);

  useEffect(() => {
    if (booted) void SplashScreen.hideAsync().catch(() => {});
  }, [booted]);

  if (!booted) return <BootScreen />;
  if (!app.profileName) return <OnboardingScreen />;
  return <Shell />;
}

function BootScreen() {
  return (
    <View style={styles.boot}>
      <View style={styles.bootMark}>
        <Ionicons name="flame" size={34} color={colors.ember500} />
      </View>
      <Text style={styles.wordmark}>LEDGER</Text>
      <Text style={styles.tagline}>own the hour</Text>
      <ActivityIndicator color={colors.fog600} style={{ marginTop: 26 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink950 },
  bootMark: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha.hex(colors.ember500, 0.12),
    borderWidth: 1,
    borderColor: alpha.hex(colors.ember500, 0.26),
  },
  // Deliberately system-font: this screen can render before the bundle loads.
  wordmark: { marginTop: 18, fontSize: 22, letterSpacing: 6, color: colors.bone50, fontWeight: "700" },
  tagline: { marginTop: 6, fontSize: 11, letterSpacing: 2, color: colors.fog600, textTransform: "uppercase" },
});
