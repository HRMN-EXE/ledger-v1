"use client";

import { useState } from "react";
import { useApp } from "@/components/app-context";
import { CheckIcon, ClockIcon, FlameIcon, LoopIcon, PencilIcon, SparkIcon } from "@/components/icons";
import { StreakCard } from "@/components/streak-card";
import { TaskRow, TimeChip } from "@/components/task-row";
import { Ring } from "@/components/ui";
import { dayNum, greeting, minutesUntil, monthShort, pad, todayISO, weekdayLong } from "@/lib/dates";
import type { StreakStatus } from "@/lib/streak-engine";
import { scheduleLabel } from "@/lib/ritual-meta";
import { PRIORITY_META, type Priority, type TaskDTO } from "@/lib/types";

// ─── personality layer ──────────────────────────────────────────────────────

function sublineFor(status: StreakStatus): string {
  const s = status.remaining;
  switch (status.kind) {
    case "SAFE":
      return "Everything's handled. You're dangerous today.";
    case "AT_RISK":
      return `${s} loose end${s === 1 ? "" : "s"} on the stack. Hunt them down.`;
    case "FINAL_WARNING":
      return `${s} left and the sun's already going down. Move.`;
    case "VACATION":
      return "Streak's on ice. Touch grass guilt-free.";
    case "INACTIVE":
      return "Empty runway. Stack one real task and light it.";
    case "INACTIVE_WARNING":
      return "Careful — a second quiet day resets the flame.";
    case "PROTECTED":
      return `${s} pending, shield up. Finish it anyway.`;
  }
}

const GROUP_TAGLINE: Record<Priority, string> = {
  1: "do or die",
  2: "keep the promise",
  3: "if there's air",
};

function Group({ priority, tasks }: { priority: Priority; tasks: TaskDTO[] }) {
  const app = useApp();
  if (tasks.length === 0) return null;
  const meta = PRIORITY_META[priority];
  return (
    <div className="mb-5 animate-rise">
      <div className="mb-2 flex items-center gap-2">
        <span className={`size-2 rounded-full ${meta.dot} shadow-[0_0_10px_currentColor] ${meta.text}`} />
        <p className={`font-display text-[11px] font-bold uppercase tracking-[0.18em] ${meta.text}`}>{meta.label}</p>
        <p className="text-[9.5px] font-semibold lowercase tracking-wide text-fog-600">{GROUP_TAGLINE[priority]}</p>
        <span className="h-px flex-1 bg-white/5" />
        <span className="font-display text-[10.5px] font-bold text-fog-500">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={() => void app.toggleTask(t.id)} onOpen={() => app.editTaskSheet(t)} />
        ))}
      </div>
    </div>
  );
}

// ─── view ───────────────────────────────────────────────────────────────────

