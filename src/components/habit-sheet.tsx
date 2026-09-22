"use client";

import { useState } from "react";
import { useApp } from "@/components/app-context";
import { FieldLabel, Seg, Sheet } from "@/components/ui";
import { HABIT_COLORS, HABIT_ICONS } from "@/lib/types";

const COLOR_KEYS = Object.keys(HABIT_COLORS);

export function HabitSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(HABIT_ICONS[0]);
  const [color, setColor] = useState(COLOR_KEYS[0]);
  const [weekTarget, setWeekTarget] = useState(3);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await app.addHabit({ name: name.trim(), icon, color, weekTarget });
      setName("");
      setIcon(HABIT_ICONS[0]);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="New habit" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <FieldLabel>Name</FieldLabel>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
            placeholder="e.g. Drink water"
            className="w-full rounded-2xl bg-ink-750 px-4 py-4 text-[16px] font-semibold text-bone-50 outline-none ring-ember-500/70 placeholder:text-fog-600 focus:ring-2"
          />
        </div>

        <div>
          <FieldLabel>Icon</FieldLabel>
          <div className="grid grid-cols-6 gap-1.5">
            {HABIT_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={`press grid size-11 place-items-center rounded-full text-[18px] ${icon === i ? "bg-ember-500/20 ring-2 ring-ember-500" : "bg-ink-750"}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Color</FieldLabel>
          <Seg
            value={color}
            onChange={setColor}
            options={COLOR_KEYS.map((c) => ({ value: c, label: c, dot: HABIT_COLORS[c].dot }))}
          />
        </div>

        <div>
          <FieldLabel>Target days per week</FieldLabel>
          <Seg
            value={weekTarget}
            onChange={setWeekTarget}
            options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
          />
        </div>

        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void save()}
          className="press w-full rounded-2xl bg-ember-500 py-4 text-[15px] font-extrabold text-ink-950 disabled:opacity-40"
        >
          Create habit
        </button>
      </div>
    </Sheet>
  );
}
