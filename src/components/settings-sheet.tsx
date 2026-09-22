"use client";

import { useState } from "react";
import { useApp } from "@/components/app-context";
import { BellIcon, DownloadIcon, FlameIcon, GearIcon, ShieldIcon, SparkIcon, TimerIcon, TrashIcon } from "@/components/icons";
import { FieldLabel, Seg, Sheet, Toggle } from "@/components/ui";
import { requestNotificationPermission } from "@/lib/alarm";
import { DB_KEY } from "@/lib/localdb";
import type { DefaultTab, UiPrefs } from "@/lib/ui-prefs";
import { TOUR_STEPS } from "@/components/tour";

export function SettingsSheet({
  open,
  onClose,
  prefs,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  prefs: UiPrefs;
  onChange: (patch: Partial<UiPrefs>) => void;
}) {
  const app = useApp();
  const [perm, setPerm] = useState<string>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  const exportBackup = () => {
    try {
      const raw = window.localStorage.getItem(DB_KEY) ?? "{}";
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      app.toast("Backup downloaded");
    } catch {
      app.toast("Couldn't export the backup");
    }
  };

  const wipeAll = () => {
    if (!window.confirm("Wipe everything? Tasks, rituals, streak — all of it. This can't be undone.")) return;
    try {
      window.localStorage.removeItem(DB_KEY);
      window.localStorage.removeItem("kairos-alarm-state-v1");
      window.localStorage.removeItem("kairos-notif-log-v1");
      window.localStorage.removeItem("kairos-opened-on-v1");
      window.localStorage.removeItem("ledger-seed-v1");
      window.location.reload();
    } catch {
      app.toast("Couldn't wipe the data");
    }
  };

  return (
    <Sheet open={open} title="Settings" onClose={onClose}>
      <div className="space-y-5">
        {/* appearance */}
        <div>
          <FieldLabel>Appearance</FieldLabel>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl bg-ink-800 px-3.5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-750 text-bone-100">
                <GearIcon size={16} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <Seg
                  value={prefs.theme}
                  onChange={(t) => onChange({ theme: t })}
                  options={[
                    { value: "dark" as const, label: "Ember dark" },
                    { value: "light" as const, label: "Bone light" },
                  ]}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800 px-3.5 py-3">
              <div>
                <p className="text-[12.5px] font-bold text-bone-100">Reduce motion</p>
                <p className="text-[10.5px] font-medium text-fog-500">Calms shimmers, breathing and pops.</p>
              </div>
              <Toggle on={prefs.motion === "reduced"} onChange={(v) => onChange({ motion: v ? "reduced" : "full" })} />
            </div>
          </div>
        </div>

        {/* feel */}
        <div className="space-y-2">
          <FieldLabel>Feel</FieldLabel>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800 px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-ember-400">
                <BellIcon size={15} strokeWidth={2} />
              </span>
              <div>
                <p className="text-[12.5px] font-bold text-bone-100">Alarm sound</p>
                <p className="text-[10.5px] font-medium text-fog-500">Two-tone chime when a timed task fires.</p>
              </div>
            </div>
            <Toggle on={prefs.sound} onChange={(v) => onChange({ sound: v })} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800 px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-lilac-400">
                <FlameIcon size={15} strokeWidth={2} />
              </span>
              <div>
                <p className="text-[12.5px] font-bold text-bone-100">Haptics</p>
                <p className="text-[10.5px] font-medium text-fog-500">Vibration on alarms & reminders.</p>
              </div>
            </div>
            <Toggle on={prefs.haptics} onChange={(v) => onChange({ haptics: v })} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800 px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-bone-300">
                <BellIcon size={15} strokeWidth={2} />
              </span>
              <div>
                <p className="text-[12.5px] font-bold text-bone-100">System notifications</p>
                <p className="text-[10.5px] font-medium capitalize text-fog-500">status: {perm}</p>
              </div>
            </div>
            {perm === "granted" || perm === "unsupported" ? (
              <span className="text-[10.5px] font-bold text-mint-400">{perm === "granted" ? "on" : "n/a"}</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  requestNotificationPermission();
                  window.setTimeout(() => {
                    if (typeof Notification !== "undefined") setPerm(Notification.permission);
                  }, 400);
                }}
                className="press rounded-full bg-ember-500/15 px-3 py-1.5 text-[10.5px] font-bold text-ember-400"
              >
                Allow
              </button>
            )}
          </div>
        </div>

        {/* behavior */}
        <div className="space-y-2">
          <FieldLabel>Behavior</FieldLabel>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800 px-3.5 py-3">
            <div>
              <p className="text-[12.5px] font-bold text-bone-100">Ask before closing a task</p>
              <p className="text-[10.5px] font-medium text-fog-500">Finished or focus — you choose each time.</p>
            </div>
            <Toggle on={prefs.confirmDone} onChange={(v) => onChange({ confirmDone: v })} />
          </div>
          <div className="rounded-xl bg-ink-800 px-3.5 py-3">
            <p className="mb-2 text-[12.5px] font-bold text-bone-100">Open on</p>
            <Seg
              value={prefs.defaultTab}
              onChange={(t: DefaultTab) => onChange({ defaultTab: t })}
              options={[
                { value: "today" as DefaultTab, label: "Today" },
                { value: "plan" as DefaultTab, label: "Plan" },
                { value: "focus" as DefaultTab, label: "Focus" },
                { value: "habits" as DefaultTab, label: "Rituals" },
                { value: "stats" as DefaultTab, label: "Ledger" },
              ]}
            />
          </div>
          <div className="rounded-xl bg-ink-800 px-3.5 py-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-gold-400">
                <TimerIcon size={14} strokeWidth={2} />
              </span>
              <p className="text-[12.5px] font-bold text-bone-100">Default focus length</p>
            </div>
            <Seg
              value={prefs.defaultFocusMin}
              onChange={(m) => onChange({ defaultFocusMin: m })}
              options={[
                { value: 25, label: "25m" },
                { value: 50, label: "50m" },
                { value: 90, label: "90m" },
              ]}
            />
          </div>
        </div>

        {/* streak rules */}
        <div>
          <FieldLabel>Streak rules</FieldLabel>
          <button
            type="button"
            onClick={() => {
              onClose();
              app.openStreakSheet();
            }}
            className="press flex w-full items-center gap-2.5 rounded-xl bg-ink-800 px-3.5 py-3 text-left"
          >
            <span className="text-gold-400">
              <ShieldIcon size={15} strokeWidth={2} />
            </span>
            <span className="flex-1 text-[12.5px] font-bold text-bone-100">Cutoff, quiet hours, warnings & vacation</span>
            <span className="text-[11px] font-bold text-fog-500">open →</span>
          </button>
        </div>

        {/* help */}
        <div>
          <FieldLabel>Help</FieldLabel>
          <button
            type="button"
            onClick={app.replayTour}
            className="press flex w-full items-center gap-2.5 rounded-xl bg-ink-800 px-3.5 py-3 text-left"
          >
            <span className="text-sky-400">
              <SparkIcon size={15} strokeWidth={2} />
            </span>
            <span className="flex-1 text-[12.5px] font-bold text-bone-100">Replay the quick tour</span>
            <span className="text-[11px] font-bold text-fog-500">{TOUR_STEPS} taps →</span>
          </button>
        </div>

        {/* data */}
        <div>
          <FieldLabel>Your data</FieldLabel>
          <div className="space-y-2">
            <button
              type="button"
              onClick={exportBackup}
              className="press flex w-full items-center gap-2.5 rounded-xl bg-ink-800 px-3.5 py-3 text-left"
            >
              <span className="text-mint-400">
                <DownloadIcon size={15} strokeWidth={2} />
              </span>
              <span className="flex-1 text-[12.5px] font-bold text-bone-100">Export backup</span>
              <span className="text-[11px] font-bold text-fog-500">.json</span>
            </button>
            <button
              type="button"
              onClick={wipeAll}
              className="press flex w-full items-center gap-2.5 rounded-xl border border-coral-400/25 bg-coral-400/10 px-3.5 py-3 text-left"
            >
              <span className="text-coral-400">
                <TrashIcon size={15} strokeWidth={2} />
              </span>
              <span className="flex-1 text-[12.5px] font-bold text-coral-400">Wipe everything</span>
            </button>
          </div>
          <p className="mt-2 text-[10.5px] font-medium leading-relaxed text-fog-600">
            Ledger v1 · offline-first. Everything lives on this device — nothing syncs, nothing leaves, nothing
            tracks. A backup is your safety net.
          </p>
        </div>
      </div>
    </Sheet>
  );
}
