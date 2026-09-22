"use client";

import { useState } from "react";
import { useApp } from "@/components/app-context";
import { CheckIcon } from "@/components/icons";
import { Sheet } from "@/components/ui";
import { deadlineCountdown, fmtShort, relativeDayLabel, todayISO } from "@/lib/dates";
import { CARRY_LIMIT, PRIORITY_META, type TaskDTO } from "@/lib/types";

/**
 * Daily Ledger — yesterday's leftovers, decided openly.
 *  · musts and same-day-deadline shoulds are locked: carry is off the table,
 *    they can only be acknowledged (missed) — never carried
 *  · shoulds & coulds are selectable — selected ride to today,
 *    unselected shoulds dissolve off the streak, unselected coulds are missed
 *  · items at the carry limit are locked out of carrying, flagged openly
 *  · the sheet cannot be dismissed while any actionable item remains
 *  · recently-missed tasks are shown read-only for the record; they never gate closing
 */
export function ResolverSheet({
  items,
  missed,
  onApply,
  onMiss,
  onClose,
}: {
  items: TaskDTO[];
  missed: TaskDTO[];
  onApply: (selectedIds: number[]) => void;
  onMiss: (id: number) => void;
  onClose: () => void;
}) {
  const app = useApp();
  const today = todayISO();
  const atLimit = (t: TaskDTO) => t.carries >= CARRY_LIMIT;
  const leftUntilMissed = (t: TaskDTO) =>
    deadlineCountdown(t.day, app.streakSettings.cutoffTime) ?? `due ${relativeDayLabel(t.day)}`;
  const dueToday = (t: TaskDTO) => t.deadline != null && t.deadline <= today;
  const isLocked = (t: TaskDTO) => t.priority === 1 || dueToday(t);

  const selectable = items.filter((t) => !isLocked(t));
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(selectable.filter((t) => !atLimit(t)).map((t) => t.id))
  );

  const toggle = (id: number) => {
    const t = items.find((x) => x.id === id);
    if (!t || isLocked(t) || atLimit(t)) return;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selCount = selectable.filter((t) => selected.has(t.id)).length;
  const restCount = selectable.length - selCount;

  return (
    <Sheet open title="Daily Ledger" onClose={onClose} locked={items.length > 0}>
      {/* the sealed record leads the ledger */}
      {missed.length > 0 ? (
        <div className="mb-4 border-b border-white/5 pb-4">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-fog-500">
            Recently missed — final
          </p>
          <div className="mt-2 space-y-1.5">
            {missed.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 rounded-xl bg-ink-850/70 px-3 py-2.5 opacity-60 saturate-[0.6]">
                <span className={`size-1.5 shrink-0 rounded-full ${PRIORITY_META[t.priority].dot}`} />
                <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-fog-500 line-through">{t.title}</p>
                <span className="shrink-0 text-[10px] font-semibold text-fog-600">{fmtShort(t.day)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] font-medium text-fog-600">Outcomes already sealed — shown for the record only.</p>
        </div>
      ) : null}

      <p className="mb-4 text-[12px] font-medium text-fog-400">
        Decide every row to close the ledger. Selected shoulds ride to today; unselected shoulds dissolve off the
        streak; unselected coulds are missed. Musts and same-day deadlines never carry.
      </p>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-mint-500/20 bg-mint-500/10 px-4 py-3.5 text-center text-[12px] font-bold uppercase tracking-[0.12em] text-mint-400">
          All actionable items resolved — the ledger is clear
        </p>
      ) : (
        <div className="space-y-2.5 pb-2">
          {items.map((t) => {
            const locked = isLocked(t);
            const on = selected.has(t.id);
            return (
              <div key={t.id} className="animate-rise rounded-xl border border-white/5 bg-ink-800 px-3.5 py-3.5">
                <div className="flex items-center gap-3">
                  {locked ? (
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-ember-500/60 text-ember-400"
                      aria-label="Locked — cannot carry"
                    >
                      <span className="size-1.5 rounded-full bg-ember-500" />
                    </span>
                  ) : atLimit(t) ? (
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-coral-400/60 text-coral-400"
                      aria-label="Carry limit reached"
                    >
                      <span className="size-1.5 rounded-full bg-coral-400" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={on ? "Selected — will carry" : "Not selected — will dissolve"}
                      onClick={() => toggle(t.id)}
                      className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all ${
                        on
                          ? "border-ember-500 bg-ember-500 text-ink-950 shadow-[0_0_14px_rgba(255,106,43,0.45)]"
                          : "press border-fog-500/50 text-transparent"
                      }`}
                    >
                      <CheckIcon size={13} strokeWidth={3.2} />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-bone-100">{t.title}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-fog-500">
                      {fmtShort(t.day)} · {PRIORITY_META[t.priority].label}
                      {t.priority === 1
                        ? ` · ${leftUntilMissed(t)}`
                        : t.deadline
                          ? ` · due ${fmtShort(t.deadline)}`
                          : ""}
                      {t.carries > 0 ? ` · carried ×${t.carries}` : ""}
                    </p>
                  </div>
                  <span className={`size-1.5 shrink-0 rounded-full ${PRIORITY_META[t.priority].dot}`} />
                </div>

                {locked ? (
                  <div className="mt-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ember-400">
                      {t.priority === 1
                        ? "musts don't carry — close it today or own the miss"
                        : "due today — carry is off the table; close it or own it"}
                    </p>
                    <button
                      type="button"
                      onClick={() => onMiss(t.id)}
                      className="press mt-2 w-full rounded-xl bg-coral-400/10 py-2.5 text-[12.5px] font-extrabold text-coral-400"
                    >
                      Mark missed
                    </button>
                  </div>
                ) : (
                  <p className={`mt-1.5 pl-9 text-[10px] font-medium ${atLimit(t) ? "font-bold text-coral-400" : "text-fog-600"}`}>
                    {atLimit(t)
                      ? "carry limit reached — will be marked missed"
                      : on
                        ? "rides to today"
                        : t.priority === 2
                          ? "will dissolve — off the streak"
                          : "will be marked missed"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectable.length > 0 ? (
        <button
          type="button"
          onClick={() => onApply(Array.from(selected))}
          className="press mt-1 w-full rounded-2xl bg-ember-500 py-4 text-[14px] font-extrabold text-ink-950"
        >
          Carry {selCount} · dissolve {restCount}
        </button>
      ) : null}

    </Sheet>
  );
}
