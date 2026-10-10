"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@heroui/react";
import { Clock, FolderPlus, GripVertical, ListChecks, Plus, Settings, X } from "@lockin/shared/Components/Shared/UiIcons";
import type { TodoListConfig, TodoListStyle, TodoTask } from "@lockin/shared/Types/QuickNotes";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { DeadlinePickerPanel } from "@lockin/shared/Components/Shared/DeadlinePickerPanel";
import { IconPicker } from "@lockin/shared/Components/Shared/IconPicker";
import { BlockSettingsPortal } from "@lockin/shared/Components/Shared/BlockSettingsPortal";
import { InlineEditable } from "@lockin/shared/Components/Shared/InlineEditable";
import { TodoListSettingsPanel } from "./TodoListSettingsPanel";
import { ProgressColor } from "@lockin/shared/Lib/Color";
import { FormatDeadlineLabel } from "@lockin/shared/Lib/FormatDate";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { useBlockSettingsPortalNode } from "@lockin/shared/Components/AppShell/TodoSettingsPanelSlot";
import { AppCheckbox } from "@lockin/shared/Components/Shared/AppCheckbox";

function TextStyleVars(style: { color?: string; fontFamily?: string; fontSize?: number }): CSSProperties {
  return {
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
  };
}

const DRAG_THRESHOLD_PX = 4;

export interface TodoListViewProps {
  config: TodoListConfig;
  onChangeTitle: (title: string) => void;
  onChangeDeadline: (deadline: string | null) => void;
  onChangeDeadlineTime: (time: string | null) => void;
  onChangeStyle: (patch: Partial<TodoListStyle>) => void;
  /** Omit `groupId` to target the list's ungrouped tasks. */
  onToggleTask: (taskId: string, groupId?: string) => void;
  onAddTask: (groupId?: string) => void;
  onRemoveTask: (taskId: string, groupId?: string) => void;
  onUpdateTask: (
    taskId: string,
    patch: Partial<Pick<TodoTask, "title" | "description">>,
    groupId?: string,
  ) => void;
  /** Moves a task anywhere — into a different group, into/out of the
   * ungrouped section, or reordered within the same one. `beforeTaskId: null`
   * means "move to the end of the destination". */
  onMoveTask: (taskId: string, toGroupId: string | undefined, beforeTaskId: string | null) => void;
  onAddGroup: () => void;
  onRemoveGroup: (groupId: string) => void;
  onChangeGroupTitle: (groupId: string, title: string) => void;
  onChangeGroupIcon: (groupId: string, icon: string | undefined) => void;
  /** Omit to hide the "Delete list" action in settings. */
  onDeleteList?: () => void;
}

/**
 * Pure presentational to-do list — the single visual/behavioral source of
 * truth shared by the Quick Notes widget (Zustand-backed) and the rich-text
 * editor's To-do list block (TipTap node-attrs-backed), so both stay in sync.
 */
