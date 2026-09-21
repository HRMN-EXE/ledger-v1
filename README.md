# Ledger

An offline day planner, ritual keeper and streak engine for Android — with an alarm clock that behaves like the
system one.

**Zero network at runtime.** No accounts, no sync, no analytics, no remote fonts or images. Every task, streak and
setting lives in SQLite on the phone, and alarms are owned by Android's `AlarmManager`. Airplane mode changes
nothing.

---

## What makes the alarms real

`expo-notifications` alone cannot wake a locked phone with a full-screen alarm; Android only does that for
`setAlarmClock` + a foreground service + a full-screen intent. So Ledger ships a small local native module,
[`modules/ledger-alarm`](modules/ledger-alarm), that does exactly what a clock app does:

| Behaviour | How |
| --- | --- |
| Fires at the exact minute | `AlarmManager.setAlarmClock()` with `AlarmClockInfo` (doze-proof, shows the system alarm icon) |
| Rings with the app closed | `RingService` — a foreground `mediaPlayback` service looping the alarm tone on the **ALARM** stream, plus a long vibration pattern |
| Appears over the lock screen | `RingActivity` with `showWhenLocked` / `turnScreenOn`, launched by a full-screen intent |
| Survives a reboot | `BootReceiver` re-arms the whole plan from disk — no app launch needed |
| Buttons work while closed | Done / Snooze / Stop on the notification are handled natively; the decision is queued and applied by JS the next time Ledger runs |
| Doesn't get delayed by the ROM | Battery-exemption, autostart and DND helpers in Settings → Permissions, with OEM-specific guidance |

Alarms you set in the app are *also* re-planned by a background worker (`expo-background-task`, ~30 min) so a day
rollover or an edited schedule is reflected without opening the app.

If the native module is missing (Expo Go, web, a dev client that predates it), the same engine transparently falls
back to `expo-notifications` scheduling — degraded, never broken.

---

## Features

- **Today** — the day's tasks with times, priorities and tags; carry-over from yesterday; streak banner; missed-alarm
  recovery.
- **Plan** — week view, per-day sheets, calendar picker, drag-free scheduling, tag filters.
- **Focus** — a wheel-timer with presets, session log, and an alarm armed for the end of the session.
- **Rituals** — habits with cadences (daily, weekdays, picked days, every-N, monthly, flexible), tenures in
  days/weeks/months/years, vacation behaviour, and a full commitment history.
- **Ledger** — streak, shields, perfect-run progress, 7-day completion chart, per-status record list.
- **Streak rules** — cutoff time, quiet hours, vacation freezing, task reminders, morning brief, evening check-in,
  final warning; each one is a real notification that obeys your quiet hours.
- **Backup** — export/import the whole database as a plain JSON file you choose where to keep.

## Project layout

```
App.tsx                      font loading + boot watchdog + onboarding gate
src/notifications/           alarm engine: plan → native module, prefs, permissions, sounds
src/lib/ledger-alarm.ts      typed JS wrapper around the native module (no-ops when absent)
modules/ledger-alarm/        Kotlin: scheduler, receivers, RingService, RingActivity, module
plugins/withLedgerAlarm.js   permissions + lock-screen MainActivity + notification sounds
src/ui/                      kit, screens (today/plan/focus/rituals/ledger), sheets, onboarding
src/store/app-context.tsx    the app's single store (tasks, habits, rituals, streak, alarms)
```

## Run it

```bash
npm install
npx expo start          # Expo Go works for everything except the native alarm behaviour
npx expo run:android    # a real dev build — required to test alarms
```

`npx expo run:android` (or any of the builds in [APK-BUILD.md](APK-BUILD.md)) is needed for exact alarms,
lock-screen take-over and the ringing service. Expo Go can only show the in-app reminders.

## Build an APK

See **[APK-BUILD.md](APK-BUILD.md)**. Shortest path: run the *Android APK* workflow in the Actions tab and download
the artifact — no local toolchain needed.
