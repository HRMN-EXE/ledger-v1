"use client";

import { useRef, useState } from "react";
import type { TaskSheetState } from "@/components/app-context";
import { useApp } from "@/components/app-context";
import { DayBar } from "@/components/day-bar";
import { PencilIcon, TrashIcon, XIcon } from "@/components/icons";
import { FieldLabel, Seg, Sheet } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { PRIORITY_META, type Priority } from "@/lib/types";

export function TaskSheet({ state, onClose }: { state: TaskSheetState; onClose: () => void }) {
  if (!state) return null;
  return (
    <TaskSheetInner
      key={state.mode === "edit" ? `edit-${state.task.id}` : `create-${state.day}`}
      state={state}
      onClose={onClose}
    />
  );
}

function TaskSheetInner({ state, onClose }: { state: Exclude<TaskSheetState, null>; onClose: () => void }) {
  const app = useApp();
  const editing = state.mode === "edit" ? state.task : null;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [day, setDay] = useState(editing?.day ?? (state.mode === "create" ? state.day : ""));
  const [time, setTime] = useState(editing?.time ?? "");
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? 2);
  const [tag, setTag] = useState(editing?.tag ?? "personal");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [editTags, setEditTags] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(editing?.deadline ?? null);
  const [deadlineError, setDeadlineError] = useState(false);
  const deadlineRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRitualTask = editing?.ritualInstanceId != null;

  const save = async () => {
    if (!title.trim()) {
      setError("Give it a title.");
      return;
    }
    if (priority === 2 && !deadline) {
      setDeadlineError(true);
      setError("A should task needs a deadline before it can be saved.");
      deadlineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await app.updateTask(editing.id, {
          title: title.trim(),
          day,
          time: time || null,
          priority,
          tag,
          notes,
          deadline: priority === 2 ? deadline : null,
        });
      } else {
        await app.addTask({
          title: title.trim(),
          day,
          time: time || null,
          priority,
          tag,
          notes,
          deadline: priority === 2 ? deadline : null,
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    try {
      await app.deleteTask(editing.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
    }
  };

  const submitNewTag = async () => {
    const clean = newTag.trim();
    if (!clean) {
      setAddingTag(false);
      setNewTag("");
      return;
    }
    const created = await app.addTag(clean);
    if (created) setTag(created);
    setNewTag("");
    setAddingTag(false);
  };

  const removeTag = (name: string) => {
    const remaining = app.data.tags.filter((t) => t.name !== name).map((t) => t.name);
    if (tag === name) setTag(remaining[0] ?? "personal");
    void app.deleteTag(name);
  };

  return (
    <Sheet open title={editing ? "Edit task" : "Create task"} onClose={onClose}>
      <div className="space-y-5">
        {error ? (
          <p className="animate-rise rounded-xl bg-coral-400/10 px-3 py-2 text-[12px] font-bold text-coral-400">{error}</p>
        ) : null}

        <div>
          <FieldLabel>Title</FieldLabel>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
            placeholder="What needs doing?"
            className="w-full rounded-2xl bg-ink-750 px-4 py-4 text-[16px] font-semibold text-bone-50 outline-none ring-ember-500/70 placeholder:text-fog-600 focus:ring-2"
          />
        </div>

        <DayBar value={day} onChange={setDay} min={editing ? undefined : todayISO()} />

        <div>
          <FieldLabel>Time (optional — arms the alarm)</FieldLabel>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-2xl bg-ink-750 px-4 py-3.5 text-[14px] font-semibold text-bone-100 outline-none ring-ember-500/70 focus:ring-2"
          />
        </div>

        <div>
          <FieldLabel>Priority</FieldLabel>
          <Seg
            value={priority}
            onChange={setPriority}
            options={[
              { value: 1 as Priority, label: PRIORITY_META[1].label, dot: PRIORITY_META[1].dot },
              { value: 2 as Priority, label: PRIORITY_META[2].label, dot: PRIORITY_META[2].dot },
              { value: 3 as Priority, label: PRIORITY_META[3].label, dot: PRIORITY_META[3].dot },
            ]}
          />
          <p className="mt-1.5 text-[11px] font-medium text-fog-500">Must & should count toward your streak.</p>
        </div>

        {priority === 2 ? (
          <div
            ref={deadlineRef}
            className={`animate-rise rounded-2xl transition-shadow ${
              deadlineError ? "p-1 ring-2 ring-coral-400 shadow-[0_0_30px_-8px_rgba(255,122,107,0.5)]" : ""
            }`}
          >
            <FieldLabel>Deadline — required for should</FieldLabel>
            <DayBar value={deadline} onChange={(d) => { setDeadline(d); setDeadlineError(false); }} min={todayISO()} />
            {deadlineError ? (
              <p className="mt-1.5 text-[11px] font-bold text-coral-400">
                This is compulsory: every should needs a deadline. Pick the last day it may ride — on that day it becomes a must.
              </p>
            ) : (
              <p className="mt-1.5 text-[10.5px] font-medium text-fog-500">
                Choose the final day this should may ride. Until then it can be carried; on the day itself it escalates to a must — and musts never carry.
              </p>
            )}
          </div>
        ) : null}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog-500">Tag</p>
            <button
              type="button"
              onClick={() => setEditTags(!editTags)}
              aria-label={editTags ? "Done editing tags" : "Edit tags"}
              className={`press rounded-full p-1.5 ${editTags ? "bg-ember-500/15 text-ember-400" : "text-fog-600"}`}
            >
              <PencilIcon size={12} strokeWidth={2.2} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {app.data.tags.map((t) => (
              <span
                key={t.name}
                className={`flex items-center overflow-hidden rounded-full ${
                  tag === t.name ? "bg-ember-500 text-ink-950" : "bg-ink-750 text-fog-400"
                }`}
              >
                <button type="button" onClick={() => setTag(t.name)} className="press px-3 py-1.5 text-[11.5px] font-bold">
                  {t.name}
                </button>
                {editTags ? (
                  <button
                    type="button"
                    aria-label={`Delete tag ${t.name}`}
                    onClick={() => removeTag(t.name)}
                    className={`-ml-1 pr-2 ${tag === t.name ? "text-ink-950/60" : "text-fog-600"}`}
                  >
                    <XIcon size={10} strokeWidth={2.6} />
                  </button>
                ) : null}
              </span>
            ))}
            {addingTag ? (
              <input
                autoFocus
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitNewTag();
                  if (e.key === "Escape") {
                    setAddingTag(false);
                    setNewTag("");
                  }
                }}
                onBlur={() => void submitNewTag()}
                placeholder="tag name · Enter"
                className="w-28 rounded-full bg-ink-750 px-3 py-1.5 text-[11.5px] font-bold text-bone-50 outline-none ring-ember-500/70 placeholder:text-fog-600 focus:ring-2"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingTag(true)}
                className="press rounded-full border border-dashed border-white/15 px-3 py-1.5 text-[11.5px] font-bold text-fog-500"
              >
                + new
              </button>
            )}
          </div>
        </div>

        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional context…"
            className="w-full resize-none rounded-xl bg-ink-750 px-4 py-3 text-[13.5px] font-medium text-bone-100 outline-none ring-ember-500/70 placeholder:text-fog-600 focus:ring-2"
          />
        </div>

        {isRitualTask ? (
          <p className="text-[11px] font-medium text-fog-500">
            Ritual task — managed from the Rituals tab. Completes on its due date.
          </p>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="press w-full rounded-2xl bg-ember-500 py-4 text-[15px] font-extrabold text-ink-950 disabled:opacity-40"
        >
          {editing ? "Save changes" : "Create task"}
        </button>

        {editing && !editing.done && !isRitualTask ? (
          <button
            type="button"
            onClick={() => void remove()}
            className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-[13px] font-bold text-coral-400"
          >
            <TrashIcon size={14} strokeWidth={2.2} />
            Delete task
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}
