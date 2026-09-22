"use client";

import { useApp } from "@/components/app-context";
import { CheckIcon, ClockIcon, LoopIcon } from "@/components/icons";
import { deadlineCountdown, fmtDelta, fmtTime, minutesUntil, relativeDayLabel, todayISO } from "@/lib/dates";
import { PRIORITY_META, tagClasses, type TaskDTO } from "@/lib/types";

/**
 * Time-aware chip with a subconscious urgency ramp:
 * ember (scheduled) → gold (≤30 min away) → pulsing coral (late).
 * Done tasks and other days stay calm.
 */
export function TimeChip({ day, time, done }: { day: string; time: string; done: boolean }) {
  const isToday = day === todayISO();
  if (!isToday || done) {
    return (
      <span className="flex items-center gap-1 rounded-lg bg-ember-500/15 px-2.5 py-1 font-display text-[10.5px] font-bold text-ember-300 ring-1 ring-inset ring-ember-500/25">
        <ClockIcon size={10} strokeWidth={2.4} />
        {fmtTime(time)}
      </span>
    );
  }
  const mins = minutesUntil(day, time);
  if (mins < 0) {
    return (
      <span className="flex animate-breathe items-center gap-1 rounded-lg bg-coral-400/20 px-2.5 py-1 font-display text-[10.5px] font-bold text-coral-400 ring-1 ring-inset ring-coral-400/40">
        <ClockIcon size={10} strokeWidth={2.4} />
        {fmtDelta(mins)} late
      </span>
    );
  }
  if (mins <= 30) {
    return (
      <span className="flex items-center gap-1 rounded-lg bg-gold-400/20 px-2.5 py-1 font-display text-[10.5px] font-bold text-gold-400 ring-1 ring-inset ring-gold-400/40">
        <ClockIcon size={10} strokeWidth={2.4} />
        {mins === 0 ? "now" : `in ${fmtDelta(mins)}`}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-lg bg-ember-500/15 px-2.5 py-1 font-display text-[10.5px] font-bold text-ember-300 ring-1 ring-inset ring-ember-500/25">
      <ClockIcon size={10} strokeWidth={2.4} />
      {fmtTime(time)} · in {fmtDelta(mins)}
    </span>
  );
}

export function TaskRow({ task, onToggle, onOpen }: { task: TaskDTO; onToggle: () => void; onOpen: () => void }) {
  const app = useApp();
  const prio = PRIORITY_META[task.priority];
  const isRitual = task.ritualInstanceId != null;

  return (
    <div
      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 transition-all ${
        task.done ? "border-white/5 bg-ink-850/70" : "border-white/5 bg-ink-800 hover:border-white/15"
      }`}
    >
      {/* priority spine */}
      <span className={`absolute left-0 top-0 h-full w-[3px] ${task.done ? "bg-fog-600/25" : prio.dot}`} />

      <button
        type="button"
        aria-label={task.done ? "Completed" : "Mark done"}
        onClick={onToggle}
        className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all ${
          task.done
            ? "border-mint-500 bg-mint-500 text-ink-950 shadow-[0_0_18px_rgba(70,194,140,0.45)]"
            : "press border-fog-500/50 bg-transparent text-transparent hover:border-ember-400"
        }`}
      >
        {task.done ? <CheckIcon size={14} strokeWidth={3.2} className="animate-pop" /> : null}
      </button>

      <button
        type="button"
        onClick={() => {
          if (task.done) {
            app.toast("Closed tasks are read-only");
            return;
          }
          onOpen();
        }}
        className={`min-w-0 flex-1 text-left ${task.done ? "opacity-55 saturate-[0.55]" : ""}`}
      >
        <p className={`truncate text-[14.5px] font-bold ${task.done ? "text-fog-600 line-through decoration-fog-600/50" : "text-bone-100"}`}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {task.time ? <TimeChip day={task.day} time={task.time} done={task.done} /> : null}
          <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${tagClasses(task.tag, app.data.tags)}`}>{task.tag}</span>
          {!task.done && (task.deadline != null || task.priority === 1) ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                task.priority === 1 ? "bg-ember-500/15 text-ember-400" : "bg-gold-400/10 text-gold-400"
              }`}
            >
              ⚑{" "}
              {task.priority === 1
                ? deadlineCountdown(task.day, app.streakSettings.cutoffTime) ?? `due ${relativeDayLabel(task.day)}`
                : task.deadline
                  ? deadlineCountdown(task.deadline, app.streakSettings.cutoffTime) ?? `due ${relativeDayLabel(task.deadline)}`
                  : null}
            </span>
          ) : null}
          {isRitual ? (
            <span className="flex items-center gap-1 rounded-full bg-lilac-400/10 px-2 py-0.5 text-[9.5px] font-bold text-lilac-400">
              <LoopIcon size={9} strokeWidth={2.4} />
              ritual
            </span>
          ) : null}
          {task.carries > 0 ? (
            <span className="rounded-full bg-gold-400/10 px-2 py-0.5 text-[9.5px] font-bold text-gold-400">↻ carried ×{task.carries}</span>
          ) : null}
        </div>
      </button>

      <span className="grid size-4 shrink-0 place-items-center opacity-60" aria-label={prio.label}>
        <span className={`size-1.5 rounded-full ${task.done ? "bg-fog-600/40" : prio.dot} ${task.done ? "" : "shadow-[0_0_8px_currentColor]"}`} />
      </span>
    </div>
  );
}
