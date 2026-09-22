"use client";

import { createContext, useContext } from "react";
import type { StreakStatus } from "@/lib/streak-engine";
import type {
  AppData,
  DayRecordDTO,
  HabitInput,
  RitualDTO,
  StreakSettingsDTO,
  StreakStateDTO,
  TaskDTO,
  TaskInput,
} from "@/lib/types";

export type TabId = "today" | "plan" | "focus" | "habits" | "stats";

export type TaskSheetState = { mode: "create"; day: string } | { mode: "edit"; task: TaskDTO } | null;

export type RitualFormState = { mode: "create" } | { mode: "edit"; ritualId: number } | null;

export interface RitualCreateInput {
  name: string;
  icon: string;
  category: string;
  priority: 1 | 2 | 3;
  scheduleType: string;
  config: Record<string, unknown>;
  tenureValue: number;
  tenureUnit: string;
  vacationBehavior: "pause" | "continue";
}

export interface FocusPreset {
  label: string;
  durationMin: number;
  /** when the session was opened from a task, so Focus can close it out */
  taskId?: number;
}

export interface TaskPatch {
  title?: string;
  notes?: string;
  day?: string;
  time?: string | null;
  priority?: 1 | 2 | 3;
  tag?: string;
  done?: boolean;
  missed?: boolean;
  carries?: number;
  deadline?: string | null;
}

export interface AppApi {
  data: AppData;
  profileName: string;
  openedOn: string;

  tab: TabId;
  setTab: (tab: TabId) => void;

  openTaskSheet: (day?: string) => void;
  editTaskSheet: (task: TaskDTO) => void;
  openHabitSheet: () => void;

  addTask: (input: TaskInput) => Promise<void>;
  updateTask: (id: number, patch: TaskPatch) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  /** complete a task directly (used by Focus when a session is tied to one) */
  finishTask: (id: number) => Promise<void>;
  /** Carry (or miss) every unfinished task from a past day, in one move. */
  resolveLeftovers: (day: string, mode: "carry" | "miss") => Promise<void>;

  addHabit: (input: HabitInput) => Promise<void>;
  deleteHabit: (id: number) => Promise<void>;
  toggleLog: (habitId: number, day: string) => Promise<void>;

  setIntent: (text: string) => Promise<void>;
  addSession: (label: string, durationMin: number, durationSec?: number) => Promise<void>;
  /** ask the close-out popup from anywhere (Focus ties to its task) */
  requestFinishTask: (task: TaskDTO) => void;
  openSettings: () => void;
  /** restart the guided tour */
  replayTour: () => void;
  toast: (text: string) => void;
  addTag: (name: string) => Promise<string | null>;
  deleteTag: (name: string) => Promise<void>;

  streakState: StreakStateDTO;
  records: DayRecordDTO[];
  vacationDays: Set<string>;
  streakSettings: StreakSettingsDTO;
  status: StreakStatus;
  openStreakSheet: () => void;
  scheduleVacation: (start: string, end: string, openEnded: boolean) => Promise<string | null>;
  removeVacationDay: (day: string) => Promise<void>;
  endOpenVacation: () => Promise<void>;
  updateStreakSettings: (patch: Partial<StreakSettingsDTO>) => Promise<void>;

  focusPreset: FocusPreset | null;
  consumeFocusPreset: () => void;

  rituals: RitualDTO[];
  openRitualCreate: () => void;
  openRitualEdit: (ritualId: number) => void;
  openRitualDetail: (ritual: RitualDTO) => void;
  createRitual: (input: RitualCreateInput, force?: boolean) => Promise<{ id: number; name: string } | null>;
  ritualAction: (ritualId: number, action: string, payload?: Record<string, unknown>) => Promise<void>;
  deleteRitual: (ritualId: number) => Promise<void>;
  syncRituals: () => Promise<void>;
}

export const AppCtx = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppCtx.Provider");
  return ctx;
}
