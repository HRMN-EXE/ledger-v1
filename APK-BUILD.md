# Building the Ledger APK

Ledger is a plain Expo (SDK 57) app with one local native module — `modules/ledger-alarm` — that gives it real
Android alarm-clock behaviour. The Android project is **generated**, so nothing under `android/` is committed and
every build starts from `app.json`.

There are three ways to get an installable APK. None of them require touching Kotlin.

---

## 1. GitHub Actions (recommended — no toolchain on your machine)

`.github/workflows/android-apk.yml` builds an installable release APK on GitHub's runners, which already have the
JDK and Android SDK.

**From the Actions tab:** *Android APK → Run workflow → pick the branch → Run*. When it finishes, download
`ledger-apk` from the run's **Artifacts** section.

**From a terminal:**

```bash
gh workflow run android-apk.yml --ref arena/01a0c438-ledger-v1
gh run watch
gh run download --name ledger-apk      # → ./app-release.apk
```

**Tagging a release** (`git tag v1.0.0 && git push origin v1.0.0`) also attaches the APK to the GitHub release, so
users can download it directly.

The workflow runs `tsc --noEmit` first: a type error fails the build before Gradle ever starts.

> Note: the release APK is signed with React Native's **debug keystore** (the stock template behaviour), which makes
> it installable immediately but not publishable to Play Store. For a Play Store build, generate a keystore and add
> the four `MYAPP_UPLOAD_*` properties — see the "Signing for release" section below.

## 2. EAS Build (Expo's cloud, keeps the keystore for you)

`eas.json` ships three profiles, all producing **APKs** (`"buildType": "apk"`):

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android     # internal-testing APK
eas build --profile production --platform android  # release APK with auto-increment
```

`preview` is the one to use for sending the app to a phone: it prints a download URL when it finishes.

## 3. Locally with Gradle

Requires **JDK 17** and the Android SDK (`ANDROID_HOME`, platform 36, build-tools).

```bash
npm install
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

`npm run apk` does the prebuild + assemble in one step once the toolchain exists.

Install on a connected phone: `adb install -r android/app/build/outputs/apk/release/app-release.apk`

---

## What the build must contain

These are the parts that make alarms behave like a system clock. Verify them after any config change:

```bash
# 1. the native module is autolinked
npx expo-modules-autolinking search -p android | grep -A2 ledger-alarm

# 2. permissions survived the manifest merge (in the generated project)
grep -E "EXACT_ALARM|FULL_SCREEN|FOREGROUND_SERVICE|RECEIVE_BOOT|IGNORE_BATTERY" android/app/src/main/AndroidManifest.xml

# 3. the alarm sounds are inside the APK
ls android/app/src/main/res/raw/    # ledger_alarm.wav ledger_chime.wav ledger_nudge.wav

# 4. MainActivity may draw over the lock screen
grep showWhenLocked android/app/src/main/AndroidManifest.xml
```

`npx expo prebuild --platform android` fails loudly if a sound file listed in `plugins/withLedgerAlarm.js` is
missing — a silently missing alarm tone would be worse than a failed build.

---

## Verifying alarms on a real phone

`Settings → Alarms & notifications → Ring a test alarm now` arms an alarm ~1 second out. Then:

1. **Lock the screen** — the ring screen should cover the lock screen with sound and vibration.
2. **Swipe Ledger away** (recents → swipe) — the alarm must still fire. This is the whole point of the native
   module; a JS-only alarm dies here.
3. **Reboot the phone** and don't open the app — the alarm must still fire (BootReceiver re-arms the plan).
4. **Press Done / Snooze / Stop on the notification** with the app closed, then open Ledger — the task is already
   marked done, and the snooze is re-armed 10 minutes out.
5. **Set the phone to silent** — the alarm channel uses the alarm audio stream and DND-granted bypass.
6. **Xiaomi / OPPO / Vivo / realme / Samsung** — grant autostart + "no restrictions" from
   `Settings → Permissions`; without it the ROM can hold background alarms for minutes.

If an alarm is late or silent, in order: Notifications granted → Exact alarms allowed → Battery unrestricted →
Autostart on → Full-screen alarms allowed (Android 14+). `Settings → Permissions` shows the live state of all five
and each row opens the exact system screen.

---

## Signing for release

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore ledger-release.keystore -alias ledger \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then either let EAS manage it (`eas credentials`) or add to `android/gradle.properties` after prebuild:

```
MYAPP_UPLOAD_STORE_FILE=ledger-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=ledger
MYAPP_UPLOAD_STORE_PASSWORD=…
MYAPP_UPLOAD_KEY_PASSWORD=…
```

and point `signingConfigs.release` at those values in `android/app/build.gradle`. `*.keystore` / `*.jks` are
git-ignored — never commit them.

## Offline guarantee

Nothing in this app touches the network at runtime: fonts are bundled through `@expo-google-fonts`, images are
local files, and every read/write goes to SQLite on the device. The `INTERNET` permission that React Native's
manifest adds by default is unused; if you want a build that is verifiably incapable of networking, add

```json
"android": { "blockedPermissions": ["android.permission.INTERNET"] }
```

to `app.json` before the release build (skip it for development builds — the Metro dev server needs that
permission).
