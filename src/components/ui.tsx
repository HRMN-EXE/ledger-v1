"use client";

import { useId, type ReactNode } from "react";
import { XIcon } from "@/components/icons";

// ─── Ring ───────────────────────────────────────────────────────────────────

export function Ring({
  value,
  size = 64,
  stroke = 6,
  tone = "ember",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  /** ember = in progress · mint = the whole day is closed */
  tone?: "ember" | "mint";
  children?: ReactNode;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`g${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            {tone === "mint" ? (
              <>
                <stop offset="0%" stopColor="#6fd6a8" />
                <stop offset="100%" stopColor="#46c28c" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#ffb238" />
                <stop offset="100%" stopColor="#ff6a2b" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} style={{ stroke: "var(--ring-track)" }} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-anim"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#g${id})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// ─── Labels & fields ────────────────────────────────────────────────────────

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-fog-500">{children}</span>
      {right}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog-500">{children}</p>;
}

// ─── Segmented control ──────────────────────────────────────────────────────

export interface SegOption<T extends string | number> {
  value: T;
  label: string;
  dot?: string;
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-ink-750 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`press flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11.5px] font-bold transition-colors ${
            value === o.value ? "bg-ink-700 text-bone-50" : "text-fog-500"
          }`}
        >
          {o.dot ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${o.dot}`} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Toggle ─────────────────────────────────────────────────────────────────

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-ember-500" : "bg-white/10"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-bone-50 transition-all ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

// ─── Bottom sheet (lives inside the phone shell) ────────────────────────────

export function Sheet({
  open,
  title,
  onClose,
  children,
  locked,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** while locked, backdrop taps and the X are ignored — decide first */
  locked?: boolean;
}) {
  if (!open) return null;
  return (
    <>
      <div
        className="absolute inset-0 z-40 animate-fade-in bg-black/65"
        onClick={() => {
          if (!locked) onClose();
        }}
      />
      <div className="absolute inset-x-0 bottom-0 z-50 max-h-[92%] animate-sheet-up overflow-y-auto no-scrollbar rounded-t-[28px] border-t border-white/10 bg-ink-850">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />
        <div className="flex items-center justify-between px-5 pb-1 pt-3">
          <h2 className="font-display text-[18px] font-bold text-bone-50">{title}</h2>
          {locked ? (
            <span className="rounded-full bg-ember-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-ember-400">
              resolve to close
            </span>
          ) : (
            <button type="button" onClick={onClose} aria-label="Close" className="press rounded-full bg-white/5 p-2 text-fog-400">
              <XIcon size={15} strokeWidth={2.2} />
            </button>
          )}
        </div>
        <div className="px-5 pb-8 pt-2">{children}</div>
      </div>
    </>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

export function EmptyState({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-ink-800/40 px-6 py-9 text-center">
      <p className="font-display text-[16px] font-bold text-bone-300">{title}</p>
      {sub ? <p className="mt-1 text-[12.5px] font-medium text-fog-500">{sub}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
