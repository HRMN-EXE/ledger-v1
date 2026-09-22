"use client";

import { useState } from "react";
import { useApp } from "@/components/app-context";
import { CalendarPicker, type DayStats } from "@/components/calendar-picker";
import { LoopIcon } from "@/components/icons";
import { TimeChip } from "@/components/task-row";
import { EmptyState } from "@/components/ui";
import { deadlineCountdown, fmtDateLongGB, relativeDayLabel, todayISO } from "@/lib/dates";
import { PRIORITY_META, tagClasses, type TaskDTO } from "@/lib/types";

type NodeKind = "done" | "missed" | "late" | "today" | "future";

function nodeFor(t: TaskDTO, today: string): { cls: string; kind: NodeKind } {
  if (t.done) return { cls: "bg-mint-500 shadow-[0_0_10px_rgba(70,194,140,0.5)]", kind: "done" };
  if (t.missed) return { cls: "bg-coral-400", kind: "missed" };
  if (t.day < today) return { cls: "animate-breathe bg-gold-400 shadow-[0_0_10px_rgba(229,178,62,0.5)]", kind: "late" };
  if (t.day === today) return { cls: "bg-ember-500 shadow-[0_0_10px_rgba(255,106,43,0.5)]", kind: "today" };
  return { cls: "bg-fog-500/60", kind: "future" };
}

const KIND_LABEL: Record<NodeKind, string> = {
  done: "closed",
  missed: "missed",
  late: "leftover",
  today: "today",
  future: "planned",
};

