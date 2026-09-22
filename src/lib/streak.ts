// ─── Streak task helpers ────────────────────────────────────────────────────

import type { TaskDTO } from "@/lib/types";

/** Must or should tasks count toward the streak. */
export function isObligation(task: TaskDTO): boolean {
  return task.priority === 1 || task.priority === 2;
}

/** Unresolved tasks from past days — candidates for carry or miss. */
export function pendingCarryTasks(tasks: TaskDTO[], today: string): TaskDTO[] {
  return tasks.filter((t) => !t.done && !t.missed && t.day < today);
}
