"use client";

import { createContext, useContext, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Eraser,
  FileText,
  FolderPlus,
  Plus,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { InlineEditable } from "@lockin/shared/Components/Shared/InlineEditable";
import { IconPicker } from "@lockin/shared/Components/Shared/IconPicker";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { ProgressBar, UseNow } from "./SessionView";
import {
  CurrentTask,
  FOCUS_COLUMNS,
  FormatMinutes,
  SpentSec,
  UseFocusStore,
  type DropTarget,
  type ImportedTask,
  type FocusColumn,
  type FocusGroup,
  type FocusTask,
} from "@lockin/shared/Store/UseFocusStore";

const COLUMN_LABEL: Record<FocusColumn, string> = { backlog: "Backlog", week: "This week", today: "Today" };
const ESTIMATES = [15, 30, 45, 60, 90, 120, 180];

/** Co se táhne: existující karta, nebo výsledek hledání k importu. */
export type DragPayload = { taskId: string } | { items: ImportedTask[]; list?: { id: string; title: string } };

interface DragState {
  /** ID tažené karty; "import" při tažení výsledku hledání; null = netáhne se. */
  draggingId: string | null;
  target: DropTarget | null;
  StartDrag: (event: ReactPointerEvent<HTMLElement>, payload: DragPayload) => void;
}
const DragContext = createContext<DragState>({ draggingId: null, target: null, StartDrag: () => {} });

export const UseFocusDrag = () => useContext(DragContext);

function Drop(payload: DragPayload, target: DropTarget) {
  const store = UseFocusStore.getState();
  if ("taskId" in payload) return store.DropTask(payload.taskId, target);
  store.ImportTasks(payload.items, target.column, payload.list);
  const { tasks, groups } = UseFocusStore.getState();
  if (payload.list) {
    // List už mohl mít skupinu z dřívějška v jiném sloupci — přesune se sem.
    const group = groups.find((g) => g.sourceListId === payload.list!.id);
    if (group && group.column !== target.column) store.MoveGroup(group.id, target.column);
  } else {
    const task = tasks.find((t) => t.source?.key === payload.items[0]?.source.key);
    if (task) store.DropTask(task.id, target);
  }
}

/** Kam by se úkol pustil, podle toho, co je pod kurzorem: karta (před/za ni
 * podle poloviny výšky), jinak prázdné místo skupiny/sloupce (na konec). */
function TargetAt(x: number, y: number, draggedId: string): DropTarget | null {
  const el = document.elementFromPoint(x, y);
  const card = el?.closest<HTMLElement>("[data-task-id]");
  if (card) {
    if (card.dataset.taskId === draggedId) return null;
    const rect = card.getBoundingClientRect();
    return {
      column: card.dataset.column as FocusColumn,
      groupId: card.dataset.groupId || undefined,
      anchorId: card.dataset.taskId!,
      after: y > rect.top + rect.height / 2,
    };
  }
  const zone = el?.closest<HTMLElement>("[data-drop-column]");
  if (!zone) return null;
  return { column: zone.dataset.dropColumn as FocusColumn, groupId: zone.dataset.dropGroup || undefined, anchorId: null, after: false };
}

/** Klon karty, který jede s kurzorem — stejný princip jako CreateTaskDragPreview
 * v TodoListView.tsx (nativní HTML5 drag v Tauri okně spolehlivě nefunguje). */
function CreateDragPreview(source: HTMLElement, grabX: number, grabY: number) {
  const rect = source.getBoundingClientRect();
  const clone = source.cloneNode(true) as HTMLElement;
  clone.className = `${source.className} task-drag-preview`;
  Object.assign(clone.style, { position: "fixed", width: `${rect.width}px`, margin: "0", borderRadius: "12px", rotate: "1.5deg" });
  document.body.appendChild(clone);
  const Update = (x: number, y: number) => {
    clone.style.left = `${x - (grabX - rect.left)}px`;
    clone.style.top = `${y - (grabY - rect.top)}px`;
  };
  Update(grabX, grabY);
  return { Update, Remove: () => clone.remove() };
}

/** Drag & drop pro board i vyhledávání nad ním — obaluje obojí. */
export function FocusDragProvider({ children }: { children: ReactNode }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const targetRef = useRef<DropTarget | null>(null);

  function StartDrag(event: ReactPointerEvent<HTMLElement>, payload: DragPayload) {
    if (event.button !== 0) return;
    event.preventDefault(); // jinak by tažení začalo označovat text
    const draggedId = "taskId" in payload ? payload.taskId : "import";
    const source = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    let preview: ReturnType<typeof CreateDragPreview> | null = null;

    function OnMove(e: PointerEvent) {
      if (!preview) {
        // Pár pixelů tolerance, ať obyčejný klik nezačne drag.
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
        preview = CreateDragPreview(source, startX, startY);
        document.body.style.cursor = "grabbing";
        setDraggingId(draggedId);
      }
      preview.Update(e.clientX, e.clientY);
      targetRef.current = TargetAt(e.clientX, e.clientY, draggedId);
      setTarget(targetRef.current);
    }
    function End(commit: boolean) {
      window.removeEventListener("pointermove", OnMove);
      window.removeEventListener("pointerup", OnUp);
      window.removeEventListener("pointercancel", Cancel);
      window.removeEventListener("blur", Cancel);
      if (preview) {
        preview.Remove();
        document.body.style.cursor = "";
        if (commit && targetRef.current) Drop(payload, targetRef.current);
      }
      targetRef.current = null;
      setTarget(null);
      setDraggingId(null);
    }
    const OnUp = () => End(true);
    // Alt+Tab / ztráta fokusu uprostřed tažení: zahodit, nic nepřesouvat.
    const Cancel = () => End(false);
    window.addEventListener("pointermove", OnMove);
    window.addEventListener("pointerup", OnUp);
    window.addEventListener("pointercancel", Cancel);
    window.addEventListener("blur", Cancel);
  }

  return (
    <DragContext.Provider value={{ draggingId, target, StartDrag }}>
      <div className={`h-full ${draggingId ? "select-none" : ""}`}>{children}</div>
    </DragContext.Provider>
  );
}

export function FocusBoard({ todayFooter }: { todayFooter?: ReactNode }) {
  return (
    // Úzké okno: board scrolluje do strany sám (stránka kolem se do stran nehýbe).
    <div className="flex min-w-0 flex-1 items-start gap-4 overflow-x-auto pb-1">
      {FOCUS_COLUMNS.map((column) => (
        <Column key={column} column={column}>
          {column === "today" && todayFooter}
        </Column>
      ))}
    </div>
  );
}

function IconAction({
  label,
  onPress,
  children,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      isIconOnly
      isDisabled={disabled}
      aria-label={label}
      onPress={onPress}
      className={`h-6 w-6 min-w-0 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.05] ${
        danger ? "hover:text-[#e5484d]" : "hover:text-[var(--lk-ink)]"
      }`}
    >
      {children}
    </Button>
  );
}

function Column({ column, children }: { column: FocusColumn; children?: ReactNode }) {
  const tasks = UseFocusStore((s) => s.tasks);
  const allGroups = UseFocusStore((s) => s.groups);
  const { AddTask, AddGroup, ClearColumn } = UseFocusStore.getState();
  const { target, draggingId } = useContext(DragContext);

  const groups = allGroups.filter((g) => g.column === column);
  const own = tasks.filter((t) => t.column === column);
  const ungrouped = own.filter((t) => !t.groupId || !groups.some((g) => g.id === t.groupId));
  const done = own.filter((t) => t.done).length;
  const estimate = own.filter((t) => !t.done).reduce((sum, t) => sum + (t.estimateMin ?? 0), 0);
  const isEndTarget = draggingId && target?.column === column && !target.groupId && !target.anchorId;

  return (
    <div
      data-drop-column={column}
      className={`flex min-w-[280px] flex-1 flex-col gap-2 rounded-2xl p-2 ring-1 transition-colors ${
        column === "today" ? "bg-[#0088ff]/[0.06] ring-[#0088ff]/20" : "bg-[var(--lk-panel)] ring-black/[0.04]"
      } ${isEndTarget ? "ring-2 ring-[#0088ff]/50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 px-1.5 pt-1">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-semibold tracking-[-0.3px] text-black">{COLUMN_LABEL[column]}</p>
          <span className="rounded-full bg-black/[0.05] px-1.5 text-[11px] font-medium tabular-nums text-[var(--lk-text2)]">
            {own.length - done}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {estimate > 0 && <span className="mr-1 text-xs text-[var(--lk-muted)]">{FormatMinutes(estimate)}</span>}
          <IconAction label={`Add group to ${COLUMN_LABEL[column]}`} onPress={() => AddGroup(column)}>
            <FolderPlus size={14} />
          </IconAction>
          <Popover
            align="right"
            panelClassName="w-52 p-1"
            trigger={() => (
              <Button
                variant="ghost"
                isIconOnly
                isDisabled={own.length === 0 && groups.length === 0}
                aria-label={`Clear ${COLUMN_LABEL[column]}`}
                className="h-6 w-6 min-w-0 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.05] hover:text-[var(--lk-ink)]"
              >
                <Eraser size={14} />
              </Button>
            )}
          >
            {(close) => (
              <div className="flex flex-col gap-px">
                <ContextMenuLabel first>Clean up</ContextMenuLabel>
                <ContextMenuItem
                  disabled={done === 0}
                  icon={<CheckCheck size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />}
                  onClick={() => {
                    ClearColumn(column, false);
                    close();
                  }}
                >
                  Clear done ({done})
                </ContextMenuItem>
                <ContextMenuItem
                  danger
                  icon={<Trash2 size={14} strokeWidth={1.75} />}
                  onClick={() => {
                    ClearColumn(column, true);
                    close();
                  }}
                >
                  Clear all ({own.length})
                </ContextMenuItem>
              </div>
            )}
          </Popover>
        </div>
      </div>
      {column !== "backlog" && (
        <div className="px-1.5">
          <ProgressBar done={done} total={own.length} />
        </div>
      )}

      {ungrouped.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
      {/* Při tažení úkolu ze skupiny: místo, kam ho pustit, aby ze skupiny vypadl. */}
      {draggingId && groups.length > 0 ? (
        <p
          className={`rounded-lg border border-dashed py-2 text-center text-xs transition-colors ${
            isEndTarget ? "border-[#0088ff]/50 bg-[#0088ff]/[0.07] text-[#0088ff]" : "border-black/[0.1] text-[var(--lk-subtle)]"
          }`}
        >
          Drop here to take it out of the list
        </p>
      ) : null}
      {groups.map((group) => (
        <Group key={group.id} group={group} tasks={own.filter((t) => t.groupId === group.id)} />
      ))}

      <Button
        variant="ghost"
        onPress={() => AddTask(column)}
        className="h-8 justify-start gap-1.5 rounded-lg px-2 text-[13px] font-normal text-[var(--lk-muted)] hover:bg-black/[0.04] hover:text-[var(--lk-ink)]"
      >
        <Plus size={15} />
        Add task
      </Button>
      {children}
    </div>
  );
}

function Group({ group, tasks }: { group: FocusGroup; tasks: FocusTask[] }) {
  const { AddTask, UpdateGroup, RemoveGroup, MoveGroup } = UseFocusStore.getState();
  const { target, draggingId } = useContext(DragContext);
  const col = FOCUS_COLUMNS.indexOf(group.column);
  const done = tasks.filter((t) => t.done).length;
  const isEndTarget = draggingId && target?.groupId === group.id && !target.anchorId;

  return (
    <div
      data-drop-column={group.column}
      data-drop-group={group.id}
      className={`group/grp flex flex-col gap-1.5 rounded-xl p-1.5 transition-colors ${
        isEndTarget ? "bg-[#0088ff]/[0.07] ring-1 ring-[#0088ff]/40" : "bg-black/[0.025]"
      }`}
    >
      <div className="group flex items-center justify-between gap-1 pl-0.5">
        <div className="flex min-w-0 items-center gap-1">
          <IconPicker
            icon={group.icon}
            onChange={(icon) => UpdateGroup(group.id, { icon })}
            size={22}
            glyphScale={0.8}
            placeholderOnlyOnHover
          />
          <div className="min-w-0 truncate text-[13px] font-semibold text-[var(--lk-ink)]">
            <InlineEditable
              value={group.title}
              placeholder="New group"
              onCommit={(title) => UpdateGroup(group.id, { title: title || "New group" })}
            />
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--lk-subtle)]">
            {done}/{tasks.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/grp:opacity-100">
          <IconAction label="Add task to group" onPress={() => AddTask(group.column, group.id)}>
            <Plus size={14} />
          </IconAction>
          <IconAction label="Move group left" disabled={col === 0} onPress={() => MoveGroup(group.id, FOCUS_COLUMNS[col - 1])}>
            <ChevronLeft size={14} />
          </IconAction>
          <IconAction
            label="Move group right"
            disabled={col === FOCUS_COLUMNS.length - 1}
            onPress={() => MoveGroup(group.id, FOCUS_COLUMNS[col + 1])}
          >
            <ChevronRight size={14} />
          </IconAction>
          <IconAction label={`Delete group and its ${tasks.length} tasks`} danger onPress={() => RemoveGroup(group.id)}>
            <X size={14} />
          </IconAction>
        </div>
      </div>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
      {tasks.length === 0 && (
        <p className="rounded-lg border border-dashed border-black/[0.08] py-2 text-center text-xs text-[var(--lk-subtle)]">
          Drop tasks here
        </p>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: FocusTask }) {
  const state = UseFocusStore();
  const { UpdateTask, MoveTask, ToggleDone, RemoveTask } = state;
  const { target, draggingId, StartDrag } = useContext(DragContext);
  const isCurrent = state.runningSince !== null && CurrentTask(state)?.id === task.id;
  const now = UseNow(isCurrent);
  const spent = SpentSec(state, task, now);
  const col = FOCUS_COLUMNS.indexOf(task.column);
  const hasMeta = task.estimateMin !== null || spent > 0 || isCurrent || Boolean(task.source);
  const dropEdge = draggingId && target?.anchorId === task.id ? (target.after ? "after" : "before") : null;

  return (
    <div
      data-task-id={task.id}
      data-column={task.column}
      data-group-id={task.groupId ?? ""}
      onPointerDown={(e) => {
        if (!(e.target as Element).closest('button, input, textarea, a, [data-block-drag-ignore="true"]')) {
          StartDrag(e, { taskId: task.id });
        }
      }}
      className={`group relative cursor-grab rounded-xl bg-white px-3 py-2.5 ring-1 transition-shadow active:cursor-grabbing ${
        isCurrent ? "ring-[#0088ff]/50" : "ring-black/[0.05]"
      } ${task.done ? "bg-white/60 shadow-none" : "shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.18)]"} ${
        draggingId === task.id ? "opacity-40" : ""
      }`}
    >
      {dropEdge && (
        <div
          className={`pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-[#0088ff] ${
            dropEdge === "before" ? "-top-[5px]" : "-bottom-[5px]"
          }`}
        />
      )}

      <div className="flex items-start gap-2.5">
        <Button
          variant="ghost"
          isIconOnly
          aria-label={task.done ? "Mark as not done" : "Mark as done"}
          onPress={() => ToggleDone(task.id)}
          className={`mt-px size-[18px] min-w-0 shrink-0 rounded-full p-0 transition-colors ${
            task.done
              ? "bg-[#0088ff] text-[#fff] hover:bg-[#0077e0]"
              : "border-[1.5px] border-[var(--lk-line2)] text-transparent hover:border-[#0088ff] hover:text-[#0088ff]"
          }`}
        >
          <Check size={11} strokeWidth={3} />
        </Button>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className={`text-[13.5px] font-medium leading-5 ${task.done ? "text-[var(--lk-subtle)] line-through" : "text-[var(--lk-ink)]"}`}>
            <InlineEditable value={task.title} placeholder="Untitled task" onCommit={(title) => UpdateTask(task.id, { title })} />
          </div>
          <div className="text-xs leading-[18px] text-[var(--lk-muted)]">
            <InlineEditable
              multiline
              value={task.description ?? ""}
              placeholder="Add description"
              onCommit={(description) => UpdateTask(task.id, { description })}
            />
          </div>

          {hasMeta && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            {task.estimateMin !== null && (
              <EstimatePicker task={task}>
                <Button
                  variant="ghost"
                  aria-label="Estimate"
                  className="h-5 min-w-0 gap-1 rounded-md bg-black/[0.04] px-1.5 text-[11px] font-medium text-[var(--lk-text2)] hover:bg-black/[0.07]"
                >
                  <Timer size={11} />
                  {FormatMinutes(task.estimateMin)}
                </Button>
              </EstimatePicker>
            )}
            {(spent > 0 || isCurrent) && (
              <span
                className={`flex h-5 items-center gap-1 rounded-md px-1.5 font-medium tabular-nums ${
                  isCurrent ? "bg-[#0088ff]/10 text-[#0077e0]" : "bg-black/[0.04] text-[var(--lk-text2)]"
                }`}
              >
                {isCurrent && <span className="size-1.5 animate-pulse rounded-full bg-[#0088ff]" />}
                {FormatMinutes(Math.floor(spent / 60))}
              </span>
            )}
            {task.source && (
              <Link
                href={task.source.href}
                className="flex h-5 min-w-0 items-center gap-1 rounded-md px-1 text-[var(--lk-muted)] hover:bg-black/[0.04] hover:text-[var(--lk-text2)]"
              >
                <FileText size={11} className="shrink-0" />
                <span className="truncate">{task.source.label}</span>
              </Link>
            )}
          </div>
          )}
        </div>
      </div>

      <div className="absolute right-1.5 top-1.5 flex items-center rounded-lg bg-white/95 opacity-0 shadow-sm ring-1 ring-black/[0.05] transition-opacity group-hover:opacity-100">
        {task.estimateMin === null && (
          <EstimatePicker task={task}>
            <IconAction label="Set estimate" onPress={() => {}}>
              <Timer size={13} />
            </IconAction>
          </EstimatePicker>
        )}
        <IconAction label="Move left" disabled={col === 0} onPress={() => MoveTask(task.id, FOCUS_COLUMNS[col - 1])}>
          <ChevronLeft size={14} />
        </IconAction>
        <IconAction
          label="Move right"
          disabled={col === FOCUS_COLUMNS.length - 1}
          onPress={() => MoveTask(task.id, FOCUS_COLUMNS[col + 1])}
        >
          <ChevronRight size={14} />
        </IconAction>
        <IconAction label="Delete task" danger onPress={() => RemoveTask(task.id)}>
          <Trash2 size={13} />
        </IconAction>
      </div>
    </div>
  );
}

function EstimatePicker({ task, children }: { task: FocusTask; children: ReactNode }) {
  const UpdateTask = UseFocusStore((s) => s.UpdateTask);
  return (
    <Popover panelClassName="w-48 p-1" trigger={() => children}>
      {(close) => (
        <div className="flex flex-col gap-px">
          <ContextMenuLabel first>Estimate</ContextMenuLabel>
          {[null, ...ESTIMATES].map((min) => (
            <ContextMenuItem
              key={min ?? "none"}
              selected={min === task.estimateMin}
              onClick={() => {
                UpdateTask(task.id, { estimateMin: min });
                close();
              }}
            >
              {min === null ? "No estimate, just track" : FormatMinutes(min)}
            </ContextMenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}
