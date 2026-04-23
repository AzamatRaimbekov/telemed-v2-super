import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  useTaskBoard,
  useCreateTask,
  useMoveTask,
  useDeleteTask,
  useUpdateTask,
  type StaffTask,
} from "@/features/tasks/api";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

const columns = [
  { key: "todo", label: "Сделать" },
  { key: "in_progress", label: "В работе" },
  { key: "review", label: "На проверке" },
  { key: "done", label: "Готово" },
] as const;

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

const priorityLabels: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

function TasksPage() {
  const [filterAssignee, setFilterAssignee] = useState<string | undefined>();
  const { data: board, isLoading } = useTaskBoard(filterAssignee);
  const createTask = useCreateTask();
  const moveTask = useMoveTask();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const [draggedTask, setDraggedTask] = useState<StaffTask | null>(null);
  const [inlineCol, setInlineCol] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragStart = (task: StaffTask) => setDraggedTask(task);

  const handleDrop = (targetStatus: string) => {
    if (draggedTask && draggedTask.status !== targetStatus) {
      moveTask.mutate({ id: draggedTask.id, status: targetStatus, sort_order: 0 });
    }
    setDraggedTask(null);
  };

  const handleInlineCreate = (status: string) => {
    if (!inlineTitle.trim()) {
      setInlineCol(null);
      return;
    }
    createTask.mutate({ title: inlineTitle.trim(), status });
    setInlineTitle("");
    setInlineCol(null);
  };

  const openInline = (colKey: string) => {
    setInlineCol(colKey);
    setInlineTitle("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Задачи</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Канбан-доска задач персонала
          </p>
        </div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const tasks = board?.[col.key] ?? [];
          return (
            <div
              key={col.key}
              className="bg-[var(--color-muted)] rounded-2xl p-3 min-h-[300px] flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  <span className="text-xs bg-[var(--color-surface)] text-[var(--color-text-tertiary)] px-2 py-0.5 rounded-full font-medium">
                    {tasks.length}
                  </span>
                </div>
                <button
                  onClick={() => openInline(col.key)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-tertiary)] hover:text-foreground transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>

              {/* Inline create */}
              {inlineCol === col.key && (
                <div className="mb-2">
                  <input
                    ref={inputRef}
                    value={inlineTitle}
                    onChange={(e) => setInlineTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInlineCreate(col.key);
                      if (e.key === "Escape") setInlineCol(null);
                    }}
                    onBlur={() => handleInlineCreate(col.key)}
                    placeholder="Название задачи..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}

              {/* Task cards */}
              <div className="flex-1 space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    className="bg-[var(--color-surface)] rounded-xl p-3 border border-border shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-snug flex-1">
                        {task.title}
                      </p>
                      <button
                        onClick={() => deleteTask.mutate(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-[var(--color-text-tertiary)] hover:text-destructive transition-all"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                        {priorityLabels[task.priority]}
                      </span>

                      {task.due_date && (
                        <span className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                            <rect width="18" height="18" x="3" y="4" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {new Date(task.due_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>

                    {task.assignee_name && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                          {task.assignee_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <span className="text-[11px] text-[var(--color-text-secondary)] truncate">
                          {task.assignee_name}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