export function TodoListView({
  config,
  onChangeTitle,
  onChangeDeadline,
  onChangeDeadlineTime,
  onChangeStyle,
  onToggleTask,
  onAddTask,
  onRemoveTask,
  onUpdateTask,
  onMoveTask,
  onAddGroup,
  onRemoveGroup,
  onChangeGroupTitle,
  onChangeGroupIcon,
  onDeleteList,
}: TodoListViewProps) {
  const draggedTaskIdRef = useRef<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    groupId?: string;
    beforeTaskId: string | null;
    edge: "top" | "bottom";
  } | null>(null);
  // DOM refs for every task row and group container — needed to measure
  // live positions during a pointer-based drag (see HandleTaskPointerDown
  // below). Native HTML5 drag-and-drop (draggable/onDragStart/onDragOver)
  // turned out unreliable inside the app's custom-titlebar Tauri window —
  // it stopped firing reliably — so task reordering is driven by plain
  // pointer events instead, same as TabStrip.tsx's tab reordering.
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // The list container as a whole — a last-resort fallback drop target for
  // "move to ungrouped" (see TargetAtPoint). The *real* way to un-group a
  // task is the dedicated strip below (ungroupZoneRef) — the gap between
  // flex children is only ~4px, an impractical target to hit precisely.
  const listRef = useRef<HTMLDivElement | null>(null);
  const ungroupZoneRef = useRef<HTMLDivElement | null>(null);
  // Only while a task is actually being dragged, so this doesn't add
  // permanent visual clutter between the ungrouped tasks and the groups.
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  const openBlockSettings = UseUiStore((state) => state.openBlockSettings);
  const OpenBlockSettings = UseUiStore((state) => state.OpenBlockSettings);
  const CloseBlockSettings = UseUiStore((state) => state.CloseBlockSettings);
  const settingsPortalNode = useBlockSettingsPortalNode();
  const settingsOpen =
    openBlockSettings?.kind === "todo" && openBlockSettings.id === config.id;

  const { title, deadline, deadlineTime, tasks, style } = config;
  const groups = config.groups ?? [];
  const allTasks = [...tasks, ...groups.flatMap((g) => g.tasks)];
  const doneCount = allTasks.filter((task) => task.done).length;
  const progress = allTasks.length === 0 ? 0 : (doneCount / allTasks.length) * 100;
  const isSolid = style.variant === "solid";

  const showHeader = style.showTitle || style.showIcon;
  const showFooter = style.showProgress || style.showDeadline;

  // The header sticks to the top of the scroll container while the list is
  // on screen (plain CSS `position: sticky`, so it lets go on its own once
  // the list scrolls past). JS only answers "is it stuck right now?", for the
  // border/shadow that make it read as a bar — CSS scroll-state queries could
  // do that, but Shared/ also runs on the web build, where Firefox/Safari
  // don't support them.
  //
  // A 1px sentinel marks where the header's top edge naturally is. A stuck
  // sticky element sits *below* its natural spot, so any gap between the two
  // means sticky is active — measured directly instead of via an
  // IntersectionObserver, which needs the right scroll container as its root
  // and, inside the editor, a node view already attached to the page. An
  // earlier IntersectionObserver version stuck in the dev browser but never
  // flipped inside the Tauri window.
  const stickySentinelRef = useRef<HTMLDivElement | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null);
  const [headerStuck, setHeaderStuck] = useState(false);

  useEffect(() => {
    function Measure() {
      const sentinel = stickySentinelRef.current;
      const header = stickyHeaderRef.current;
      if (!sentinel || !header) return;
      const displacement =
        header.getBoundingClientRect().top - sentinel.getBoundingClientRect().top;
      setHeaderStuck(displacement > 0.5);
    }

    Measure();
    // `scroll` doesn't bubble, but a capture-phase listener on `document`
    // still sees it from every scroll container on the page — so it doesn't
    // matter which one this list happens to live in.
    document.addEventListener("scroll", Measure, { capture: true, passive: true });
    window.addEventListener("resize", Measure);
    return () => {
      document.removeEventListener("scroll", Measure, { capture: true });
      window.removeEventListener("resize", Measure);
    };
  }, []);

  /** Which task (or empty group background) the pointer is currently over,
   * and which edge — drives both the "drop before/after" indicator line and
   * the actual move on release. Scans ungrouped tasks first, then each
   * group's tasks, then falls back to the group's own container rect (so
   * dropping into an empty group, or below its last task, still works).
   * Skips the task currently being dragged. */
  function TargetAtPoint(
    clientX: number,
    clientY: number,
  ): { groupId?: string; beforeTaskId: string | null; edge: "top" | "bottom" } | null {
    function ScanList(list: TodoTask[], groupId?: string) {
      for (let i = 0; i < list.length; i++) {
        const task = list[i];
        if (task.id === draggedTaskIdRef.current) continue;
        const el = taskRefs.current.get(task.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top || clientY > rect.bottom) continue;
        const edge: "top" | "bottom" = clientY < rect.top + rect.height / 2 ? "top" : "bottom";
        const nextTask = list[i + 1];
        const beforeTaskId = edge === "top" ? task.id : (nextTask?.id ?? null);
        return { groupId, beforeTaskId, edge };
      }
      return null;
    }

    const ungroupedHit = ScanList(tasks);
    if (ungroupedHit) return ungroupedHit;

    // The dedicated "move to ungrouped" strip, rendered between the
    // ungrouped tasks and the groups only while dragging.
    const ungroupZoneEl = ungroupZoneRef.current;
    if (ungroupZoneEl) {
      const rect = ungroupZoneEl.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return { groupId: undefined, beforeTaskId: null, edge: "top" };
      }
    }

    for (const group of groups) {
      const groupHit = ScanList(group.tasks, group.id);
      if (groupHit) return groupHit;
      const groupEl = groupRefs.current.get(group.id);
      if (!groupEl) continue;
      const rect = groupEl.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return { groupId: group.id, beforeTaskId: group.tasks[0]?.id ?? null, edge: "top" };
      }
    }

    // Fallback: empty space in the list that isn't over any task or group
    // box (a gap between groups, below everything, ...) counts as "move to
    // ungrouped, at the end" — otherwise a task already inside a group had
    // no way to be dragged back out when there were no ungrouped tasks to
    // drop next to.
    const listEl = listRef.current;
    if (listEl) {
      const rect = listEl.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return { groupId: undefined, beforeTaskId: null, edge: "top" };
      }
    }
    return null;
  }

  /** A floating clone of the dragged task row that follows the cursor —
   * mirrors CreateTabDragPreview in TabStrip.tsx. Cloning the row picks up
   * its current content/classes as-is. */
  function CreateTaskDragPreview(sourceEl: HTMLElement, grabX: number, grabY: number) {
    const rect = sourceEl.getBoundingClientRect();
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    clone.className = `${sourceEl.className} task-drag-preview`;
    clone.style.position = "fixed";
    clone.style.width = `${rect.width}px`;
    clone.style.margin = "0";
    const offsetX = grabX - rect.left;
    const offsetY = grabY - rect.top;
    document.body.appendChild(clone);
    function Update(clientX: number, clientY: number) {
      clone.style.left = `${clientX - offsetX}px`;
      clone.style.top = `${clientY - offsetY}px`;
    }
    Update(grabX, grabY);
    return { Update, Remove: () => clone.remove() };
  }

  function HandleTaskPointerDown(event: React.PointerEvent<HTMLDivElement>, task: TodoTask) {
    if (event.button !== 0) return;
    // Let the checkbox, remove button, and rename inputs handle their own
    // clicks — don't hijack them into a drag gesture.
    if (
      event.target instanceof Element &&
      event.target.closest('button, input, textarea, [data-block-drag-ignore="true"]')
    ) {
      return;
    }
    // The whole to-do block is currently marquee-selected (or being moved
    // as a unit) — see BlockSelectionExtension.ts's "block-select-highlight"
    // / "block-being-moved" decorations. Grabbing it should move the whole
    // block in that case, not reorder a task within it, so bail out here
    // and let the pointerdown bubble untouched to ProseMirror's own
    // handler instead of racing it for pointer capture.
    if (event.currentTarget.closest(".block-select-highlight, .block-being-moved")) {
      return;
    }
    // Without this, ProseMirror's own default click handling still runs on
    // this same pointerdown once our handler returns — the to-do node's
    // schema has `selectable: true` (Components/DocumentView/Editor/
    // TodoListExtension.ts), so an unconsumed click resolves into a
    // NodeSelection for the *whole* atom node, which ProseMirror core then
    // makes natively draggable for as long as it's selected. That's a
    // completely separate drag mechanism from ours — invisible (no blue
    // marquee highlight, since it's not our decoration) — and is what was
    // making the whole block draggable on every task drag regardless of
    // marquee state.
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const el = event.currentTarget;
    let moved = false;
    let preview: { Update: (x: number, y: number) => void; Remove: () => void } | null = null;

    function OnMove(moveEvent: PointerEvent) {
      if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD_PX) {
        return;
      }
      if (!moved) {
        moved = true;
        draggedTaskIdRef.current = task.id;
        preview = CreateTaskDragPreview(el, startX, startY);
        el.style.opacity = "0.35";
        setIsDraggingTask(true);
      }
      preview?.Update(moveEvent.clientX, moveEvent.clientY);
      setDragOverTarget(TargetAtPoint(moveEvent.clientX, moveEvent.clientY));
    }

    let finished = false;
    function End(upEvent: PointerEvent | null) {
      if (finished) return;
      finished = true;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      el.removeEventListener("pointermove", OnMove);
      el.removeEventListener("pointerup", OnUp);
      el.removeEventListener("pointercancel", Cancel);
      window.removeEventListener("blur", Cancel);
      preview?.Remove();
      el.style.opacity = "";
      // Computed fresh here rather than read from dragOverTarget state,
      // which may not have caught up with this exact release position yet.
      if (moved && upEvent) {
        const target = TargetAtPoint(upEvent.clientX, upEvent.clientY);
        if (target) onMoveTask(task.id, target.groupId, target.beforeTaskId);
      }
      draggedTaskIdRef.current = null;
      setDragOverTarget(null);
      setIsDraggingTask(false);
    }
    const OnUp = (upEvent: PointerEvent) => End(upEvent);
    // Alt+Tab / ztráta fokusu uprostřed tažení: zahodit, úkol zůstane, kde byl.
    const Cancel = () => End(null);

    el.setPointerCapture(event.pointerId);
    el.addEventListener("pointermove", OnMove);
    el.addEventListener("pointerup", OnUp);
    el.addEventListener("pointercancel", Cancel);
    window.addEventListener("blur", Cancel);
  }

  function RenderTask(task: TodoTask, index: number, list: TodoTask[], groupId?: string) {
    const target = dragOverTarget;
    const showTopLine =
      target !== null &&
      target.groupId === groupId &&
      target.edge === "top" &&
      target.beforeTaskId === task.id;
    const nextTask = list[index + 1];
    const showBottomLine =
      target !== null &&
      target.groupId === groupId &&
      target.edge === "bottom" &&
      target.beforeTaskId === (nextTask ? nextTask.id : null);
    return (
      <div
        key={task.id}
        ref={(el) => {
          if (el) taskRefs.current.set(task.id, el);
          else taskRefs.current.delete(task.id);
        }}
        onPointerDown={(e) => HandleTaskPointerDown(e, task)}
        className={`group flex w-full items-start gap-1.5 rounded-lg px-1 py-1 hover:bg-black/[0.02] ${
          showTopLine ? "shadow-[inset_0_2px_0_0_#0088ff]" : ""
        } ${showBottomLine ? "shadow-[inset_0_-2px_0_0_#0088ff]" : ""}`}
      >
        <GripVertical
          size={14}
          strokeWidth={1.5}
          className="mt-1 shrink-0 cursor-grab text-[var(--lk-gray)] opacity-0 group-hover:opacity-100"
        />
        <AppCheckbox
          checked={task.done}
          onChange={() => onToggleTask(task.id, groupId)}
          color={style.checkboxColor ?? "#0485f7"}
          ariaLabel={task.done ? "Mark as not done" : "Mark as done"}
          className="mt-0.5"
        />
        <div className="flex flex-1 flex-col text-sm">
          <InlineEditable
            value={task.title}
            onCommit={(next) => onUpdateTask(task.id, { title: next || "Untitled task" }, groupId)}
            placeholder="Untitled task"
            className={`font-medium ${task.done ? "text-[var(--lk-muted)] line-through" : "text-[var(--lk-fg)]"}`}
            style={TextStyleVars(style.taskTitle)}
          />
          {style.showDescriptions ? (
            <InlineEditable
              value={task.description}
              onCommit={(next) => onUpdateTask(task.id, { description: next }, groupId)}
              placeholder="Add a description…"
              className="text-[var(--lk-muted)]"
              style={TextStyleVars(style.taskDescription)}
              multiline
            />
          ) : null}
        </div>
        <Button
          variant="ghost"
          isIconOnly
          onPress={() => onRemoveTask(task.id, groupId)}
          aria-label="Remove task"
          className="h-auto w-auto mt-0.5 shrink-0 rounded p-0.5 text-[var(--lk-faint)] opacity-0 hover:bg-black/[0.06] hover:text-[#e5484d] group-hover:opacity-100"
        >
          <X size={13} strokeWidth={1.75} />
        </Button>
      </div>
    );
  }

  return (
    <div
      // Plain (unnamed) `group` — every InlineEditable field inside, no
      // matter how deep (a task row, a group card, ...), fades its
      // placeholder in via `group-hover:`, which matches *any* ancestor
      // with this class, not just the nearest one.
      className={`group relative flex w-full flex-col gap-4 ${isSolid ? "rounded-2xl bg-[var(--lk-panel)] p-4" : ""}`}
    >
      {/* Sticky-header sentinel (see headerStuck above). Absolutely
        * positioned so it doesn't become a flex child and add an extra
        * `gap-4` of space. Offset to the header's natural border-box top:
        * the card padding (solid only) minus the header's `-my-1`. */}
      <div
        ref={stickySentinelRef}
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 h-px ${isSolid ? "top-3" : "-top-1"}`}
      />

      {/* `-mx-2 px-2 -my-1 py-1` keeps the layout exactly where it was while
        * giving the stuck bar some breathing room around its contents; the
        * border is always there (transparent until stuck) so toggling it
        * doesn't shift anything by a pixel.
        *
        * Background: a solid list gets the card color *permanently* —
        * invisible while the header sits in place, and it covers the rows
        * scrolling underneath from the very first frame, with no dependence on
        * `headerStuck` having caught up. A transparent list can't do that (a
        * gray box would show around its header at rest), so there it follows
        * the stuck state — deliberately without a transition, so text never
        * shows through a half-faded bar.
        *
        * `z-20`: HeroUI's `checkbox__indicator` carries `z-index: 10`, so with
        * anything lower the task checkboxes scrolling underneath would paint
        * over the bar *and* take its clicks. Still below Popover panels
        * (z-30), so a picker opened near the top lands over the bar. */}
      <div
        ref={stickyHeaderRef}
        className={`sticky top-2 z-20 -mx-2 -my-1 flex items-center justify-between rounded-xl border px-2 py-1 transition-[border-color,box-shadow] duration-150 ${
          isSolid || headerStuck ? "bg-[var(--lk-panel)]" : ""
        } ${headerStuck ? "border-[var(--lk-line)] shadow-sm" : "border-transparent"}`}
      >
        {showHeader ? (
          <div className="flex items-center gap-1.5">
            {style.showIcon ? (
              <ListChecks
                size={20}
                strokeWidth={1.5}
                style={{ color: style.iconColor ?? "#5f5e59" }}
              />
            ) : null}
            {style.showTitle ? (
              <InlineEditable
                value={title}
                onCommit={(next) => onChangeTitle(next || "My To-Do List")}
                placeholder="My To-Do List"
                className="text-lg font-medium"
                style={TextStyleVars(style.heading)}
              />
            ) : null}
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            isIconOnly
            onPress={() => onAddTask()}
            aria-label="Add task"
            className="h-7 w-7 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.05]"
          >
            <Plus size={16} strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            onPress={onAddGroup}
            aria-label="Add group"
            className="h-7 w-7 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.05]"
          >
            <FolderPlus size={16} strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            aria-label="To-do list settings"
            onPress={() => (settingsOpen ? CloseBlockSettings() : OpenBlockSettings("todo", config.id))}
            className={`h-7 w-7 rounded-md text-[var(--lk-muted)] transition-colors ${
              settingsOpen ? "bg-black/[0.06] text-[var(--lk-ink)]" : "hover:bg-black/[0.05]"
            }`}
          >
            <Settings size={16} strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      <BlockSettingsPortal
        open={settingsOpen}
        portalNode={settingsPortalNode}
        title={`${title || "To-do list"} settings`}
        onClose={CloseBlockSettings}
      >
        <TodoListSettingsPanel
          style={style}
          onChange={onChangeStyle}
          onDeleteList={
            onDeleteList
              ? () => {
                  CloseBlockSettings();
                  onDeleteList();
                }
              : undefined
          }
        />
      </BlockSettingsPortal>

      <div ref={listRef} className="flex flex-col gap-1">
        {tasks.map((task, index) => RenderTask(task, index, tasks))}

        {groups.length > 0 ? (
          <div
            ref={ungroupZoneRef}
            className={`shrink-0 overflow-hidden rounded-lg border border-dashed transition-[height,opacity] duration-150 ${
              isDraggingTask ? "h-6 opacity-100" : "h-0 opacity-0"
            } ${
              dragOverTarget !== null &&
              dragOverTarget.groupId === undefined &&
              dragOverTarget.beforeTaskId === null
                ? "border-[#0088ff]/50 bg-[#0088ff]/5"
                : "border-transparent"
            }`}
          >
            <p className="flex h-6 items-center justify-center text-[11px] text-[var(--lk-subtle)]">
              Drop here to remove from group
            </p>
          </div>
        ) : null}

        {groups.map((group) => {
          const groupDone = group.tasks.filter((t) => t.done).length;
          const groupIsDropTarget =
            dragOverTarget !== null &&
            dragOverTarget.groupId === group.id &&
            dragOverTarget.beforeTaskId === (group.tasks[0]?.id ?? null);
          return (
            <div
              key={group.id}
              ref={(el) => {
                if (el) groupRefs.current.set(group.id, el);
                else groupRefs.current.delete(group.id);
              }}
              className={`group/group flex flex-col gap-1 rounded-xl border p-2.5 ${
                groupIsDropTarget ? "border-[#0088ff]/50" : "border-[var(--lk-line)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {/* A ~19px emoji in a 24px box: a notch bigger than the
                    * 14px group title, without the default half-size glyph's
                    * padding opening up a gap before the title. */}
                  <IconPicker
                    icon={group.icon}
                    onChange={(icon) => onChangeGroupIcon(group.id, icon)}
                    size={24}
                    glyphScale={0.8}
                    placeholderOnlyOnHover
                  />
                  <InlineEditable
                    value={group.title}
                    onCommit={(next) => onChangeGroupTitle(group.id, next || "New group")}
                    placeholder="New group"
                    className="text-sm font-medium"
                    style={TextStyleVars(style.groupTitle ?? {})}
                  />
                  <span className="text-xs text-[var(--lk-subtle)]">
                    {groupDone}/{group.tasks.length}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/group:opacity-100">

                  <Button
                    variant="ghost"
                    isIconOnly
                    onPress={() => onAddTask(group.id)}
                    aria-label="Add task to group"
                    className="h-auto w-auto rounded p-1 text-[var(--lk-muted)] hover:bg-black/[0.06] hover:text-[#0088ff]"
                  >
                    <Plus size={14} strokeWidth={1.75} />
                  </Button>
                  <Button
                    variant="ghost"
                    isIconOnly
                    onPress={() => onRemoveGroup(group.id)}
                    aria-label="Remove group"
                    className="h-auto w-auto rounded p-1 text-[var(--lk-faint)] hover:bg-black/[0.06] hover:text-[#e5484d]"
                  >
                    <X size={13} strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {group.tasks.map((task, index) => RenderTask(task, index, group.tasks, group.id))}
              </div>
            </div>
          );
        })}
      </div>

      {showFooter ? (
        <div className="flex items-center justify-between">
          {style.showProgress ? (
            <div className="flex items-center gap-2.5">
              <div className="relative h-2 w-[111px] rounded-full bg-[var(--lk-gray)]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{ width: `${progress}%`, background: ProgressColor(progress) }}
                />
              </div>
              <p className="text-xs text-[var(--lk-text2)]">
                {doneCount}/{allTasks.length} tasks done
              </p>
            </div>
          ) : (
            <span />
          )}

          {style.showDeadline ? (
            <Popover
              align="right"
              trigger={() => (
                <Button
                  variant="ghost"
                  className="h-auto gap-1.5 rounded-lg bg-[var(--lk-line)] px-2 py-1.5 font-normal text-[var(--lk-text2)] hover:bg-black/[0.06]"
                >
                  <Clock size={20} strokeWidth={1.5} />
                  <span className="text-[16px]">
                    {FormatDeadlineLabel(deadline, deadlineTime, 24)}
                  </span>
                </Button>
              )}
            >
              {(close) => (
                <DeadlinePickerPanel
                  date={deadline}
                  time={deadlineTime}
                  onChangeDate={onChangeDeadline}
                  onChangeTime={onChangeDeadlineTime}
                  onDone={close}
                />
              )}
            </Popover>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
