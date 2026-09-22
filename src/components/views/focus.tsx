"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useApp } from "@/components/app-context";
import { CheckIcon, PauseIcon, PlayIcon, ResetIcon } from "@/components/icons";
import { Ring, SectionLabel } from "@/components/ui";
import { notifySystem } from "@/lib/alarm";
import { fmtClock, pad, todayISO } from "@/lib/dates";
import { loadPrefs } from "@/lib/ui-prefs";

const ITEM = 40;
const PRESETS: { sec: number; label: string }[] = [
  { sec: 60, label: "1m" },
  { sec: 120, label: "2m" },
  { sec: 300, label: "5m" },
  { sec: 600, label: "10m" },
  { sec: 1800, label: "30m" },
  { sec: 3600, label: "1h" },
  { sec: 7200, label: "2h" },
];

function fmtTotal(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

function wrap(n: number, size: number): number {
  return ((n % size) + size) % size;
}

// ─── physics reel ───────────────────────────────────────────────────────────
// Custom pointer/wheel physics instead of a native scroll box:
//  · modular loop — scrolls up or down forever, no dead ends
//  · 8% friction (v *= 0.92): settles fast on light input, glides on hard flicks
//  · per-frame painting is imperative (refs) — React only re-renders on commit
//  · classic slot look: one neighbor above/below; full reel only while touching

function Reel({
  value,
  max,
  onChange,
  disabled,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const SIZE = max + 1;
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const posRef = useRef(value);
  const valueRef = useRef(value);
  const velRef = useRef(0);
  const rafRef = useRef(0);
  const idleRef = useRef(0);
  const dragRef = useRef<{ y: number; t: number } | null>(null);
  const fromInternalRef = useRef(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<Array<HTMLDivElement | null>>([]);

  valueRef.current = value;

  // imperative paint: per-frame work touches the DOM directly, never React
  const paint = () => {
    const pos = posRef.current;
    const c = Math.round(pos);
    const frac = pos - c;
    const isActive = activeRef.current;
    for (let i = 0; i < 3; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const k = i - 1;
      const dist = Math.abs(k - frac);
      const scale = Math.max(0.66, 1.5 - dist * 0.84);
      const nearOpacity = Math.max(0.05, 1 - dist * 0.35);
      el.style.transform = `translateY(${(k - frac) * ITEM + (128 - ITEM) / 2}px) scale(${scale})`;
      el.style.opacity = String(isActive ? nearOpacity : k === 0 ? 1 : 0);
      el.textContent = pad(wrap(c + k, SIZE));
    }
  };

  const wake = () => {
    activeRef.current = true;
    setActive(true);
    window.clearTimeout(idleRef.current);
  };
  const rest = () => {
    window.clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(() => {
      activeRef.current = false;
      setActive(false);
      paint();
    }, 2500);
  };

  const commitPos = (p: number) => {
    posRef.current = p;
    paint();
    const v = wrap(Math.round(p), SIZE);
    if (v !== valueRef.current) {
      fromInternalRef.current = true;
      onChange(v); // the only React state we touch per gesture
    }
  };

  const stopLoops = () => cancelAnimationFrame(rafRef.current);

  const glide = () => {
    stopLoops();
    let settle: { start: number; from: number; target: number } | null = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      if (!settle && Math.abs(velRef.current) < 0.05) {
        // settle exactly where the reel stopped — a nudge moves a nudge
        settle = { start: now, from: posRef.current, target: Math.round(posRef.current) };
      }
      if (settle) {
        const t = Math.min(1, (now - settle.start) / 320);
        const p = settle.from + (settle.target - settle.from) * ease(t);
        commitPos(p);
        if (t >= 1) {
          commitPos(settle.target);
          rest();
          return;
        }
      } else {
        // 8% friction — settles fast on light input, still glides on hard flicks
        velRef.current *= 0.92;
        commitPos(posRef.current + velRef.current);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  // wheel: non-passive native listener so we can own the gesture
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      wake();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // gentle sensitivity — velocity feeds the friction loop
      velRef.current = Math.max(-1.6, Math.min(1.6, velRef.current * 0.4 + px * 0.006));
      glide();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  // external sync (pills, steppers) snaps the reel; also paints on mount
  useLayoutEffect(() => {
    if (fromInternalRef.current) {
      fromInternalRef.current = false;
      return;
    }
    stopLoops();
    posRef.current = value;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(
    () => () => {
      stopLoops();
      window.clearTimeout(idleRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onPointerDown = (e: ReactPointerEvent) => {
    if (disabled) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { y: e.clientY, t: performance.now() };
    stopLoops();
    wake();
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || disabled) return;
    const dy = e.clientY - d.y;
    const now = performance.now();
    const dt = Math.max(8, now - d.t);
    d.y = e.clientY;
    d.t = now;
    const delta = -dy / ITEM;
    velRef.current = Math.max(-1.6, Math.min(1.6, delta * (16 / dt) * 0.9));
    commitPos(posRef.current + delta);
  };
  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (disabled) return;
    glide();
  };

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative h-[128px] w-14 cursor-grab touch-none active:cursor-grabbing ${disabled ? "pointer-events-none opacity-40" : ""}`}
    >
      {/* classic slot look: one neighbor above, one below */}
      {[-1, 0, 1].map((k) => (
        <div
          key={k}
          ref={(el) => {
            slotRefs.current[k + 1] = el;
          }}
          style={{
            height: ITEM,
            willChange: "transform",
            transition: active ? "none" : "opacity 0.35s ease, transform 0.35s ease",
          }}
          className={`absolute inset-x-0 top-0 grid place-items-center font-display text-[21px] font-bold tabular-nums ${
            k === 0 ? (active ? "text-ember-400" : "text-bone-50") : "text-fog-500"
          }`}
        />
      ))}
      {/* the reel dissolves into the dark at both ends */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: "var(--color-ink-900)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 12%, transparent 88%, black 100%)",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 12%, transparent 88%, black 100%)",
        }}
      />
    </div>
  );
}

// ─── view ───────────────────────────────────────────────────────────────────

export function FocusView() {
  const app = useApp();
  const today = todayISO();

  const [label, setLabel] = useState("Deep focus");
  const [min, setMin] = useState(() => loadPrefs().defaultFocusMin);
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(() => loadPrefs().defaultFocusMin * 60);
  const [isPaused, setIsPaused] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null);
  const finishedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const labelRef = useRef(label);
  labelRef.current = label;

  const focusTask = focusTaskId != null ? app.data.tasks.find((t) => t.id === focusTaskId) : undefined;
  const canFinish = focusTask != null && !focusTask.done;

  const totalSec = min * 60 + sec;
  const totalRef = useRef(totalSec);
  totalRef.current = totalSec;

  // Preset handed over from an alarm's "Focus" action.
  useEffect(() => {
    const preset = app.focusPreset;
    if (preset) {
      app.consumeFocusPreset();
      setLabel(preset.label);
      setMin(Math.min(120, preset.durationMin));
      setSec(0);
      setSecondsLeft(Math.min(120, preset.durationMin) * 60);
      setRunning(false);
      setEndsAt(null);
      setIsPaused(false);
      setFocusTaskId(preset.taskId ?? null);
      finishedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.focusPreset]);

  // while idle (and not paused), the reels arm the countdown.
  // paused keeps the frozen remainder until start/reset/dial-change.
  useEffect(() => {
    if (!running && endsAt == null && !isPaused) {
      setSecondsLeft(totalSec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSec, running, isPaused]);

  useEffect(() => {
    if (!running || endsAt == null) return;
    const iv = window.setInterval(() => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        setRunning(false);
        setEndsAt(null);
        void app.addSession(
          labelRef.current.trim() || "Focus",
          Math.max(1, Math.round(totalRef.current / 60)),
          totalRef.current
        );
        notifySystem("Focus complete", `${fmtTotal(totalRef.current)} logged. Ledger.`);
      }
    }, 250);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, endsAt]);

  const start = () => {
    finishedRef.current = false;
    const base = secondsLeft > 0 ? secondsLeft : totalSec;
    if (base <= 0) return;
    setEndsAt(Date.now() + base * 1000);
    setSecondsLeft(base);
    setIsPaused(false);
    startedAtRef.current = Date.now();
    setRunning(true);
  };

  // lap: log the elapsed slice without stopping the clock
  const lap = () => {
    if (!running || startedAtRef.current == null) {
      app.toast(sessionsToday.length > 0 ? `${sessionsToday.length} lap(s) today` : "Start the timer to log laps");
      return;
    }
    const elapsedSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    startedAtRef.current = Date.now();
    void app.addSession(`${(labelRef.current.trim() || "Focus")} · lap`, Math.max(1, Math.round(elapsedSec / 60)), elapsedSec);
  };

  // only live when this session was opened from a task; asks via the popup
  const markFinished = () => {
    if (!canFinish || !focusTask) return;
    app.requestFinishTask(focusTask);
  };

  const pause = () => {
    setRunning(false);
    setEndsAt(null);
    setIsPaused(true);
  };

  const reset = () => {
    setRunning(false);
    setEndsAt(null);
    setIsPaused(false);
    finishedRef.current = false;
    startedAtRef.current = null;
    setSecondsLeft(totalSec);
  };

  const nudge = (dir: 1 | -1) => {
    setIsPaused(false);
    const next = Math.min(120 * 60 + 60, Math.max(0, totalSec + dir * 60));
    setMin(Math.floor(next / 60));
    setSec(next % 60);
  };

  const applyPreset = (s: number) => {
    setIsPaused(false);
    setMin(Math.floor(s / 60));
    setSec(s % 60);
    if (!running) {
      setEndsAt(null);
      setSecondsLeft(s);
    }
  };

  const progress = totalSec > 0 ? 1 - secondsLeft / Math.max(totalSec, secondsLeft, 1) : 0;
  const sessionsToday = app.data.sessions.filter((s) => s.startedAt.startsWith(today));
  const minutesToday = sessionsToday.reduce((acc, s) => acc + s.durationMin, 0);

  return (
    <div className="animate-fade-in px-5 pb-40 pt-[max(20px,env(safe-area-inset-top))]">
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-fog-500">Focus</p>
      <h1 className="mt-1 font-display text-[24px] font-bold leading-tight text-bone-50">Own the hour</h1>

      <div className="mt-6 flex flex-col items-center">
        <Ring value={running || isPaused ? progress : 0} size={224} stroke={8}>
            {running || isPaused ? (
              <div className="text-center">
                <p className="font-display text-[46px] font-bold tabular-nums text-bone-50">{fmtTotal(secondsLeft)}</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-fog-500">{running ? "in session" : "paused"}</p>
              </div>
            ) : (
              <div className="flex items-center gap-0.5">
                <Reel value={min} max={120} onChange={setMin} disabled={running} />
                <span className="font-display text-[22px] font-bold text-fog-600">:</span>
                <Reel value={sec} max={60} onChange={setSec} disabled={running} />
              </div>
            )}
          </Ring>

        {/* − / + hug the bottom of the circle */}
        <div className="mt-3 flex w-[224px] items-center justify-between">
          <button
            type="button"
            onClick={() => nudge(-1)}
            disabled={running || totalSec === 0}
            aria-label="Minus one minute"
            className="press grid size-12 place-items-center rounded-full bg-ink-750 font-display text-[20px] font-bold text-fog-400 disabled:opacity-30"
          >
            −
          </button>
          <p className="font-display text-[13px] font-bold tabular-nums text-bone-100">
            {running || isPaused ? fmtTotal(secondsLeft) : fmtTotal(totalSec)}
          </p>
          <button
            type="button"
            onClick={() => nudge(1)}
            disabled={running}
            aria-label="Plus one minute"
            className="press grid size-12 place-items-center rounded-full bg-ink-750 font-display text-[20px] font-bold text-fog-400 disabled:opacity-30"
          >
            +
          </button>
        </div>

        {/* controls: reset · play · lap · finish tied task */}
        <div className="mt-4 flex items-center gap-2.5">
          <button type="button" onClick={reset} className="press grid size-12 place-items-center rounded-full bg-ink-750 text-fog-400" aria-label="Reset">
            <ResetIcon size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={running ? pause : start}
            disabled={!running && totalSec === 0}
            className="press grid size-16 place-items-center rounded-full bg-ember-500 text-ink-950 shadow-[0_14px_34px_-8px_rgba(255,106,43,0.55)] disabled:opacity-40"
            aria-label={running ? "Pause" : "Start"}
          >
            {running ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
          </button>
          <button
            type="button"
            onClick={lap}
            className="press grid size-12 place-items-center rounded-full bg-ink-750/70 text-fog-400"
            aria-label="Lap counter"
          >
            <span className="text-center font-display text-[10px] font-bold leading-tight">
              {sessionsToday.length}
              <br />
              LAPS
            </span>
          </button>
          <button
            type="button"
            onClick={() => void markFinished()}
            disabled={!canFinish}
            aria-label="Mark task as finished"
            className={`press grid size-12 place-items-center rounded-full ${
              canFinish
                ? "bg-mint-500 text-ink-950 shadow-[0_0_24px_rgba(70,194,140,0.45)]"
                : "bg-ink-750/50 text-fog-600 opacity-40"
            }`}
          >
            <CheckIcon size={18} strokeWidth={2.6} />
          </button>
        </div>
        <p className="mt-2 max-w-[260px] truncate text-center text-[10px] font-semibold text-fog-600">
          {focusTask
            ? canFinish
              ? `tied to "${focusTask.title}" — the check closes it out`
              : `"${focusTask.title}" is closed ✓`
            : "check lights up when a session comes from a task"}
        </p>

        {/* quick pills */}
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.sec}
              type="button"
              onClick={() => applyPreset(p.sec)}
              className={`press rounded-full border px-3 py-1.5 font-display text-[10.5px] font-bold transition-colors ${
                totalSec === p.sec
                  ? "border-ember-500/50 bg-ember-500/15 text-ember-400"
                  : "border-white/10 bg-ink-750 text-fog-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-5 w-full">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What are you focusing on?"
            className="w-full rounded-2xl bg-ink-750 px-4 py-3.5 text-center text-[14px] font-semibold text-bone-50 outline-none ring-ember-500/70 placeholder:text-fog-600 focus:ring-2"
          />
        </div>

      </div>

      <div className="mt-8">
        <SectionLabel right={<span className="text-[10.5px] font-bold text-fog-500">{minutesToday} min today</span>}>
          Logged sessions
        </SectionLabel>
        {sessionsToday.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-ink-800/40 px-4 py-4 text-center text-[12px] font-semibold text-fog-500">
            No sessions yet today. The clock is patient.
          </p>
        ) : (
          <div className="space-y-1.5">
            {sessionsToday.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-ink-800 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold text-bone-100">{s.label}</p>
                  <p className="text-[10.5px] font-semibold text-fog-500">started {fmtClock(s.startedAt)}</p>
                </div>
                <span className="rounded-full bg-ember-500/10 px-2.5 py-1 font-display text-[11px] font-bold tabular-nums text-ember-400">
                  {fmtTotal(s.durationSec ?? s.durationMin * 60)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
