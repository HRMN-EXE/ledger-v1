"use client";

import { useApp } from "@/components/app-context";
import { CheckIcon, FlameIcon, ShieldIcon, TimerIcon } from "@/components/icons";
import { addDays, todayISO, weekdayLetter } from "@/lib/dates";
import { PERFECT_RUN_TARGET, PROTECTION_MAX } from "@/lib/types";

export function StatsView() {
  const app = useApp();
  const { streakState } = app;
  const doneTasks = app.data.tasks.filter((t) => t.done).length;
  const focusMin = app.data.sessions.reduce((acc, s) => acc + s.durationMin, 0);

  // Closed per day — tasks completed (by doneAt) over the last 7 days.
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const closedByDay = new Map<string, number>();
  for (const t of app.data.tasks) {
    if (t.done && t.doneAt) {
      const d = t.doneAt.slice(0, 10);
      closedByDay.set(d, (closedByDay.get(d) ?? 0) + 1);
    }
  }
  const counts = days.map((d) => closedByDay.get(d) ?? 0);
  const max = Math.max(1, ...counts);
  const weekTotal = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="animate-fade-in px-5 pb-40 pt-[max(20px,env(safe-area-inset-top))]">
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-fog-500">Ledger</p>
      <h1 className="mt-1 font-display text-[24px] font-bold leading-tight text-bone-50">What the days say</h1>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <span className="text-ember-500">
            <FlameIcon size={17} strokeWidth={1.9} />
          </span>
          <p className="mt-2 font-display text-[24px] font-bold leading-none text-bone-50">{streakState.streak}</p>
          <p className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-fog-500">current streak · best {streakState.longest}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <span className="text-lilac-400">
            <ShieldIcon size={17} strokeWidth={1.9} />
          </span>
          <p className="mt-2 font-display text-[24px] font-bold leading-none text-bone-50">
            {streakState.protections}
            <span className="text-[13px] text-fog-500">/{PROTECTION_MAX}</span>
          </p>
          <p className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-fog-500">
            shields · {streakState.perfectRun}/{PERFECT_RUN_TARGET} to next
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <span className="text-mint-400">
            <CheckIcon size={17} strokeWidth={2.2} />
          </span>
          <p className="mt-2 font-display text-[24px] font-bold leading-none text-bone-50">{doneTasks}</p>
          <p className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-fog-500">tasks closed</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <span className="text-gold-400">
            <TimerIcon size={17} strokeWidth={1.9} />
          </span>
          <p className="mt-2 font-display text-[24px] font-bold leading-none text-bone-50">{focusMin}</p>
          <p className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-fog-500">focus minutes</p>
        </div>
      </div>

      {/* Closed per day — 7 day bar chart */}
      <div className="grain relative mt-6 overflow-hidden rounded-3xl border border-white/5 bg-ink-800 p-4">
        <div className="pointer-events-none absolute -right-12 -top-14 size-40 rounded-full bg-ember-500/10 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-fog-500">Closed per day</p>
          <p className="font-display text-[10.5px] font-bold text-fog-500">
            {weekTotal} this week
          </p>
        </div>

        <div className="relative mt-4 grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const c = counts[i];
            const isToday = d === today;
            const h = c === 0 ? 3 : Math.max(18, Math.round((c / max) * 76));
            return (
              <div key={d} className="flex flex-col items-center gap-2">
                <div className="flex h-[96px] w-full flex-col items-center justify-end gap-1">
                  {c > 0 ? <span className="text-[10.5px] font-bold text-bone-100">{c}</span> : null}
                  <div
                    style={{ height: `${h}px` }}
                    className={`w-8 ${
                      c > 0
                        ? "rounded-lg bg-gradient-to-b from-ember-300 to-ember-600 shadow-[0_8px_22px_-8px_rgba(255,106,43,0.55)]"
                        : "rounded-full bg-white/10"
                    }`}
                  />
                </div>
                <span className={`text-[10px] font-bold uppercase ${isToday ? "text-ember-400" : "text-fog-500"}`}>
                  {weekdayLetter(d)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {weekTotal === 0 ? (
        <p className="mt-3 text-center text-[11.5px] font-medium text-fog-600">
          Close tasks and the bars start stacking — one per day, seven at a time.
        </p>
      ) : null}
    </div>
  );
}
