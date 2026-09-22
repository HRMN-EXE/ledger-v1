"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { addMonths, monthGrid, monthLabel, monthShort, pad, sameMonth, todayISO } from "@/lib/dates";

const HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

export interface DayStats {
  open: number;
  done: number;
}

export type DayMark = "open" | "done";

function trimRows(cells: (string | null)[]): (string | null)[] {
  let out = cells;
  while (out.length >= 7 && out.slice(-7).every((c) => c === null)) {
    out = out.slice(0, out.length - 7);
  }
  return out;
}

export function CalendarPicker({
  value,
  onChange,
  min,
  marks,
}: {
  value: string;
  onChange: (day: string) => void;
  min?: string;
  /** per-day load: pending count tints the cell ember, fully-closed days glow mint */
  marks?: Map<string, DayStats>;
}) {
  const [anchor, setAnchor] = useState(value);
  const [view, setView] = useState<"month" | "year">("month");
  const today = todayISO();
  const cells = trimRows(monthGrid(anchor));
  const onToday = value === today && sameMonth(anchor, today);

  const jumpToday = () => {
    setAnchor(today);
    setView("month");
    onChange(today);
  };

  const step = view === "year" ? 12 : 1;

  const dayDot = (day: string, size: string) => {
    const locked = min != null && day < min;
    const stats = marks?.get(day);
    const open = stats?.open ?? 0;
    const done = stats?.done ?? 0;
    const selected = day === value;
    const isToday = day === today;
    const cls = selected
      ? "bg-bone-50"
      : locked
        ? "bg-white/[0.03]"
        : open > 0
          ? "bg-ember-500/80"
          : done > 0
            ? "bg-mint-500/80"
            : day < today
              ? "bg-white/5"
              : "bg-white/10";
    return (
      <button
        key={day}
        type="button"
        disabled={locked}
        onClick={() => onChange(day)}
        aria-label={day}
        className={`${size} rounded-[4px] ${cls} ${isToday && !selected ? "ring-1 ring-inset ring-ember-500" : ""} ${
          locked ? "" : "press"
        }`}
      />
    );
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-ink-800 p-3">
      {/* nav */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          className="press rounded-full p-1.5 text-fog-400"
          onClick={() => setAnchor(addMonths(anchor, -step))}
          aria-label="Previous"
        >
          <ChevronLeftIcon size={16} strokeWidth={2.2} />
        </button>
        <p className="font-display text-[13px] font-bold text-bone-50">
          {view === "year" ? anchor.slice(0, 4) : monthLabel(anchor)}
        </p>
        <button
          type="button"
          className="press rounded-full p-1.5 text-fog-400"
          onClick={() => setAnchor(addMonths(anchor, step))}
          aria-label="Next"
        >
          <ChevronRightIcon size={16} strokeWidth={2.2} />
        </button>
      </div>

      {/* view toggles + today */}
      <div className="mb-1.5 flex items-center justify-between px-1">
        <div className="flex gap-1">
          {(["month", "year"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`press rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                view === v ? "border-ember-500/40 bg-ember-500/10 text-ember-400" : "border-white/10 bg-ink-750 text-fog-400"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={jumpToday}
          aria-label="Jump back to today"
          className={`press rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
            onToday && view === "month"
              ? "border-ember-500/40 bg-ember-500/10 text-ember-400"
              : "border-white/10 bg-ink-750 text-bone-100"
          }`}
        >
          Today
        </button>
      </div>

      <div key={`${anchor}-${view}`} className="animate-fade-in">
        {view === "month" ? (
          <div className="grid grid-cols-7">
            {HEADERS.map((h, i) => (
              <div key={i} className="pb-2 text-center text-[10px] font-bold uppercase text-fog-600">
                {h}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="h-12" />;
              const locked = min != null && day < min;
              const past = day < today;
              const selected = day === value;
              const isToday = day === today;
              const stats = marks?.get(day);
              const open = stats?.open ?? 0;
              const done = stats?.done ?? 0;

              const tint = selected
                ? ""
                : open >= 3
                  ? "bg-ember-500/[0.18]"
                  : open === 2
                    ? "bg-ember-500/[0.12]"
                    : open === 1
                      ? "bg-ember-500/[0.07]"
                      : done > 0
                        ? "bg-mint-500/[0.08]"
                        : "";

              return (
                <div key={i} className="flex justify-center py-1">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => onChange(day)}
                    className={`press flex h-12 w-full flex-col items-center justify-center gap-1 rounded-xl font-display text-[15px] font-bold transition-colors ${tint} ${
                      selected
                        ? "bg-bone-50 text-ink-950 shadow-[0_10px_28px_-10px_rgba(245,242,234,0.35)]"
                        : locked
                          ? "text-fog-600/30"
                          : past
                            ? "text-fog-600/70"
                            : "text-bone-100"
                    } ${isToday && !selected ? "ring-1 ring-inset ring-ember-500/40" : ""}`}
                  >
                    {Number(day.slice(8, 10))}
                    {selected ? (
                      open || done || isToday ? (
                        <span className="size-1 rounded-full bg-ink-950/60" />
                      ) : (
                        <span className="size-1" />
                      )
                    ) : open > 1 ? (
                      <span className="font-display text-[7.5px] font-extrabold leading-none text-ember-400">{open}</span>
                    ) : open === 1 ? (
                      <span className="size-1 rounded-full bg-ember-500" />
                    ) : done > 0 ? (
                      <span className="size-1 rounded-full bg-mint-500" />
                    ) : isToday ? (
                      <span className="size-1 rounded-full bg-ember-400" />
                    ) : (
                      <span className="size-1" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, m) => {
              const iso = `${anchor.slice(0, 4)}-${pad(m + 1)}-01`;
              const mCells = trimRows(monthGrid(iso));
              return (
                <div key={m} className="rounded-xl border border-white/5 bg-ink-750/60 p-2">
                  <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-[0.14em] text-fog-500">
                    {monthShort(iso)}
                  </p>
                  <div className="grid grid-cols-7 gap-[2px]">
                    {mCells.map((day, i) => (day ? dayDot(day, "size-[9px]") : <span key={i} className="size-[9px]" />))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {marks ? (
        <div className="mt-1.5 flex items-center justify-center gap-4 border-t border-white/5 pt-2">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-fog-500">
            <span className="size-1.5 rounded-full bg-ember-500" /> pending
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-fog-500">
            <span className="size-1.5 rounded-full bg-mint-500" /> closed
          </span>
        </div>
      ) : null}
    </div>
  );
}
