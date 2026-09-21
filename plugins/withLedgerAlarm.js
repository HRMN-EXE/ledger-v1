/**
 * withLedgerAlarm — makes Ledger's alarms behave like the phone's own clock.
 *
 * The native module in `modules/ledger-alarm` carries the behavior; this
 * plugin makes sure the *manifest* is right, and that expo-notifications ships
 * our custom sounds (a notification channel cannot play a sound file that the
 * config plugin was never told about).
 *
 * What it does:
 *  1. Declares the alarm-clock permissions (exact scheduling, wake lock,
 *     vibration, foreground service, boot persistence, battery exemption).
 *  2. Lets MainActivity show over the lock screen and survive singleTop
 *     launches, so a full-screen alarm lands on the app you already have open.
 *  3. Registers `assets/sounds/*.wav` with expo-notifications.
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

/** 1 + 2: manifest. */
const withAlarmManifest = (config) =>
  withAndroidManifest(config, (config) => {
    config.modResults = AndroidConfig.Permissions.withPermissions(config.modResults, PERMISSIONS);

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    // The activity a full-screen intent lands on should be the app itself —
    // resumed if it is already open, and allowed to draw over the lock screen.
    const activities = application.activity ?? [];
    const main = activities.find(
      (activity) => activity.$?.["android:name"] === ".MainActivity"
    );
    if (main) {
      main.$["android:showWhenLocked"] = "true";
      main.$["android:turnScreenOn"] = "true";
      main.$["android:excludeFromRecents"] = "false";
      main.$["android:launchMode"] = main.$["android:launchMode"] ?? "singleTask";
    }

    return config;
  });

/** 3: hand the sound files to the expo-notifications plugin. */
const withAlarmSounds = (config) =>
  withDangerousMod(config, [
    "android",
    (config) => {
      const soundsDir = path.join(config.modRequest.projectRoot, "assets", "sounds");
      const missing = SOUND_FILES.filter((file) => !fs.existsSync(path.join(soundsDir, file)));
      if (missing.length > 0) {
        // Loud on purpose: a missing sound means a silently-broken alarm.
        throw new Error(
          `withLedgerAlarm: missing sound file(s) in assets/sounds → ${missing.join(", ")}`
        );
      }
      return config;
    },
  ]);

const withLedgerAlarm = (config, props = {}) => {
  config = withAlarmManifest(config);

  // Merge our sounds into the expo-notifications plugin props rather than
  // duplicating the plugin entry (duplicates would run the plugin twice).
  const plugins = config.plugins ?? [];
  let found = false;
  const nextPlugins = plugins.map((entry) => {
    const name = Array.isArray(entry) ? entry[0] : entry;
    if (name !== "expo-notifications") return entry;
    found = true;
    const existing = Array.isArray(entry) ? entry[1] ?? {} : {};
    const sounds = new Set([...(existing.sounds ?? []), ...(props.sounds ?? SOUND_FILES)]);
    return ["expo-notifications", { ...existing, sounds: [...sounds] }];
  });

  if (!found) {
    nextPlugins.push(["expo-notifications", { sounds: props.sounds ?? SOUND_FILES }]);
  }

  config.plugins = nextPlugins;
  return withAlarmSounds(config);
};

module.exports = createRunOncePlugin(withLedgerAlarm, pkg.name, pkg.version);
module.exports.default = module.exports;
