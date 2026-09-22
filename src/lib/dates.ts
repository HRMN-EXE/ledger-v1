// ─── Kairos date helpers (all local-time, YYYY-MM-DD strings) ───────────────

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Monday-first 7-day week containing iso */
export function weekOf(iso: string): string[] {
  const d = fromISO(iso);
  const lead = (d.getDay() + 6) % 7;
  const monday = addDays(iso, -lead);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function weekdayMonIndex(iso: string): number {
  return (fromISO(iso).getDay() + 6) % 7;
}

export function weekdayLetter(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { weekday: "narrow" });
}

export function weekdayShort(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { weekday: "short" });
}

export function weekdayLong(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { weekday: "long" });
}

export function monthShort(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { month: "short" });
}

export function fmtFull(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function fmtShort(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dayNum(iso: string): number {
  return fromISO(iso).getDate();
}

export function yearOf(iso: string): number {
  return fromISO(iso).getFullYear();
}

/** "HH:mm" → 12h "2:30 PM" (minutes omitted when :00 → "2 PM") */
export function fmtTime(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh} ${ampm}` : `${hh}:${pad(m)} ${ampm}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Winding down";
}

/** local YYYY-MM-DDTHH:mm */
export function localDT(d: Date): string {
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" → 12h clock */
export function fmtClock(dt: string): string {
  return fmtTime(dt.slice(11, 16)) ?? dt;
}

/**
 * Live countdown for deadlines inside 24h (cutoff-aware), null when farther out.
 */
export function deadlineCountdown(deadline: string, cutoff: string, now: Date = new Date()): string | null {
  const due = fromISO(deadline);
  const [h, m] = (cutoff || "23:59").split(":").map(Number);
  due.setHours(h, m, 0, 0);
  const mins = Math.round((due.getTime() - now.getTime()) / 60000);
  if (mins <= 0) return "cutoff passed";
  if (mins > 24 * 60) return null;
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  if (hh === 0) return `${mm}m left`;
  return mm === 0 ? `${hh}h left` : `${hh}h ${mm}m left`;
}

/** "Saturday, 19 September 2026" */
export function fmtDateLongGB(iso: string): string {
  return `${weekdayLong(iso)}, ${fromISO(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
}

export function fmtLong(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function monthLabel(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function addMonths(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** 6-week Monday-first grid; null = outside month */
export function monthGrid(iso: string): (string | null)[] {
  const d = fromISO(iso);
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [];
  for (let i = 0; i < 42; i++) {
    const idx = i - lead;
    if (idx < 0) {
      cells.push(null);
      continue;
    }
    const dt = new Date(year, month, idx + 1);
    cells.push(dt.getMonth() === month ? toISO(dt) : null);
  }
  return cells;
}

/** Minutes from `now` until `day` at `time` (negative = past). */
export function minutesUntil(day: string, time: string, now: Date = new Date()): number {
  const due = fromISO(day);
  const [h, m] = time.split(":").map(Number);
  due.setHours(h, m, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 60000);
}

/** "45m" · "2h" · "2h 15m" · "3d 4h" */
export function fmtDelta(mins: number): string {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m}m`;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function relativeDayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  if (iso === addDays(today, -1)) return "Yesterday";
  return fmtShort(iso);
}