export function TodayView() {
  const app = useApp();
  const today = todayISO();
  const tasks = app.data.tasks;
  const status = app.status;

  const now = new Date();
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  // rituals live in their own bar — the stack holds plain tasks only
  const ritualTasks = tasks.filter((t) => t.day === today && t.ritualInstanceId != null && !t.missed);
  const stackTasks = tasks.filter((t) => t.day === today && t.ritualInstanceId == null && !t.missed);
  const open = stackTasks.filter((t) => !t.done);
  const doneItems = stackTasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const byPriority = (p: Priority) => open.filter((t) => t.priority === p).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  const mustOpen = open.filter((t) => t.priority === 1).length;
  const lateCount = open.filter((t) => t.time && minutesUntil(t.day, t.time) < 0).length;
  // the ring measures the WHOLE day — tasks and rituals together
  const dueAll = [...stackTasks, ...ritualTasks];
  const totalLive = dueAll.length;
  const doneAll = dueAll.filter((t) => t.done).length;
  const dayProgress = totalLive > 0 ? doneAll / totalLive : 0;
  // mint only when the whole day — tasks AND rituals — is closed
  const allClosed = totalLive > 0 && dueAll.every((t) => t.done);
  // rituals due today lead the page; otherwise the stack leads
  const ritualsFirst = ritualTasks.length > 0;

  const honored = ritualTasks.filter((t) => t.done).length;
  const activeRituals = app.rituals.filter((r) => r.commitment?.status === "ACTIVE");
  const ritualProgress = ritualTasks.length > 0 ? honored / ritualTasks.length : 0;

  const intent = app.data.intent;
  const [editingIntent, setEditingIntent] = useState(false);
  const [intentText, setIntentText] = useState("");

  const saveIntent = () => {
    setEditingIntent(false);
    const text = intentText.trim();
    if (text === (intent?.text ?? "")) return;
    void app.setIntent(text);
  };

  const ritualsBlock = (
    <>
      {activeRituals.length > 0 ? (
        <section className="grain relative overflow-hidden rounded-3xl border border-white/5 bg-ink-800">
          <div className="pointer-events-none absolute -left-12 -top-12 size-36 rounded-full bg-lilac-400/10 blur-3xl" />

          <div className="relative flex items-center justify-between px-4 pb-3 pt-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-lilac-400/15 text-lilac-400">
                <LoopIcon size={16} strokeWidth={2} />
              </span>
              <div>
                <p className="font-display text-[13px] font-bold text-bone-50">Rituals today</p>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-600">vows, not vibes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-ink-750 px-2.5 py-1 font-display text-[11px] font-bold text-bone-100">
                {honored}
                <span className="text-fog-500">/{ritualTasks.length}</span>
              </span>
              <button
                type="button"
                onClick={() => app.setTab("habits")}
                className="press rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-fog-400"
              >
                all →
              </button>
            </div>
          </div>

          <div className="relative mx-4 h-1 overflow-hidden rounded-full bg-white/5">
            {ritualProgress > 0 ? (
              <div
                className="bar-shimmer h-full rounded-full bg-gradient-to-r from-lilac-400 to-ember-500 transition-all duration-500"
                style={{ width: `${ritualProgress * 100}%` }}
              />
            ) : null}
          </div>

          {ritualTasks.length === 0 ? (
            <div className="px-4 pb-4 pt-3">
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-center">
                <p className="text-[12px] font-semibold text-fog-500">Nothing due from your rituals today. Enjoy the slack.</p>
              </div>
            </div>
          ) : (
            <div className="relative space-y-1.5 px-3 pb-3 pt-3">
              {ritualTasks.map((t) => {
                const ritual = app.rituals.find((r) => r.id === t.ritualId);
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 transition-colors ${
                      t.done ? "border-mint-500/10 bg-ink-850/60" : "border-white/5 bg-ink-750/70 hover:border-white/10"
                    }`}
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-700 text-[18px] ring-1 ring-inset ring-white/5">
                      {ritual?.icon ?? "●"}
                    </span>
                    <button type="button" onClick={() => app.editTaskSheet(t)} className="min-w-0 flex-1 text-left">
                      <p className={`truncate text-[14px] font-bold ${t.done ? "text-fog-600 line-through decoration-fog-600/50" : "text-bone-100"}`}>
                        {t.title}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5">
                        {t.time ? <TimeChip day={t.day} time={t.time} done={t.done} /> : null}
                        <span className="truncate text-[9.5px] font-semibold uppercase tracking-wide text-fog-600">
                          {ritual?.schedule ? scheduleLabel(ritual.schedule.type, ritual.schedule.config) : "ritual"}
                        </span>
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={t.done ? "Honored" : "Honor ritual"}
                      onClick={() => void app.toggleTask(t.id)}
                      className={`grid size-8 shrink-0 place-items-center rounded-full border-2 transition-all ${
                        t.done
                          ? "border-mint-500 bg-mint-500 text-ink-950 shadow-[0_0_18px_rgba(70,194,140,0.4)]"
                          : "press border-fog-500/50 text-transparent hover:border-ember-400"
                      }`}
                    >
                      {t.done ? <CheckIcon size={15} strokeWidth={3} className="animate-pop" /> : null}
                    </button>
                  </div>
                );
              })}
              {honored === ritualTasks.length ? (
                <p className="animate-pop rounded-2xl border border-mint-500/20 bg-mint-500/10 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-mint-400">
                  ✦ clean sweep — every ritual honored
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <section className="grain relative overflow-hidden rounded-3xl border border-dashed border-white/10 bg-ink-800/50 px-5 py-6 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-24 w-44 -translate-x-1/2 rounded-full bg-lilac-400/10 blur-2xl" />
          <p className="relative font-display text-[15px] font-bold text-bone-300">No rituals yet.</p>
          <p className="relative mt-1 text-[12px] font-medium leading-relaxed text-fog-500">
            Small daily vows compound. Start one that scares you a little.
          </p>
          <button
            type="button"
            onClick={app.openRitualCreate}
            className="press relative mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-ember-500 px-4 py-2.5 text-[12px] font-extrabold text-ink-950 shadow-[0_10px_28px_-8px_rgba(255,106,43,0.5)]"
          >
            <FlameIcon size={13} strokeWidth={2.2} />
            Start a ritual
          </button>
        </section>
      )}
    </>
  );

  return (
    <div className="animate-fade-in pb-40">
      {/* ── Header ── */}
      <header className="relative overflow-hidden px-5 pb-5 pt-[max(20px,env(safe-area-inset-top))]">
        <div className="pointer-events-none absolute -right-16 -top-24 size-60 rounded-full bg-ember-500/10 blur-3xl" />

        {/* brand + live clock (the global gear floats top-right of every tab) */}
        <div className="relative flex items-center justify-between pr-12">
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.24em] text-fog-500">Ledger</span>
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-800/80 px-3.5 py-1.5 backdrop-blur">
            <span className="text-bone-300">
              <ClockIcon size={11} strokeWidth={2.4} />
            </span>
            <span className="font-display text-[12px] font-bold tabular-nums text-bone-50">{clock}</span>
            <span className="size-1.5 animate-breathe rounded-full bg-ember-500" />
          </span>
        </div>

        {/* greeting + date + day ring */}
        <div className="relative mt-6 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[34px] font-bold leading-[1.04] tracking-tight text-bone-50">
              {greeting()}
              {app.profileName ? (
                <>
                  ,
                  <span className="block text-gradient-ember">{app.profileName}.</span>
                </>
              ) : (
                <span className="block text-gradient-ember">let's move.</span>
              )}
            </h1>
            <p className="mt-2.5 flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.2em] text-bone-50">
              {weekdayLong(today)}
              <span className="size-1 rounded-full bg-ember-400" />
              {monthShort(today)} {dayNum(today)}
            </p>
            <p className="mt-2.5 text-[13px] font-semibold leading-relaxed text-fog-400">{sublineFor(status)}</p>
          </div>
          <div className="shrink-0 pt-1">
            <Ring value={dayProgress} size={78} stroke={6} tone={allClosed ? "mint" : "ember"}>
              <span className="text-center font-display text-[14px] font-bold leading-tight text-bone-100">
                {totalLive > 0 ? (
                  <>
                    {doneAll}/{totalLive}
                    <span className="block text-[7.5px] font-bold uppercase tracking-[0.14em] text-fog-500">today</span>
                  </>
                ) : (
                  <span className="text-fog-500">–</span>
                )}
              </span>
            </Ring>
          </div>
        </div>

        {/* quick pulse chips */}
        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {status.kind === "VACATION" ? (
            <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-400">
              ❄ streak frozen
            </span>
          ) : (
            <>
              <span
                className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
                  open.length === 0 && totalLive > 0
                    ? "border-mint-500/25 bg-mint-500/10 text-mint-400"
                    : "border-ember-500/25 bg-ember-500/10 text-ember-400"
                }`}
              >
                {open.length === 0 && totalLive > 0 ? "all clear ✓" : `${open.length} pending`}
              </span>
              <span className="rounded-full border border-gold-400/25 bg-gold-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gold-400">
                {mustOpen} must
              </span>
              {lateCount > 0 ? (
                <span className="animate-breathe rounded-full border border-coral-400/30 bg-coral-400/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-coral-400">
                  {lateCount} late
                </span>
              ) : null}
            </>
          )}
        </div>
      </header>

      <div className="space-y-5 px-5">
        {/* ── Streak hero ── */}
        <StreakCard />

        {/* ── One thing ── */}
        <section>
          {editingIntent ? (
            <div>
              <input
                autoFocus
                value={intentText}
                onChange={(e) => setIntentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveIntent();
                  if (e.key === "Escape") setEditingIntent(false);
                }}
                onBlur={saveIntent}
                placeholder="What would make today a win?"
                className="w-full rounded-3xl border border-ember-500/40 bg-ink-800 p-5 font-display text-[17px] font-semibold text-bone-50 outline-none shadow-[0_0_40px_-12px_rgba(255,106,43,0.35)] placeholder:text-fog-600"
              />
              <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-fog-600">Enter to lock it in · Esc to bail</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIntentText(intent?.text ?? "");
                setEditingIntent(true);
              }}
              className="press grain group relative w-full overflow-hidden rounded-3xl border border-white/5 bg-ink-800 p-5 text-left"
            >
              <div className="pointer-events-none absolute -bottom-12 -right-10 size-36 rounded-full bg-ember-500/10 blur-3xl" />
              <span className="absolute left-0 top-0 h-full w-1 rounded-l-3xl bg-gradient-to-b from-ember-300 via-ember-500 to-ember-600" />
              <span className="relative flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-ember-500/15 text-ember-400">
                  <SparkIcon size={13} strokeWidth={2} />
                </span>
                <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-fog-500">The one thing</span>
                <span className="ml-auto text-fog-600 transition-colors group-hover:text-ember-400">
                  <PencilIcon size={13} strokeWidth={2} />
                </span>
              </span>
              <p
                className={`relative mt-2.5 font-display text-[19px] font-semibold leading-snug ${
                  intent?.text ? "text-bone-50" : "text-fog-600"
                }`}
              >
                {intent?.text || "What would make today a win?"}
              </p>
              {intent?.text ? (
                <span className="relative mt-2.5 inline-block rounded-full bg-ember-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-ember-400">
                  locked in
                </span>
              ) : null}
            </button>
          )}
        </section>

        {/* rituals due today lead the page */}
        {ritualsFirst ? ritualsBlock : null}

        {/* ── Today's stack ── */}
        <section id="today-stack" className="mt-2 scroll-mt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-fog-500">Today's stack</p>
            <div className="flex gap-1.5">
              <span className="rounded-full bg-ember-500/10 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-ember-400">
                {open.length} pending
              </span>
              <span className="rounded-full bg-mint-500/10 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-mint-400">
                {doneItems.length} done
              </span>
            </div>
          </div>

          {stackTasks.length === 0 ? (
            <div className="grain relative overflow-hidden rounded-3xl border border-dashed border-white/10 bg-ink-800/40 px-6 py-10 text-center">
              <div className="pointer-events-none absolute left-1/2 top-0 h-28 w-44 -translate-x-1/2 rounded-full bg-ember-500/10 blur-2xl" />
              <span className="relative mx-auto flex w-fit animate-float text-ember-400">
                <FlameIcon size={28} strokeWidth={1.8} />
              </span>
              <p className="relative mt-3 font-display text-[19px] font-bold text-bone-50">Nothing planned yet.</p>
              <p className="relative mt-1 text-[12.5px] font-medium leading-relaxed text-fog-500">
                Tap + and claim the day
                <br />
                before it claims itself.
              </p>
            </div>
          ) : (
            <>
              <Group priority={1} tasks={byPriority(1)} />
              <Group priority={2} tasks={byPriority(2)} />
              <Group priority={3} tasks={byPriority(3)} />
            </>
          )}

          {doneItems.length > 0 ? (
            <div className="mt-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full bg-mint-500 text-mint-500 shadow-[0_0_10px_currentColor]" />
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-mint-400">Closed out</p>
                <span className="h-px flex-1 bg-white/5" />
                <span className="font-display text-[10.5px] font-bold text-fog-500">{doneItems.length}</span>
              </div>
              <div className="space-y-2">
                {doneItems.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={() => void app.toggleTask(t.id)} onOpen={() => app.editTaskSheet(t)} />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* otherwise the stack leads and rituals follow */}
        {!ritualsFirst ? ritualsBlock : null}
      </div>
    </div>
  );
}