export function PlanView() {
  const app = useApp();
  const today = todayISO();
  const [selected, setSelected] = useState(today);

  // per-day load for the heat calendar
  const marks = new Map<string, DayStats>();
  for (const t of app.data.tasks) {
    if (t.missed) continue;
    const s = marks.get(t.day) ?? { open: 0, done: 0 };
    if (t.done) s.done++;
    else s.open++;
    marks.set(t.day, s);
  }

  const dayTasks = app.data.tasks.filter((t) => t.day === selected);
  const open = dayTasks.filter((t) => !t.done && !t.missed);
  const done = dayTasks.filter((t) => t.done);
  const missed = dayTasks.filter((t) => t.missed);
  const isPast = selected < today;

  const sorted = [...dayTasks].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.priority - b.priority || a.title.localeCompare(b.title);
  });

  return (
    <div className="animate-fade-in px-5 pb-40 pt-[max(20px,env(safe-area-inset-top))]">
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-fog-500">Plan</p>
      <h1 className="mt-1 font-display text-[24px] font-bold leading-tight text-bone-50">Shape the days</h1>
      <p className="mt-1.5 text-[12px] font-medium text-fog-500">
        Brighter cells carry more weight. Tap any day — even the ghosts — to see its story.
      </p>

      <div className="mt-4">
        <CalendarPicker value={selected} onChange={setSelected} marks={marks} />
      </div>

        {/* ── selected day ── */}
        <div className="mt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-[16px] font-bold text-bone-50">
                {relativeDayLabel(selected)}
                <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fog-500">
                  {fmtDateLongGB(selected)}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-ember-500/10 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-ember-400">
                  {open.length} pending
                </span>
                <span className="rounded-full bg-mint-500/10 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-mint-400">
                  {done.length} closed
                </span>
                {missed.length > 0 ? (
                  <span className="rounded-full bg-coral-400/10 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-coral-400">
                    {missed.length} missed
                  </span>
                ) : null}
              </div>
            </div>
          </div>

        {/* leftovers rescue for past days */}
        {isPast && open.length > 0 ? (
          <div className="mt-4 animate-rise rounded-2xl border border-gold-400/25 bg-gold-400/10 px-4 py-3.5">
            <p className="text-[12.5px] font-extrabold text-gold-400">
              {open.length} unfinished from this day.
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-fog-400">
              Carry what still matters into today — or own the miss and move on.
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-coral-400">
              Musts among these will be marked missed, not carried.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => void app.resolveLeftovers(selected, "carry")}
                className="press flex-1 rounded-xl bg-ember-500 py-2.5 text-[12px] font-extrabold text-ink-950"
              >
                Carry to today
              </button>
              <button
                type="button"
                onClick={() => void app.resolveLeftovers(selected, "miss")}
                className="press flex-1 rounded-xl bg-coral-400/10 py-2.5 text-[12px] font-extrabold text-coral-400"
              >
                Miss them all
              </button>
            </div>
          </div>
        ) : null}

        {/* timeline */}
        <div className="mt-4">
          {sorted.length === 0 ? (
            <EmptyState
              title="Nothing on this day"
              sub={isPast ? "A quiet page in the ledger." : "Plant something here."}
              action={
                <button
                  type="button"
                  onClick={() => app.openTaskSheet(selected)}
                  className="press rounded-full bg-ember-500 px-4 py-2 text-[12px] font-extrabold text-ink-950"
                >
                  Add a task
                </button>
              }
            />
          ) : (
            <div key={selected} className="animate-rise">
              {sorted.map((t, i) => {
                const node = nodeFor(t, today);
                return (
                  <div key={t.id} className="relative flex gap-3">
                    {/* time column */}
                    <div className="w-14 shrink-0 pt-3.5 text-right font-display text-[10.5px] font-bold tabular-nums text-fog-500">
                      {t.time ?? "—"}
                    </div>

                    {/* rail */}
                    <div className="flex flex-col items-center pt-4">
                      <span className={`size-2.5 shrink-0 rounded-full ${node.cls}`} />
                      {i < sorted.length - 1 ? <span className="w-px flex-1 bg-white/5" /> : null}
                    </div>

                    {/* card */}
                    <div className={`min-w-0 flex-1 ${i < sorted.length - 1 ? "pb-2.5" : ""}`}>
                      <button
                        type="button"
                        onClick={() => app.editTaskSheet(t)}
                        className={`press w-full rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                          t.done
                            ? "border-white/5 bg-ink-850/70 opacity-55 saturate-[0.55]"
                            : "border-white/5 bg-ink-800 hover:border-white/15"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {t.ritualId != null ? (
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-lilac-400/15 text-[15px] ring-1 ring-inset ring-lilac-400/25">
                              {app.rituals.find((r) => r.id === t.ritualId)?.icon ?? "●"}
                            </span>
                          ) : null}
                          <p
                            className={`min-w-0 flex-1 truncate text-[14px] font-bold ${
                              t.done ? "text-fog-600 line-through decoration-fog-600/50" : t.missed ? "text-fog-600 line-through" : "text-bone-100"
                            }`}
                          >
                            {t.title}
                          </p>
                          <span className={`shrink-0 text-[8.5px] font-bold uppercase tracking-[0.12em] ${
                            node.kind === "done"
                              ? "text-mint-400"
                              : node.kind === "missed"
                                ? "text-coral-400"
                                : node.kind === "late"
                                  ? "text-gold-400"
                                  : node.kind === "today"
                                    ? "text-ember-400"
                                    : "text-fog-600"
                          }`}>
                            {KIND_LABEL[node.kind]}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9.5px] font-bold text-fog-400">
                            <span className={`size-1.5 rounded-full ${PRIORITY_META[t.priority].dot}`} />
                            {PRIORITY_META[t.priority].label}
                          </span>
                          {!t.done && !t.missed && (t.deadline != null || t.priority === 1) ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                                t.priority === 1 ? "bg-ember-500/15 text-ember-400" : "bg-gold-400/10 text-gold-400"
                              }`}
                            >
                              ⚑{" "}
                              {t.priority === 1
                                ? deadlineCountdown(t.day, app.streakSettings.cutoffTime) ?? `due ${relativeDayLabel(t.day)}`
                                : t.deadline
                                  ? deadlineCountdown(t.deadline, app.streakSettings.cutoffTime) ?? `due ${relativeDayLabel(t.deadline)}`
                                  : null}
                            </span>
                          ) : null}
                          {t.time ? <TimeChip day={t.day} time={t.time} done={t.done} /> : null}
                          <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${tagClasses(t.tag, app.data.tags)}`}>
                            {t.tag}
                          </span>
                          {t.ritualInstanceId != null ? (
                            <span className="flex items-center gap-1 rounded-full bg-lilac-400/10 px-2 py-0.5 text-[9.5px] font-bold text-lilac-400">
                              <LoopIcon size={9} strokeWidth={2.4} />
                              ritual
                            </span>
                          ) : null}
                          {t.carries > 0 ? (
                            <span className="rounded-full bg-gold-400/10 px-2 py-0.5 text-[9.5px] font-bold text-gold-400">
                              ↻ ×{t.carries}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
