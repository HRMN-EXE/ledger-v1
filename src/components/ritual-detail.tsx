"use client";

import { useApp } from "@/components/app-context";
import { FlameIcon } from "@/components/icons";
import { Sheet } from "@/components/ui";
import { fmtShort, fmtTime, weekdayLetter } from "@/lib/dates";
import { commitmentStatusLabel, scheduleLabel, tenureLabel } from "@/lib/ritual-meta";
import { PRIORITY_META, tagClasses, type RitualDTO, type WeekCellState } from "@/lib/types";

const CELL_CLS: Record<WeekCellState, string> = {
  done: "border border-mint-500/40 bg-mint-500/25 text-mint-400",
  missed: "border border-coral-400/40 bg-coral-400/20 text-coral-400",
  vacation: "border border-lilac-400/30 bg-lilac-400/15 text-lilac-400",
  neutral: "border border-white/5 bg-white/5 text-fog-500",
  today: "border border-ember-500/60 bg-ember-500/20 text-ember-400",
  upcoming: "border border-white/10 bg-white/10 text-fog-400",
  none: "border border-dashed border-white/10 text-fog-600/50",
};

export function WeekStrip({ ritual }: { ritual: RitualDTO }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {ritual.week.days.map((cell) => (
        <div key={cell.day} className={`mx-auto grid size-9 place-items-center rounded-full text-[10px] font-bold ${CELL_CLS[cell.state]}`}>
          {weekdayLetter(cell.day)}
        </div>
      ))}
    </div>
  );
}

export function RitualDetailSheet({ ritual, onClose }: { ritual: RitualDTO | null; onClose: () => void }) {
  const app = useApp();
  if (!ritual) return null;

  const c = ritual.commitment;
  const status = c ? commitmentStatusLabel(c.status) : null;
  const progress = c && c.requiredDays > 0 ? c.activeDays / c.requiredDays : 0;

  const act = async (action: string, confirmMsg?: string, payload?: Record<string, unknown>) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    await app.ritualAction(ritual.id, action, payload);
    onClose();
  };

  return (
    <Sheet open title="Ritual" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink-750 text-[26px]">{ritual.icon}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[20px] font-bold text-bone-50">{ritual.name}</h3>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${tagClasses(ritual.category, app.data.tags)}`}>{ritual.category}</span>
              {status ? <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${status.cls}`}>{status.label}</span> : null}
            </div>
          </div>
        </div>

        {c ? (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fog-500">
                  Tenure — {tenureLabel(c.tenureValue, c.tenureUnit)}
                </p>
                <p className="text-[11px] font-bold text-fog-400">
                  {c.activeDays}/{c.requiredDays} days
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ember-300 to-ember-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
              <div className="mt-2.5 grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "required", value: String(c.requiredDays) },
                  { label: "active", value: String(c.activeDays) },
                  { label: "paused", value: String(c.pausedDays) },
                  { label: "left", value: String(c.remainingDays) },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-ink-800 px-1 py-2.5">
                    <p className="font-display text-[16px] font-bold text-bone-50">{s.value}</p>
                    <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-fog-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] font-medium text-fog-500">
                {c.complete
                  ? "Tenure complete. The ritual has been honored to the end."
                  : c.projectedCompletion
                    ? `Projected completion ${fmtShort(c.projectedCompletion)} — vacation pauses shift it day-for-day.`
                    : "Starts " + fmtShort(c.startDate)}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fog-500">
                This window — {ritual.week.done} of {ritual.week.target} honored
              </p>
              <WeekStrip ritual={ritual} />
            </div>
          </>
        ) : null}

        {ritual.schedule ? (
          <div className="rounded-xl bg-ink-800 px-3.5 py-3">
            <p className="text-[12.5px] font-bold text-bone-100">
              {scheduleLabel(ritual.schedule.type, ritual.schedule.config)}
              {ritual.schedule.config.time ? ` · ${fmtTime(ritual.schedule.config.time)}` : ""}
            </p>
            <p className="mt-0.5 text-[10.5px] font-medium text-fog-500">
              {PRIORITY_META[ritual.schedule.priority].label} priority · version {ritual.schedule.versionNo} · since{" "}
              {fmtShort(ritual.schedule.effectiveFrom)}
            </p>
          </div>
        ) : null}

        {ritual.history.length > 1 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fog-500">History</p>
            <div className="space-y-1.5">
              {ritual.history.map((h) => {
                const hs = commitmentStatusLabel(h.status);
                return (
                  <div key={h.id} className="flex items-center justify-between rounded-lg bg-ink-800 px-3 py-2">
                    <p className="text-[11.5px] font-bold text-bone-100">
                      Commitment #{h.no} · from {fmtShort(h.startDate)}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${hs.cls}`}>{hs.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {c?.status === "COMPLETE" ? (
          <div className="space-y-2">
            <p className="rounded-xl border border-mint-500/25 bg-mint-500/10 px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-mint-400">
              Sealed — completed rituals are read-only
            </p>
            <button
              type="button"
              onClick={() =>
                void act("renew", "Renew this ritual with a fresh commitment starting today?")
              }
              className="press w-full rounded-xl bg-ember-500/10 py-3 text-[12.5px] font-extrabold text-ember-400"
            >
              Renew for a new tenure
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              app.openRitualEdit(ritual.id);
            }}
            className="press rounded-xl bg-ink-750 py-3 text-[12.5px] font-extrabold text-bone-100"
          >
            Edit
          </button>
          {c?.status === "ACTIVE" ? (
            <button
              type="button"
              onClick={() => void act("end-early", "End this commitment early? The remaining tenure is released.")}
              className="press rounded-xl bg-coral-400/10 py-3 text-[12.5px] font-extrabold text-coral-400"
            >
              End early
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void act("renew", "Renew this ritual with a fresh commitment starting today?")}
              className="press flex items-center justify-center gap-1.5 rounded-xl bg-ember-500/10 py-3 text-[12.5px] font-extrabold text-ember-400"
            >
              <FlameIcon size={14} strokeWidth={2} />
              Renew
            </button>
          )}
          {c?.status === "ACTIVE" ? (
            <button
              type="button"
              onClick={() => void act("archive", "Archive this commitment? Future instances are cancelled.")}
              className="press rounded-xl bg-white/5 py-3 text-[12.5px] font-extrabold text-fog-400"
            >
              Archive
            </button>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Delete this ritual and all of its history? This can't be undone.")) return;
              await app.deleteRitual(ritual.id);
              onClose();
            }}
            className="press rounded-xl border border-coral-400/30 py-3 text-[12.5px] font-extrabold text-coral-400"
          >
            Delete
          </button>
        </div>
        )}
      </div>
    </Sheet>
  );
}
