// ─── Ringing: sound + vibration + keep-awake ────────────────────────────────
// The OS plays the notification sound; when Ledger is actually open it takes
// over with a looping alarm tone and a vibration pattern, the way a clock app
// behaves, and holds the screen awake until the user deals with it.

import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Platform, Vibration } from "react-native";

import { nativeAlarmsAvailable } from "@/lib/ledger-alarm";

export const ALARM_SOUND = require("../../assets/sounds/ledger_alarm.wav");
export const CHIME_SOUND = require("../../assets/sounds/ledger_chime.wav");
export const NUDGE_SOUND = require("../../assets/sounds/ledger_nudge.wav");

const KEEP_AWAKE_TAG = "ledger-alarm";

let player: AudioPlayer | null = null;
let ringing = false;
let vibeTimer: ReturnType<typeof setInterval> | null = null;

async function configureAudio(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
      allowsRecording: false,
      shouldPlayInBackground: true,
    });
  } catch {
    // older devices may reject parts of this — ringing still works
  }
}

function startVibration(): void {
  stopVibrationTimer();
  try {
    if (Platform.OS === "android") {
      Vibration.vibrate([0, 600, 300, 600, 300, 600], true);
    } else {
      Vibration.vibrate();
      vibeTimer = setInterval(() => {
        try {
          Vibration.vibrate();
        } catch {
          // ignore
        }
      }, 1400);
    }
  } catch {
    // device without a vibrator
  }
}

function stopVibrationTimer(): void {
  if (vibeTimer != null) {
    clearInterval(vibeTimer);
    vibeTimer = null;
  }
}

export function stopVibration(): void {
  stopVibrationTimer();
  try {
    Vibration.cancel();
  } catch {
    // ignore
  }
}

/**
 * Start the full alarm experience. Safe to call repeatedly.
 *
 * On a native build the RingService already owns the sound and the vibration —
 * layering the JS player on top would double the ring, so here we only keep
 * the screen awake and let the native service do the shouting.
 */
export async function startRinging(): Promise<void> {
  if (ringing) return;
  ringing = true;

  if (!nativeAlarmsAvailable) {
    await configureAudio();
    try {
      if (!player) player = createAudioPlayer(ALARM_SOUND, { updateInterval: 1000 });
      player.loop = true;
      player.volume = 1;
      player.play();
    } catch {
      // the notification's own sound has already played regardless
    }
    startVibration();
  }

  try {
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
  } catch {
    // ignore
  }
}

export function stopRinging(options: { stopSound?: boolean } = {}): void {
  ringing = false;
  if (options.stopSound !== false) {
    try {
      player?.pause();
      player?.seekTo(0);
    } catch {
      // ignore
    }
    stopVibration();
  }
  void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
}

export function isRinging(): boolean {
  return ringing;
}

/** One-shot preview used by Settings → Sound. */
export async function playPreview(which: "alarm" | "chime" | "nudge" = "alarm"): Promise<void> {
  try {
    await configureAudio();
    const src = which === "alarm" ? ALARM_SOUND : which === "chime" ? CHIME_SOUND : NUDGE_SOUND;
    const preview = createAudioPlayer(src);
    preview.volume = 1;
    preview.play();
    setTimeout(() => {
      try {
        preview.remove();
      } catch {
        // ignore
      }
    }, 6000);
  } catch {
    // ignore
  }
}

export async function hapticTap(): Promise<void> {
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // ignore
  }
}

export async function hapticSuccess(): Promise<void> {
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // ignore
  }
}
