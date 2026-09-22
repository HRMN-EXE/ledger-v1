"use client";

import type { ReactElement } from "react";
import { BarsIcon, CalendarIcon, CheckIcon, FlameIcon, GearIcon, PlusIcon, XIcon } from "@/components/icons";

// ─── coach marks: six taps, no lectures ────────────────────────────────────

interface CoachStep {
  icon: (p: { size?: number; strokeWidth?: number }) => ReactElement;
  title: string;
  text: string;
  place: "top" | "center" | "bottom";
}

const STEPS: CoachStep[] = [
  {
    icon: CheckIcon,
    title: "Day ring",
    text: "Fills as tasks AND rituals close. Turns mint on a fully closed day.",
    place: "top",
  },
  {
    icon: FlameIcon,
    title: "Streak & shields",
    text: "Your flame, live status and protections. Tap it for records, vacation and cutoff.",
    place: "top",
  },
  {
    icon: CheckIcon,
    title: "Must · Should · Could",
    text: "Shoulds need a deadline and become musts that day. Musts never carry — close or own them.",
    place: "center",
  },
  {
    icon: PlusIcon,
    title: "Create",
    text: "The + hides a task/ritual toggle. Rituals are always-must vows with a tenure you set.",
    place: "bottom",
  },
  {
    icon: CalendarIcon,
    title: "Five tabs",
    text: "Plan reads the month's heat. Focus burns the hour. Rituals keep vows. Ledger remembers.",
    place: "bottom",
  },
  {
    icon: GearIcon,
    title: "Settings, everywhere",
    text: "The gear floats on every tab — theme, sounds, defaults, backup. That's it. Go own the hour.",
    place: "top",
  },
];

export const TOUR_STEPS = STEPS.length;

export function TourOverlay({
  step,
  onNext,
  onBack,
  onSkip,
}: {
  step: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const s = STEPS[Math.min(step, STEPS.length - 1)];
  const last = step >= STEPS.length - 1;
  const Icon = s.icon;

  const placement =
    s.place === "top"
      ? "top-[88px]"
      : s.place === "bottom"
        ? "bottom-[112px]"
        : "top-1/2 -translate-y-1/2";

  return (
    <div className="absolute inset-0 z-[80] bg-ink-950/70 backdrop-blur-[2px]">
      <div className={`absolute inset-x-5 ${placement}`}>
        <div className="animate-rise rounded-3xl border border-white/10 bg-ink-850 p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ember-500/15 text-ember-400">
              <Icon size={18} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold text-bone-50">{s.title}</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-fog-400">{s.text}</p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`size-1.5 rounded-full ${i === step ? "bg-ember-500" : i < step ? "bg-ember-500/40" : "bg-white/10"}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onBack} disabled={step === 0} className="press px-2 py-1.5 text-[11px] font-bold text-fog-500 disabled:opacity-30">
                Back
              </button>
              <button type="button" onClick={onSkip} className="press px-2 py-1.5 text-[11px] font-bold text-fog-500">
                Skip
              </button>
              <button
                type="button"
                onClick={onNext}
                className="press rounded-full bg-ember-500 px-4 py-2 text-[11.5px] font-extrabold text-ink-950"
              >
                {last ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── first-run prompt: opt-in, never a wall of text ────────────────────────

export function TourPrompt({ onTake, onDismiss }: { onTake: () => void; onDismiss: () => void }) {
  return (
    <div className="absolute inset-x-5 bottom-[104px] z-30 animate-rise">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-800/95 px-4 py-3 shadow-2xl backdrop-blur">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ember-500/15 text-ember-400">
          <BarsIcon size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-extrabold text-bone-50">First time?</p>
          <p className="text-[11px] font-medium text-fog-400">Six taps, thirty seconds, no lectures.</p>
        </div>
        <button type="button" onClick={onTake} className="press shrink-0 rounded-full bg-ember-500 px-3.5 py-2 text-[11px] font-extrabold text-ink-950">
          Show me
        </button>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="press shrink-0 p-1 text-fog-500">
          <XIcon size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
