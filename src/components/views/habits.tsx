"use client";

import { useApp } from "@/components/app-context";
import { TrashIcon } from "@/components/icons";
import { WeekStrip } from "@/components/ritual-detail";
import { EmptyState, SectionLabel } from "@/components/ui";
import { todayISO, weekOf } from "@/lib/dates";
import { commitmentStatusLabel, scheduleLabel, tenureLabel } from "@/lib/ritual-meta";
import { HABIT_COLORS, tagClasses, type RitualDTO } from "@/lib/types";

function RitualCard({ ritual }: { ritual: RitualDTO }) {
  const app = useApp();
  const c = ritual.commitment;
  const status = c ? commitmentStatusLabel(c.status) : null;
  const progress = c && c.requiredDays > 0 ? Math.min(1, c.activeDays / c.requiredDays) : 0;

  return (
    <button
      type="button"
      onClick={() => app.openRitualDetail(ritual)}
      className="press w-full rounded-2xl border border-white/5 bg-ink-800 p-4 text-left"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-750 text-[20px]">{ritual.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-bone-100">{ritual.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${tagClasses(ritual.category, app.data.tags)}`}>
              {ritual.category}
            </span>
            {status ? <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${status.cls}`}>{status.label}</span> : null}
            {c ? (
              <span className="text-[9.5px] font-semibold text-fog-500">
                {tenureLabel(c.tenureValue, c.tenureUnit)} · {c.remainingDays} left
              </span>
            ) : null}
          </div>
        </div>
        {ritual.schedule ? (
          <span className="shrink-0 text-right text-[10px] font-bold leading-snug text-fog-500">
            {scheduleLabel(ritual.schedule.type, ritual.schedule.config)}
          </span>
        ) : null}
      </div>

      {c && c.status === "ACTIVE" ? (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-gradient-to-r from-ember-300 to-ember-600" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] font-semibold text-fog-500">
            tenure {c.activeDays}/{c.requiredDays} days
          </p>
        </>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex-1">
          <WeekStrip ritual={ritual} />
        </div>
      </div>
      <p className="mt-1.5 text-[10.5px] font-bold text-fog-500">
        {ritual.week.done} of {ritual.week.target} this window
      </p>
    </button>
  );
}

export function HabitsView() {
  const app = useApp();
  const today = todayISO();
  const rituals = app.rituals;
  const habits = app.data.habits;
  const week = weekOf(today);

  return (
    <div className="animate-fade-in px-5 pb-40 pt-[max(20px,env(safe-area-inset-top))]">
      <div>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-fog-500">Rituals</p>
        <h1 className="mt-1 font-display text-[24px] font-bold leading-tight text-bone-50">Small daily vows</h1>
      </div>

      <div className="mt-5 space-y-3">
        {rituals.length === 0 ? (
          <EmptyState
            title="No rituals yet"
            sub="A ritual is a vow with a tenure: daily pages, cold showers, training. Pick the cadence, commit for a season."
            action={
              <button
                type="button"
                onClick={app.openRitualCreate}
                className="press rounded-full bg-ember-500 px-5 py-2.5 text-[13px] font-extrabold text-ink-950"
              >
                Start your first ritual
              </button>
            }
          />
        ) : (
          rituals.map((r) => <RitualCard key={r.id} ritual={r} />)
        )}
      </div>

      {habits.length > 0 ? (
        <div className="mt-8">
          <SectionLabel>Habits</SectionLabel>
          <div className="space-y-1.5">
            {habits.map((h) => {
              const color = HABIT_COLORS[h.color] ?? HABIT_COLORS.ember;
              const logsThisWeek = app.data.logs.filter((l) => l.habitId === h.id && week.includes(l.day));
              const todayOn = logsThisWeek.some((l) => l.day === today);
              return (
                <div key={h.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-800 px-3.5 py-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-[16px] ${color.soft}`}>{h.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-bone-100">{h.name}</p>
                    <div className="mt-1 flex items-center gap-1">
                      {Array.from({ length: h.weekTarget }, (_, i) => (
                        <span key={i} className={`size-1.5 rounded-full ${i < logsThisWeek.length ? color.dot : "bg-white/10"}`} />
                      ))}
                      <span className="ml-1 text-[9.5px] font-bold text-fog-500">
                        {logsThisWeek.length}/{h.weekTarget} this week
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete habit"
                    onClick={() => void app.deleteHabit(h.id)}
                    className="press rounded-full p-1 text-fog-600"
                  >
                    <TrashIcon size={13} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    aria-label={todayOn ? "Logged today" : "Log today"}
                    onClick={() => void app.toggleLog(h.id, today)}
                    className={`press grid size-8 place-items-center rounded-full border-2 text-[13px] ${
                      todayOn ? `${color.soft} border-transparent` : "border-fog-500/50 text-transparent"
                    }`}
                  >
                    {todayOn ? h.icon : ""}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <SectionLabel>Habits</SectionLabel>
          <p className="rounded-xl border border-dashed border-white/10 bg-ink-800/40 px-4 py-4 text-center text-[12px] font-semibold text-fog-500">
            Light tracking for the tiny things — water, pages, stretches.
          </p>
        </div>
      )}
    </div>
  );
}
