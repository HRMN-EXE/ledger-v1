"use client";

import { useEffect, useState } from "react";
import { FlameIcon } from "@/components/icons";
import { PlannerApp } from "@/components/planner-app";
import { todayISO } from "@/lib/dates";
import { ensureOpenedOn, loadDB, setProfileName, type LocalDB } from "@/lib/localdb";
import { buildDTOs, localRitualSync } from "@/lib/local-rituals";
import type { AppData } from "@/lib/types";

export function buildAppData(): AppData {
  localRitualSync();
  const db = loadDB();
  return {
    tasks: db.tasks,
    rituals: buildDTOs(db),
    tags: db.tags,
    habits: db.habits,
    logs: db.logs,
    sessions: db.sessions,
    intent: db.intents.find((i) => i.day === todayISO()) ?? null,
    streak: {
      state: db.streakState,
      records: db.records,
      vacationDays: db.vacations,
      settings: db.settings,
    },
  };
}

export function AppShell() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData | null>(null);
  const [name, setName] = useState("");
  const [openedOn, setOpenedOn] = useState(todayISO());
  const [nameDraft, setNameDraft] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // tell the inline watchdog that the bundle is alive
    (window as unknown as { __ledger_booted?: boolean }).__ledger_booted = true;
    const wt = window as unknown as { __ledger_boot_timer?: number };
    if (wt.__ledger_boot_timer != null) window.clearTimeout(wt.__ledger_boot_timer);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    loadDB();
    setOpenedOn(ensureOpenedOn());
    const db = loadDB();
    setName(db.profile.name);
    setData(buildAppData());
    setReady(true);
  }, []);

  const start = () => {
    const clean = nameDraft.trim();
    if (!clean) return;
    const db = loadDB();
    setProfileName(db, clean);
    setName(clean);
    setStarted(true);
  };

  if (!ready || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <span className="animate-breathe text-ember-500">
          <FlameIcon size={34} strokeWidth={1.6} />
        </span>
        <p className="font-display text-[13px] font-bold tracking-[0.28em] text-bone-300">LEDGER</p>
      </div>
    );
  }

  if (!name && !started) {
    return (
      <div className="relative flex h-full flex-col justify-center overflow-hidden px-7">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[380px] -translate-x-1/2 rounded-full bg-ember-500/[0.08] blur-3xl" />
        <div className="relative">
          <span className="grid size-14 place-items-center rounded-2xl bg-ember-500/15 text-ember-500">
            <FlameIcon size={28} strokeWidth={1.7} />
          </span>
          <h1 className="mt-5 font-display text-[30px] font-bold leading-tight text-bone-50">Welcome to Ledger</h1>
          <p className="mt-2 text-[14px] font-medium leading-relaxed text-fog-400">
            Your day, your rituals, your streak — planned like it matters.
          </p>

          <p className="mt-8 text-[10.5px] font-bold uppercase tracking-[0.16em] text-fog-500">What should we call you?</p>
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && start()}
            placeholder="Your name"
            className="mt-2 w-full rounded-2xl bg-ink-750 px-4 py-4 text-[16px] font-semibold text-bone-50 outline-none ring-ember-500/70 placeholder:text-fog-600 focus:ring-2"
          />
          <button
            type="button"
            disabled={!nameDraft.trim()}
            onClick={start}
            className="press mt-3 w-full rounded-2xl bg-ember-500 py-4 text-[15px] font-extrabold text-ink-950 disabled:opacity-40"
          >
            Begin
          </button>
          <p className="mt-6 text-center text-[11px] font-medium leading-relaxed text-fog-600">
            Private by design — everything lives in this device's storage.
            <br />
            No accounts. No cloud. No tracking.
          </p>
        </div>
      </div>
    );
  }

  return <PlannerApp initial={data} name={name} openedOn={openedOn} />;
}

export type { LocalDB };
