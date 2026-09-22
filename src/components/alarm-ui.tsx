"use client";

import { ClockIcon, FlameIcon, TimerIcon } from "@/components/icons";
import { MAX_SNOOZES, FIRST_SNOOZE_MIN } from "@/lib/alarm";
import { fmtTime } from "@/lib/dates";
import { PRIORITY_META, type TaskDTO } from "@/lib/types";

export interface ReminderItem {
  key: string;
  task: TaskDTO;
  headline?: string;
}

export function ReminderBanner({
  task,
  headline,
  onDone,
  onDismiss,
}: {
  task: TaskDTO;
  headline?: string;
  onDone: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-2xl border border-white/10 bg-ink-750/95 px-4 py-3 shadow-2xl backdrop-blur">
      <span className="mt-0.5 text-ember-400">
        <ClockIcon size={16} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-extrabold text-bone-50">{headline ?? task.title}</p>
        <p className="text-[11px] font-medium text-fog-400">
          {fmtTime(task.time)} · {PRIORITY_META[task.priority].label} task
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onDone} className="press rounded-full bg-bone-50 px-3 py-1.5 text-[11.5px] font-bold text-ink-950">
          Done
        </button>
        <button type="button" onClick={onDismiss} className="press px-1 text-[11.5px] font-semibold text-fog-400">
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function AlarmOverlay({
  task,
  snoozeCount,
  onSnooze,
  onStop,
  onReschedule,
  onFocus,
}: {
  task: TaskDTO;
  snoozeCount: number;
  onSnooze: () => void;
  onStop: () => void;
  onReschedule: () => void;
  onFocus: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-ink-950/90 p-6 backdrop-blur-md">
      <div className="w-full animate-pop rounded-[32px] border border-white/10 bg-ink-850 p-6 text-center shadow-2xl">
        <div className="mx-auto grid size-16 animate-breathe place-items-center rounded-full bg-ember-500/15 text-ember-400">
          <FlameIcon size={30} strokeWidth={1.6} />
        </div>
        <p className="mt-4 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ember-400">
          {PRIORITY_META[task.priority].label} · {fmtTime(task.time)}
        </p>
        <h2 className="mt-1.5 font-display text-[24px] font-bold leading-tight text-bone-50">{task.title}</h2>
        <p className="mt-1.5 text-[12px] font-medium text-fog-400">The hour is yours. Move.</p>

        <div className="mt-6 space-y-2.5">
          <button type="button" onClick={onStop} className="press w-full rounded-2xl bg-bone-50 py-4 text-[15px] font-extrabold text-ink-950">
            Stop
          </button>
          {snoozeCount < MAX_SNOOZES ? (
            <button
              type="button"
              onClick={onSnooze}
              className="press w-full rounded-2xl bg-ink-750 py-3.5 text-[13.5px] font-bold text-fog-400"
            >
              Snooze {FIRST_SNOOZE_MIN * (snoozeCount + 1)} min
            </button>
          ) : (
            <p className="text-[11px] font-semibold text-fog-600">No snoozes left — this is it.</p>
          )}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onReschedule}
              className="press flex-1 rounded-2xl border border-white/10 py-3.5 text-[13px] font-bold text-bone-100"
            >
              Reschedule
            </button>
            <button
              type="button"
              onClick={onFocus}
              className="press flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ember-500/10 py-3.5 text-[13px] font-bold text-ember-400"
            >
              <TimerIcon size={15} strokeWidth={2} />
              Focus
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
