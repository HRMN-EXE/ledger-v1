"use client";

import { useState } from "react";
import { CalendarPicker } from "@/components/calendar-picker";
import { CalendarIcon, ChevronRightIcon } from "@/components/icons";
import { fmtDateLongGB, todayISO, weekOf, weekdayLetter } from "@/lib/dates";

/**
 * The DAY bar: this week as seven tactile cells (past dates locked),
 * with a "Full calendar — any month, any year" expander underneath.
 */
export function DayBar({
  value,
  onChange,
  min,
}: {
  /** null = nothing chosen yet (no cell highlighted) */
  value: string | null;
  onChange: (day: string) => void;
  min?: string;
}) {
  const [fullOpen, setFullOpen] = useState(false);
  const today = todayISO();
  const week = weekOf(value ?? today);

  return (
    <div className="rounded-2xl border border-white/5 bg-ink-800 p-3.5">
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-fog-500">Day</p>
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-fog-600">
          {min ? "Past dates locked" : "Any day"}
        </p>
      </div>

      <p className="mt-2 font-display text-[16px] font-bold text-bone-50">{fmtDateLongGB(value ?? today)}</p>

      <div className="mt-2.5 grid grid-cols-7 gap-1.5">
        {week.map((day) => {
          const locked = min != null && day < min;
          const selected = value != null && day === value;
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              disabled={locked}
              onClick={() => onChange(day)}
              className={`press flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${
                selected
                  ? "border-transparent bg-bone-50 text-ink-950 shadow-[0_8px_24px_-8px_rgba(245,242,234,0.35)]"
                  : locked
                    ? "border-white/5 bg-ink-750/60 opacity-30"
                    : isToday
                      ? "border-ember-500/40 bg-ink-750 text-bone-100"
                      : "border-white/5 bg-ink-750 text-bone-100 hover:border-white/15"
              }`}
            >
              <span className={`text-[8.5px] font-bold uppercase ${selected ? "text-ink-950/50" : "text-fog-500"}`}>
                {weekdayLetter(day)}
              </span>
              <span className="font-display text-[14.5px] font-bold leading-none">{Number(day.slice(8, 10))}</span>
              {isToday ? (
                <span className={`text-[6.5px] font-extrabold uppercase tracking-[0.14em] ${selected ? "text-ink-950/60" : "text-ember-400"}`}>
                  now
                </span>
              ) : (
                <span className="h-[7px]" />
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setFullOpen(!fullOpen)}
        className="press mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-white/5 bg-ink-750/80 px-3.5 py-3"
      >
        <span className="text-ember-400">
          <CalendarIcon size={15} strokeWidth={2} />
        </span>
        <span className="flex-1 text-left text-[12.5px] font-semibold text-bone-100">Full calendar — any month, any year</span>
        <ChevronRightIcon size={14} strokeWidth={2.2} className={`text-fog-500 transition-transform ${fullOpen ? "rotate-90" : ""}`} />
      </button>

      {fullOpen ? (
        <div className="mt-2.5 animate-rise">
          <CalendarPicker value={value ?? today} onChange={onChange} min={min} />
        </div>
      ) : null}
    </div>
  );
}
