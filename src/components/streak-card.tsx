"use client";

import { useApp } from "@/components/app-context";
import { FlameIcon, ShieldIcon } from "@/components/icons";
import { todayISO } from "@/lib/dates";
import type { StreakStatusKind } from "@/lib/streak-engine";
import { PROTECTION_MAX } from "@/lib/types";

const KIND_CHIP: Record<StreakStatusKind, string> = {
  SAFE: "border-mint-500/25 bg-mint-500/15 text-mint-400",
  AT_RISK: "border-gold-400/25 bg-gold-400/15 text-gold-400",
  FINAL_WARNING: "border-coral-400/30 bg-coral-400/15 text-coral-400",
  VACATION: "border-sky-400/25 bg-sky-400/15 text-sky-400",
  INACTIVE: "border-white/10 bg-white/5 text-fog-400",
  INACTIVE_WARNING: "border-coral-400/20 bg-coral-400/10 text-coral-400",
  PROTECTED: "border-lilac-400/25 bg-lilac-400/15 text-lilac-400",
};

export function StreakCard({ compact }: { compact?: boolean }) {
  const app = useApp();
  const { streakState, status } = app;
  const alive = streakState.streak > 0;

  // the whole day — tasks AND rituals — closed? the card burns mint.
  const today = todayISO();
  const due = app.data.tasks.filter((t) => t.day === today && !t.missed);
  const allClosed = due.length > 0 && due.every((t) => t.done);

  return (
    <button
      type="button"
      onClick={app.openStreakSheet}
      className={`press grain relative w-full overflow-hidden rounded-3xl border bg-ink-800 text-left transition-colors ${
        allClosed
          ? "border-mint-500/30 shadow-[0_24px_70px_-24px_rgba(70,194,140,0.35)]"
          : "border-ember-500/20 shadow-[0_24px_70px_-24px_rgba(255,106,43,0.3)]"
      }`}
    >
      {/* ambient heat */}
      <div
        className={`pointer-events-none absolute -right-12 -top-16 size-44 rounded-full blur-3xl ${
          allClosed ? "bg-mint-500/15" : "bg-ember-500/15"
        }`}
      />
      <div className="pointer-events-none absolute -bottom-16 -left-12 size-36 rounded-full bg-lilac-400/[0.06] blur-3xl" />

      <div className={`relative ${compact ? "p-3.5" : "p-4"}`}>
        <div className="flex items-center gap-3.5">
          {/* flame tile + shields below */}
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div
              className={`relative grid place-items-center rounded-2xl ${compact ? "size-12" : "size-14"} ${
                alive ? "bg-ember-500/15 text-ember-400" : "bg-white/5 text-fog-500"
              }`}
            >
              {alive ? <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-ember-500/30" /> : null}
              <span className={`${alive ? "animate-float drop-shadow-[0_0_10px_rgba(255,106,43,0.6)]" : ""}`}>
                <FlameIcon size={compact ? 24 : 28} strokeWidth={1.7} />
              </span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: PROTECTION_MAX }, (_, i) => (
                <span
                  key={i}
                  className={
                    i < streakState.protections
                      ? "text-lilac-400 drop-shadow-[0_0_6px_rgba(183,156,255,0.55)]"
                      : "text-fog-600/40"
                  }
                >
                  <ShieldIcon size={13} strokeWidth={2.2} />
                </span>
              ))}
            </div>
          </div>

          {/* number + status + best */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={`font-display font-bold leading-none text-bone-50 ${compact ? "text-[28px]" : "text-[36px]"}`}>
                {streakState.streak}
              </p>
              <p className="text-[9px] font-bold uppercase leading-[1.35] tracking-[0.16em] text-fog-500">
                day
                <br />
                streak
              </p>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.08em] ${KIND_CHIP[status.kind]}`}
              >
                {status.headline}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-fog-400">
                best {streakState.longest}
              </span>
            </div>
            <p className="mt-1 truncate text-[10px] font-medium text-fog-500">{status.detail}</p>
          </div>
        </div>
      </div>
    </button>
  );
}
