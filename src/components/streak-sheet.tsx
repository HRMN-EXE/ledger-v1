"use client";

import { useState } from "react";
import { useApp } from "@/components/app-context";
import { CalendarPicker } from "@/components/calendar-picker";
import { FlameIcon, ShieldIcon, XIcon } from "@/components/icons";
import { FieldLabel, Seg, Sheet, Toggle } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { PERFECT_RUN_TARGET, PROTECTION_MAX, VACATION_LIMIT_PER_YEAR } from "@/lib/types";

function Row({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800 px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold text-bone-100">{label}</p>
        {sub ? <p className="text-[10.5px] font-medium text-fog-500">{sub}</p> : null}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export function StreakSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const { streakState, streakSettings, vacationDays, records } = app;
  const today = todayISO();

  const [mode, setMode] = useState<"range" | "open">("range");
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const year = today.slice(0, 4);
  const usedThisYear = Array.from(vacationDays).filter((d) => d.startsWith(year)).length;
  const openVac = streakState.vacationOpenStart;
  const sortedVacations = Array.from(vacationDays).sort();

  const pick = (day: string) => {
    setErr(null);
    if (!selStart || (selStart && selEnd)) {
      setSelStart(day);
      setSelEnd(null);
    } else if (day < selStart) {
      setSelEnd(selStart);
      setSelStart(day);
    } else {
      setSelEnd(day);
    }
  };

  const schedule = async () => {
    if (!selStart) return;
    const error = await app.scheduleVacation(selStart, selEnd ?? selStart, false);
    if (error) {
      setErr(error);
      return;
    }
    setSelStart(null);
    setSelEnd(null);
  };

  return (
    <Sheet open={open} title="Streak & ledger" onClose={onClose}>
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-ink-800 p-3 text-center">
            <span className="mx-auto flex w-fit text-ember-500">
              <FlameIcon size={16} strokeWidth={1.9} />
            </span>
            <p className="mt-1 font-display text-[20px] font-bold text-bone-50">{streakState.streak}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-fog-500">streak</p>
          </div>
          <div className="rounded-2xl bg-ink-800 p-3 text-center">
            <p className="font-display text-[20px] font-bold text-bone-50">{streakState.longest}</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-fog-500">longest</p>
          </div>
          <div className="rounded-2xl bg-ink-800 p-3 text-center">
            <span className="mx-auto flex w-fit text-lilac-400">
              <ShieldIcon size={16} strokeWidth={1.9} />
            </span>
            <p className="mt-1 font-display text-[20px] font-bold text-bone-50">
              {streakState.protections}
              <span className="text-[12px] text-fog-500">/{PROTECTION_MAX}</span>
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-fog-500">shields</p>
          </div>
        </div>

        <p className="-mt-3 text-center text-[11px] font-medium text-fog-500">
          {streakState.perfectRun} of {PERFECT_RUN_TARGET} perfect days toward the next earned shield · {records.length} day(s) on ledger
        </p>

        {/* Vacation */}
        <div>
          <FieldLabel>Vacation — freeze the streak</FieldLabel>
          <Seg
            value={mode}
            onChange={setMode}
            options={[
              { value: "range" as const, label: "Pick range" },
              { value: "open" as const, label: "Open-ended" },
            ]}
          />
          <p className="mt-1.5 text-[11px] font-medium text-fog-500">
            {usedThisYear}/{VACATION_LIMIT_PER_YEAR} vacation days used in {year}.
          </p>

          {openVac ? (
            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-sky-400/25 bg-sky-400/10 px-3.5 py-3">
              <div>
                <p className="text-[12.5px] font-extrabold text-sky-400">Open vacation running</p>
                <p className="text-[10.5px] font-medium text-fog-400">Since {openVac} — days freeze automatically.</p>
              </div>
              <button type="button" onClick={() => void app.endOpenVacation()} className="press rounded-full bg-sky-400/20 px-3 py-1.5 text-[11px] font-bold text-sky-400">
                End it
              </button>
            </div>
          ) : mode === "open" ? (
            <button
              type="button"
              onClick={() => void app.scheduleVacation(today, today, true)}
              className="press mt-2.5 w-full rounded-xl bg-sky-400/15 py-3.5 text-[13px] font-extrabold text-sky-400"
            >
              Start open vacation today
            </button>
          ) : (
            <>
              <div className="mt-2.5">
                <CalendarPicker value={selEnd ?? selStart ?? today} onChange={pick} />
              </div>
              <div className="mt-2.5 flex items-center gap-2.5">
                <p className="flex-1 text-[11.5px] font-semibold text-fog-400">
                  {selStart ? (selEnd ? `${selStart} → ${selEnd}` : `${selStart} → pick end`) : "Pick start day"}
                </p>
                <button
                  type="button"
                  disabled={!selStart}
                  onClick={() => void schedule()}
                  className="press rounded-xl bg-ember-500 px-4 py-2.5 text-[12px] font-extrabold text-ink-950 disabled:opacity-30"
                >
                  Schedule
                </button>
              </div>
            </>
          )}
          {err ? <p className="mt-2 text-[11.5px] font-bold text-coral-400">{err}</p> : null}

          {sortedVacations.length > 0 ? (
            <div className="mt-3 max-h-36 space-y-1 overflow-y-auto no-scrollbar">
              {sortedVacations.map((d) => (
                <div key={d} className="flex items-center justify-between rounded-lg bg-ink-800 px-3 py-2">
                  <p className="text-[12px] font-bold text-bone-100">{d}</p>
                  <button type="button" onClick={() => void app.removeVacationDay(d)} className="press text-fog-500" aria-label={`Remove ${d}`}>
                    <XIcon size={13} strokeWidth={2.4} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Settings */}
        <div className="space-y-2">
          <FieldLabel>Rules</FieldLabel>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800 px-3.5 py-3">
            <div>
              <p className="text-[12.5px] font-bold text-bone-100">Day cutoff</p>
              <p className="text-[10.5px] font-medium text-fog-500">When the day is judged.</p>
            </div>
            <input
              type="time"
              value={streakSettings.cutoffTime}
              onChange={(e) => void app.updateStreakSettings({ cutoffTime: e.target.value || "23:59" })}
              className="rounded-lg bg-ink-750 px-2.5 py-1.5 text-[13px] font-bold text-bone-50 outline-none"
            />
          </div>
          <Row label="Streak warnings" sub="Risk & final warnings" on={streakSettings.streakWarnings} onChange={(v) => void app.updateStreakSettings({ streakWarnings: v })} />
          <Row label="Task reminders" sub="5 min before timed tasks" on={streakSettings.taskReminders} onChange={(v) => void app.updateStreakSettings({ taskReminders: v })} />
          <Row label="Morning brief" sub="One nudge between 6–12" on={streakSettings.morningBrief} onChange={(v) => void app.updateStreakSettings({ morningBrief: v })} />
          <Row label="Evening check-in" sub="3 h before cutoff" on={streakSettings.eveningCheckin} onChange={(v) => void app.updateStreakSettings({ eveningCheckin: v })} />
          <Row label="Final warning" sub="30 min before cutoff" on={streakSettings.finalWarning} onChange={(v) => void app.updateStreakSettings({ finalWarning: v })} />
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-800 px-3.5 py-3">
            <div>
              <p className="text-[12.5px] font-bold text-bone-100">Quiet hours</p>
              <p className="text-[10.5px] font-medium text-fog-500">No notifications in this window.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={streakSettings.quietStart}
                onChange={(e) => void app.updateStreakSettings({ quietStart: e.target.value })}
                className="w-[86px] rounded-lg bg-ink-750 px-2 py-1.5 text-[12px] font-bold text-bone-50 outline-none"
              />
              <span className="text-[10px] text-fog-500">→</span>
              <input
                type="time"
                value={streakSettings.quietEnd}
                onChange={(e) => void app.updateStreakSettings({ quietEnd: e.target.value })}
                className="w-[86px] rounded-lg bg-ink-750 px-2 py-1.5 text-[12px] font-bold text-bone-50 outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
