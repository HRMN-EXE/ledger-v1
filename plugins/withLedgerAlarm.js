/**
 * withLedgerAlarm — makes Ledger's alarms behave like the phone's own clock.
 *
 * The behaviour lives in `modules/ledger-alarm`; this plugin makes sure the
 * generated Android project is set up for it:
 *
 *  1. Declares the alarm-clock permissions (exact scheduling, wake lock,
 *     vibration, foreground service, boot persistence, battery exemption).
 *  2. Lets MainActivity show over the lock screen and survive singleTop
 *     launches, so a full-screen alarm lands on the app you already have open.
 *  3. Fails the build if the alarm sounds are missing from `assets/sounds`.
 *     (The sounds themselves are registered with expo-notifications through
 *     the `sounds` option in app.json — a channel cannot play a sound file the
 *     notifications plugin was never told about.)
 */
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");

const PERMISSIONS = [
  // Exact, doze-proof scheduling. USE_EXACT_ALARM is the alarm-clock
  // declaration (granted at install); SCHEDULE_EXACT_ALARM covers upgrades.
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.USE_EXACT_ALARM",
  // Ringing like an alarm: full-screen take-over, screen wake, vibration.
  "android.permission.USE_FULL_SCREEN_INTENT",
  "android.permission.WAKE_LOCK",
  "android.permission.VIBRATE",
  "android.permission.DISABLE_KEYGUARD",
  // Ringing while the app is closed.
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  // Re-arm after a reboot; tell the user about it.
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.POST_NOTIFICATIONS",
  // The fix for "my alarm came seven minutes late".
  "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
];

const SOUND_FILES = ["ledger_alarm.wav", "ledger_chime.wav", "ledger_nudge.wav"];

/** Manifest: permissions + a MainActivity that can take over the lock screen. */
const withAlarmManifest = (config) =>
  withAndroidManifest(config, (config) => {
    // NOTE: `AndroidConfig.Permissions.withPermissions` takes a *config*, not a
    // manifest — assigning its result to `modResults` writes the whole mod tree
    // into AndroidManifest.xml. `ensurePermissions` mutates the manifest, which
    // is what we want here.
    AndroidConfig.Permissions.ensurePermissions(config.modResults, PERMISSIONS);

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    // The activity a full-screen intent lands on should be the app itself.
    const activities = application.activity ?? [];
    const main = activities.find((activity) => activity.$?.["android:name"] === ".MainActivity");
    if (main) {
      main.$["android:showWhenLocked"] = "true";
      main.$["android:turnScreenOn"] = "true";
      main.$["android:excludeFromRecents"] = "false";
      main.$["android:launchMode"] = main.$["android:launchMode"] ?? "singleTask";
    }

    return config;
  });

/**
 * A silently missing alarm tone is a broken alarm, so this is a hard failure:
 * the build stops with the file names you need to restore.
 */
const withSoundCheck = (config) =>
  withDangerousMod(config, [
    "android",
    (config) => {
      const soundsDir = path.join(config.modRequest.projectRoot, "assets", "sounds");
      const missing = SOUND_FILES.filter((file) => !fs.existsSync(path.join(soundsDir, file)));
      if (missing.length > 0) {
        throw new Error(
          `withLedgerAlarm: missing alarm sound(s) in assets/sounds → ${missing.join(", ")}`
        );
      }
      return config;
    },
  ]);

const withLedgerAlarm = (config) => {
  const plugins = config.plugins ?? [];
  const hasNotifications = plugins.some(
    (entry) => (Array.isArray(entry) ? entry[0] : entry) === "expo-notifications"
  );
  if (!hasNotifications) {
    throw new Error(
      "withLedgerAlarm: expo-notifications must stay in app.json's plugin list (with its `sounds` array) — Ledger's fallback path and custom alarm tones depend on it."
    );
  }

  config = withAlarmManifest(config);
  return withSoundCheck(config);
};

module.exports = createRunOncePlugin(withLedgerAlarm, pkg.name, pkg.version);
module.exports.default = module.exports;
