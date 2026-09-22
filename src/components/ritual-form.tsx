"use client";

import { useRef, useState } from "react";
import type { RitualFormState } from "@/components/app-context";
import { useApp } from "@/components/app-context";
import { FieldLabel, Seg, Sheet } from "@/components/ui";
import { HABIT_ICONS, TAGS, type RitualDTO, type ScheduleType, type TenureUnit } from "@/lib/types";

const ICON_CHOICES = [
  ...HABIT_ICONS,
  "🔥", "⚡", "🌊", "🎸", "🪴", "🧹", "💼", "🗣️", "🚿", "😴",
  "🙏", "🚶", "🏋️", "🎹", "📵", "💊", "🦷", "🌅", "🫁", "🧩",
];

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export function RitualFormSheet({
  state,
  ritual,
  onClose,
}: {
  state: Exclude<RitualFormState, null>;
  ritual: RitualDTO | null;
  onClose: () => void;
}) {
  const app = useApp();
  const editing = state.mode === "edit" && ritual;

  const [name, setName] = useState(editing ? ritual.name : "");
  const [icon, setIcon] = useState(editing ? ritual.icon : "🔥");
  const [category, setCategory] = useState(editing ? ritual.category : "personal");
  const [scheduleType, setScheduleType] = useState<ScheduleType>(editing ? ritual.schedule?.type ?? "daily" : "daily");
  const [days, setDays] = useState<number[]>(editing ? ritual.schedule?.config.days ?? [0, 2, 4] : [0, 2, 4]);
  const [every, setEvery] = useState(editing ? ritual.schedule?.config.every ?? 2 : 2);
  const [monthDay, setMonthDay] = useState(editing ? ritual.schedule?.config.monthDay ?? 1 : 1);
  const [n, setN] = useState(editing ? ritual.schedule?.config.n ?? 3 : 3);
  const [time, setTime] = useState(editing ? ritual.schedule?.config.time ?? "" : "");
  const [tenureValue, setTenureValue] = useState(editing ? String(ritual.commitment?.tenureValue ?? "") : "");
  const tenureRef = useRef<HTMLInputElement | null>(null);
  const [tenureUnit, setTenureUnit] = useState<TenureUnit>(editing ? ritual.commitment?.tenureUnit ?? "DAY" : "DAY");
  const [vacationBehavior, setVacationBehavior] = useState<"pause" | "continue">(
    editing ? ritual.commitment?.vacationBehavior ?? "pause" : "pause"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupWarn, setDupWarn] = useState<{ id: number; name: string } | null>(null);

  const buildConfig = (): Record<string, unknown> => {
    const config: Record<string, unknown> = { time: time || null };
    if (scheduleType === "days") config.days = days;
    if (scheduleType === "every_n") config.every = every;
    if (scheduleType === "monthly") config.monthDay = monthDay;
    if (scheduleType === "flex_week") config.n = n;
    return config;
  };

  const submit = async (force: boolean) => {
    if (!name.trim()) {
      setError("Give the ritual a name.");
      return;
    }
    if (scheduleType === "days" && days.length === 0) {
      setError("Pick at least one weekday.");
      return;
    }
    const tenure = Math.round(Number(tenureValue));
    if (!Number.isFinite(tenure) || tenure < 1 || tenure > 3650) {
      setError("Set the tenure — a ritual without a length is just a wish.");
      tenureRef.current?.focus();
      tenureRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setError(null);
    const input = {
      name: name.trim(),
      icon,
      category,
      priority: 1 as const, // rituals are always a must
      scheduleType,
      config: buildConfig(),
      tenureValue: tenure,
      tenureUnit,
      vacationBehavior,
    };
    try {
      if (editing && ritual) {
        await app.ritualAction(ritual.id, "edit", input);
        onClose();
      } else {
        const dup = await app.createRitual(input, force);
        if (dup) {
          setDupWarn(dup);
          setBusy(false);
        } else {
          onClose();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the ritual.");
      setBusy(false);
    }
  };

  return (
    <Sheet open title={editing ? "Edit ritual" : "New ritual"} onClose={onClose}>
      <div className="space-y-5">
        {error ? <p className="animate-rise rounded-xl bg-coral-400/10 px-3 py-2 text-[12px] font-bold text-coral-400">{error}</p> : null}
        {dupWarn ? (
          <div className="animate-rise rounded-xl border border-gold-400/30 bg-gold-400/10 px-3.5 py-3">
            <p className="text-[12.5px] font-extrabold text-gold-400">“{dupWarn.name}” is already active.</p>
            <p className="mt-0.5 text-[11px] font-medium text-fog-400">Two active rituals with the same name usually means trouble.</p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" onClick={() => void submit(true)} className="press rounded-lg bg-gold-400 px-3 py-1.5 text-[11.5px] font-extrabold text-ink-950">
                Create anyway
              </button>
              <button type="button" onClick={() => setDupWarn(null)} className="press rounded-lg bg-white/5 px-3 py-1.5 text-[11.5px] font-bold text-fog-400">
                Keep editing
              </button>
            </div>
          </div>
        ) : null}

        <div>
          <FieldLabel>Name</FieldLabel>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning pages"
            className="w-full rounded-2xl bg-ink-750 px-4 py-4 text-[16px] font-semibold text-bone-50 outline-none ring-ember-500/70 placeholder:text-fog-600 focus:ring-2"
          />
        </div>

        <div>
          <FieldLabel>Icon</FieldLabel>
          <div className="grid max-h-32 grid-cols-8 gap-1.5 overflow-y-auto no-scrollbar">
            {ICON_CHOICES.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={`press grid size-9 place-items-center rounded-full text-[16px] ${icon === i ? "bg-ember-500/20 ring-2 ring-ember-500" : "bg-ink-750"}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Category</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCategory(t)}
                className={`press rounded-full px-3 py-1.5 text-[11.5px] font-bold ${category === t ? "bg-ember-500 text-ink-950" : "bg-ink-750 text-fog-400"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <p className="rounded-xl bg-ember-500/10 px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ember-400">
          Rituals are always a must — they count toward the streak.
        </p>

        <div>
          <FieldLabel>Cadence</FieldLabel>
          <Seg
            value={scheduleType}
            onChange={setScheduleType}
            options={[
              { value: "daily" as ScheduleType, label: "Daily" },
              { value: "weekdays" as ScheduleType, label: "Wkdays" },
              { value: "days" as ScheduleType, label: "Days" },
              { value: "every_n" as ScheduleType, label: "Every N" },
              { value: "monthly" as ScheduleType, label: "Month" },
              { value: "flex_week" as ScheduleType, label: "Flex" },
            ]}
          />

          {scheduleType === "days" ? (
            <div className="mt-2.5 grid grid-cols-7 gap-1.5">
              {DAY_LETTERS.map((l, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()))}
                  className={`press rounded-lg py-2.5 text-[11px] font-bold ${days.includes(i) ? "bg-ember-500 text-ink-950" : "bg-ink-750 text-fog-500"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          ) : null}

          {scheduleType === "every_n" ? (
            <div className="mt-2.5 flex items-center gap-2.5">
              <p className="text-[12px] font-semibold text-fog-400">Every</p>
              <input
                type="number"
                min={1}
                value={every}
                onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 rounded-xl bg-ink-750 px-3 py-2.5 text-center text-[14px] font-bold text-bone-50 outline-none ring-ember-500/70 focus:ring-2"
              />
              <p className="text-[12px] font-semibold text-fog-400">day(s), starting day one.</p>
            </div>
          ) : null}

          {scheduleType === "monthly" ? (
            <div className="mt-2.5 flex items-center gap-2.5">
              <p className="text-[12px] font-semibold text-fog-400">On day</p>
              <input
                type="number"
                min={1}
                max={31}
                value={monthDay}
                onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                className="w-20 rounded-xl bg-ink-750 px-3 py-2.5 text-center text-[14px] font-bold text-bone-50 outline-none ring-ember-500/70 focus:ring-2"
              />
              <p className="text-[12px] font-semibold text-fog-400">of each month.</p>
            </div>
          ) : null}

          {scheduleType === "flex_week" ? (
            <div className="mt-2.5 flex items-center gap-2.5">
              <input
                type="number"
                min={1}
                max={7}
                value={n}
                onChange={(e) => setN(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
                className="w-20 rounded-xl bg-ink-750 px-3 py-2.5 text-center text-[14px] font-bold text-bone-50 outline-none ring-ember-500/70 focus:ring-2"
              />
              <p className="text-[12px] font-semibold text-fog-400">honors per week — any days you choose.</p>
            </div>
          ) : null}

          <div className="mt-2.5 flex items-center gap-2.5">
            <p className="text-[12px] font-semibold text-fog-400">At</p>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-xl bg-ink-750 px-3 py-2.5 text-[13px] font-bold text-bone-50 outline-none ring-ember-500/70 focus:ring-2"
            />
            <p className="text-[11px] font-medium text-fog-500">optional — arms the alarm</p>
          </div>
        </div>

        <div>
          <FieldLabel>Tenure — how long this commitment runs</FieldLabel>
          {editing ? (
            <p className="rounded-xl bg-ink-750 px-3.5 py-3 text-[12px] font-semibold text-fog-400">
              {ritual.commitment?.tenureValue} {ritual.commitment?.tenureUnit.toLowerCase()}(s) — tenure is locked; renew for a new commitment.
            </p>
          ) : (
            <div className="flex gap-2.5">
              <input
                ref={tenureRef}
                type="number"
                min={1}
                max={3650}
                placeholder="e.g. 21"
                value={tenureValue}
                onChange={(e) => setTenureValue(e.target.value)}
                className="w-24 rounded-xl bg-ink-750 px-3 py-2.5 text-center text-[14px] font-bold text-bone-50 outline-none ring-ember-500/70 placeholder:text-fog-600 focus:ring-2"
              />
              <div className="flex-1">
                <Seg
                  value={tenureUnit}
                  onChange={setTenureUnit}
                  options={[
                    { value: "DAY" as TenureUnit, label: "Days" },
                    { value: "WEEK" as TenureUnit, label: "Wks" },
                    { value: "MONTH" as TenureUnit, label: "Mos" },
                    { value: "YEAR" as TenureUnit, label: "Yrs" },
                  ]}
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <FieldLabel>During vacation</FieldLabel>
          <Seg
            value={vacationBehavior}
            onChange={setVacationBehavior}
            options={[
              { value: "pause" as const, label: "Pause tenure" },
              { value: "continue" as const, label: "Keep running" },
            ]}
          />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit(false)}
          className="press w-full rounded-2xl bg-ember-500 py-4 text-[15px] font-extrabold text-ink-950 disabled:opacity-40"
        >
          {editing ? "Save ritual" : "Create ritual"}
        </button>
      </div>
    </Sheet>
  );
}
