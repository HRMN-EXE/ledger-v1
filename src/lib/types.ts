// ─── Ledger shared types & meta ─────────────────────────────────────────────

export type Priority = 1 | 2 | 3;

export interface TaskDTO {
  id: number;
  title: string;
  notes: string;
  /** YYYY-MM-DD */
  day: string;
  /** HH:mm or null */
  time: string | null;
  /** 1 must · 2 should · 3 could */
  priority: Priority;
  tag: string;
  done: boolean;
  /** YYYY-MM-DDTHH:mm */
  doneAt: string | null;
  /** capped at CARRY_LIMIT */
  carries: number;
  missed: boolean;
  ritualInstanceId: number | null;
  ritualId: number | null;
  createdAt: string;
}

export interface TaskInput {
  title: string;
  day: string;
  time: string | null;
  priority: Priority;
  tag: string;
  notes: string;
}

export interface HabitDTO {
  id: number;
  name: string;
  icon: string;
  color: string;
  weekTarget: number;
}

export interface HabitInput {
  name: string;
  icon: string;
  color: string;
  weekTarget: number;
}

export interface HabitLogDTO {
  id: number;
  habitId: number;
  day: string;
}

export interface SessionDTO {
  id: number;
  label: string;
  durationMin: number;
  startedAt: string;
}

export interface IntentDTO {
  day: string;
  text: string;
}

export interface TagDTO {
  name: string;
  color: string;
}

// ─── Streak ─────────────────────────────────────────────────────────────────

export type RecordStatus = "PERFECT" | "MISSED" | "PROTECTED" | "NEUTRAL" | "INACTIVE" | "VACATION";

export interface StreakStateDTO {
  streak: number;
  longest: number;
  protections: number;
  perfectRun: number;
  giftClaimed: boolean;
  vacationOpenStart: string | null;
}

export interface DayRecordDTO {
  day: string;
  status: RecordStatus;
  streakAfter: number;
  note: string;
}

export interface StreakSettingsDTO {
  /** HH:mm */
  cutoffTime: string;
  streakWarnings: boolean;
  taskReminders: boolean;
  morningBrief: boolean;
  eveningCheckin: boolean;
  finalWarning: boolean;
  /** HH:mm or "" */
  quietStart: string;
  /** HH:mm or "" */
  quietEnd: string;
}

export const DEFAULT_STREAK_STATE: StreakStateDTO = {
  streak: 0,
  longest: 0,
  protections: 0,
  perfectRun: 0,
  giftClaimed: false,
  vacationOpenStart: null,
};

export const DEFAULT_STREAK_SETTINGS: StreakSettingsDTO = {
  cutoffTime: "23:59",
  streakWarnings: true,
  taskReminders: true,
  morningBrief: true,
  eveningCheckin: true,
  finalWarning: true,
  quietStart: "",
  quietEnd: "",
};

export const PROTECTION_MAX = 2;
export const PERFECT_RUN_TARGET = 15;
export const VACATION_LIMIT_PER_YEAR = 30;
export const CARRY_LIMIT = 2;

export interface StreakBundle {
  state: StreakStateDTO;
  records: DayRecordDTO[];
  vacationDays: string[];
  settings: StreakSettingsDTO;
}

// ─── Rituals ────────────────────────────────────────────────────────────────

export type ScheduleType = "daily" | "weekdays" | "days" | "every_n" | "monthly" | "flex_week";
export type TenureUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";
export type CommitmentStatus = "ACTIVE" | "COMPLETE" | "EARLY_EXIT" | "ARCHIVED";
export type VacationBehavior = "pause" | "continue";

export interface ScheduleConfig {
  /** weekday indexes, 0 = Monday … 6 = Sunday */
  days?: number[];
  every?: number;
  monthDay?: number;
  /** flex_week target per week */
  n?: number;
  time?: string | null;
}

export interface CommitmentDTO {
  id: number;
  no: number;
  tenureValue: number;
  tenureUnit: TenureUnit;
  startDate: string;
  status: CommitmentStatus;
  vacationBehavior: VacationBehavior;
  closeReason: string | null;
  closedAt: string | null;
  requiredDays: number;
  activeDays: number;
  pausedDays: number;
  remainingDays: number;
  projectedCompletion: string | null;
  complete: boolean;
}

export interface ScheduleDTO {
  versionId: number;
  versionNo: number;
  effectiveFrom: string;
  type: ScheduleType;
  config: ScheduleConfig;
  priority: Priority;
}

export type WeekCellState = "done" | "missed" | "vacation" | "neutral" | "today" | "upcoming" | "none";

export interface WeekCellDTO {
  day: string;
  state: WeekCellState;
}

export interface RitualDTO {
  id: number;
  name: string;
  icon: string;
  category: string;
  commitment: CommitmentDTO | null;
  history: CommitmentDTO[];
  schedule: ScheduleDTO | null;
  week: { days: WeekCellDTO[]; done: number; target: number };
}

// ─── App aggregate ──────────────────────────────────────────────────────────

export interface AppData {
  tasks: TaskDTO[];
  rituals: RitualDTO[];
  tags: TagDTO[];
  habits: HabitDTO[];
  logs: HabitLogDTO[];
  sessions: SessionDTO[];
  intent: IntentDTO | null;
  streak: StreakBundle;
}

// ─── Tags & priorities ──────────────────────────────────────────────────────
// Colour *tokens* live in `src/theme/theme.ts`; the data layer only knows names.

export const TAGS = ["work", "personal", "health", "learning", "home"];

export const TAG_PALETTE = ["ember", "sky", "lilac", "mint", "gold", "coral"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  1: "Must",
  2: "Should",
  3: "Could",
};

export const HABIT_ICONS = ["🏃", "📖", "🧘", "💧", "🌙", "✍️", "🎯", "🎨", "🥗", "☀️", "💪", "🧠"];

export const RITUAL_ICONS = [
  "🔥",
  "🧘",
  "📖",
  "🏃",
  "💧",
  "🌙",
  "✍️",
  "🎯",
  "💪",
  "🧠",
  "🥗",
  "☀️",
  "🎸",
  "🧹",
  "💊",
  "🙏",
];

export const RITUAL_CATEGORIES = ["personal", "work", "health", "learning", "home"];
