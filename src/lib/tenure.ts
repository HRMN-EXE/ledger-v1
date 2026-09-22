// ─── Tenure clock: a commitment is a duration, not an end date ─────────────

import { addDays, fromISO, toISO } from "@/lib/dates";
import type { TenureUnit, VacationBehavior } from "@/lib/types";

export function diffDays(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}

/** Last calendar day of the period starting at `start` lasting value×unit. */
export function addCalendarPeriod(start: string, unit: TenureUnit, value: number): string {
  if (unit === "DAY") return addDays(start, value - 1);
  if (unit === "WEEK") return addDays(start, value * 7 - 1);
  const d = fromISO(start);
  if (unit === "MONTH") d.setMonth(d.getMonth() + value);
  else d.setFullYear(d.getFullYear() + value);
  return toISO(d);
}

export interface TenureClockInput {
  startDate: string;
  tenureValue: number;
  tenureUnit: TenureUnit;
  vacationBehavior: VacationBehavior;
  vacationSet: Set<string>;
  openStart: string | null;
  today: string;
}

export interface TenureClockResult {
  requiredDays: number;
  activeDays: number;
  pausedDays: number;
  remainingDays: number;
  complete: boolean;
  projectedCompletion: string | null;
}

function isVac(day: string, vacationSet: Set<string>, openStart: string | null): boolean {
  return vacationSet.has(day) || (openStart != null && day >= openStart);
}

export function tenureClock(input: TenureClockInput): TenureClockResult {
  const { startDate, tenureValue, tenureUnit, vacationBehavior, vacationSet, openStart, today } = input;
  const baseEnd = addCalendarPeriod(startDate, tenureUnit, tenureValue);
  const requiredDays = Math.max(1, diffDays(startDate, baseEnd) + 1);

  let pausedDays = 0;
  let futurePauseDays = 0;
  if (vacationBehavior === "pause") {
    for (let cursor = startDate; diffDays(cursor, baseEnd) >= 0 && diffDays(cursor, today) <= 0; cursor = addDays(cursor, 1)) {
      if (isVac(cursor, vacationSet, openStart)) pausedDays++;
    }
    for (const day of vacationSet) {
      if (day > today) futurePauseDays++;
    }
    if (openStart != null && openStart > today) futurePauseDays += 14; // open-ended: pad projection
  }

  const elapsed = startDate <= today ? diffDays(startDate, today) + 1 : 0;
  const activeDays = Math.max(0, elapsed - pausedDays);
  const remainingDays = Math.max(0, requiredDays - activeDays);
  const complete = activeDays >= requiredDays && elapsed > 0;
  const projectedCompletion = complete ? null : addDays(baseEnd, pausedDays + futurePauseDays);

  return { requiredDays, activeDays, pausedDays, remainingDays, complete, projectedCompletion };
}
