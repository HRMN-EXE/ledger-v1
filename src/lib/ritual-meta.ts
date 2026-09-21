// ─── Human labels for ritual schedules & commitments ────────────────────────

import { addDays, weekdayShort } from "@/lib/dates";
import { weekKey } from "@/lib/local-rituals";
import type { CommitmentStatus, ScheduleConfig, ScheduleType, TenureUnit } from "@/lib/types";

const WD_MONDAYS = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06", "2024-01-07"]; // Mon..Sun

export function scheduleLabel(type: ScheduleType, config: ScheduleConfig): string {
  switch (type) {
    case "daily":
      return "Every day";
    case "weekdays":
      return "Weekdays";
    case "days": {
      const days = (config.days ?? []).slice().sort((a, b) => a - b);
      if (days.length === 0) return "Pick days";
      return days.map((d) => weekdayShort(WD_MONDAYS[d]).slice(0, 3)).join(" · ");
    }
    case "every_n":
      return `Every ${Math.max(1, config.every ?? 1)} days`;
    case "monthly":
      return `Day ${config.monthDay ?? 1} each month`;
    case "flex_week":
      return `${Math.max(1, config.n ?? 1)}× per week`;
    default:
      return "—";
  }
}

export function tenureLabel(value: number, unit: TenureUnit): string {
  const u = unit === "DAY" ? "day" : unit === "WEEK" ? "week" : unit === "MONTH" ? "month" : "year";
  return `${value} ${u}${value === 1 ? "" : "s"}`;
}

export function commitmentStatusLabel(status: CommitmentStatus): { label: string; cls: string } {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", cls: "bg-ember-500/15 text-ember-400" };
    case "COMPLETE":
      return { label: "Complete", cls: "bg-mint-500/15 text-mint-400" };
    case "EARLY_EXIT":
      return { label: "Ended early", cls: "bg-coral-400/15 text-coral-400" };
    case "ARCHIVED":
      return { label: "Archived", cls: "bg-white/10 text-fog-400" };
  }
}

export function weekKeyOf(day: string): string {
  return weekKey(day);
}

export function addDaysIso(day: string, n: number): string {
  return addDays(day, n);
}
