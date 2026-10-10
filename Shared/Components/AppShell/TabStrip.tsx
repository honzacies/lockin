"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { FileText, Library, ListTodo, Lock, Rocket, Search, Shapes, Waypoints, X, Zap, type LucideIcon } from "lucide-react";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { ProjectIcon } from "@lockin/shared/Components/Shared/ProjectIcon";

/** Fixed-id pages get their real nav icon instead of the generic FileText —
 * matches Sidebar.tsx's NavLink icons for the same three pages. */
const SPECIAL_TAB_ICON: Record<string, LucideIcon> = {
  "quick-notes": Zap,
  library: Library,
  "your-projects": Rocket,
  todo: ListTodo,
  graph: Waypoints,
  canvas: Shapes,
  search: Search,
};

const DRAG_THRESHOLD_PX = 4;

export function TabStrip() {
  const router = useRouter();
  const openTabs = UseUiStore((state) => state.openTabs);
  const activeTabId = UseUiStore((state) => state.activeTabId);
  const closeTab = UseUiStore((state) => state.CloseTab);
  const setActiveTab = UseUiStore((state) => state.SetActiveTab);
  const moveTab = UseUiStore((state) => state.MoveTab);
  // Zamčená stránka má v tabu zámeček (ID tabu = ID dokumentu).
  const documents = UseDataStore((state) => state.documents);

  // DOM refs for every tab pill, kept up to date every render — needed to
  // measure live positions during a pointer-based drag (see HandlePointerDown
  // below). Native HTML5 drag-and-drop (draggable/onDragStart/onDragOver)
  // turned out unreliable inside this custom-titlebar Tauri window — it
  // never fired at all — so reordering is driven by plain pointer events
  // instead, the same technique already proven to work for the block-drag
  // marquee in Components/DocumentView/Editor/BlockSelectionExtension.ts.
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const draggedTabIdRef = useRef<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    beforeTabId: string | null;
    edge: "left" | "right";
  } | null>(null);

  // Aktivní tab je vždycky vidět, i když se taby nevejdou a scrollují.
  useEffect(() => {
    if (activeTabId) tabRefs.current.get(activeTabId)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId, openTabs.length]);

  if (openTabs.length === 0) return null;

  function HandleSelect(tab: (typeof openTabs)[number]) {
    setActiveTab(tab.id);
    router.push(tab.href);
  }

  function HandleClose(tab: (typeof openTabs)[number]) {
    const nextActiveId = closeTab(tab.id);
    if (activeTabId !== tab.id) return;
    const nextTab = openTabs.find((t) => t.id === nextActiveId);
    router.push(nextTab?.href ?? "/YourProjects");
  }

  /** A floating clone of the dragged tab that follows the cursor — cloning
   * `sourceEl` picks up its own current classes/padding/content as-is, so
   * .tab-drag-preview (globals.css) only needs to add the "lifted" shadow
   * on top, not recreate the tab's look from scratch. */
  function CreateTabDragPreview(sourceEl: HTMLElement, grabX: number, grabY: number) {
    const rect = sourceEl.getBoundingClientRect();
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    clone.className = `${sourceEl.className} tab-drag-preview`;
    clone.style.position = "fixed";
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
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

  /** Which tab the pointer is currently over, and which edge — used both to
   * show the "drop before" vs "drop after" indicator and to actually commit
   * the move on release. Skips the tab currently being dragged. */
  function TargetAtPoint(clientX: number): { beforeTabId: string | null; edge: "left" | "right" } | null {
    for (let i = 0; i < openTabs.length; i++) {
      const tab = openTabs[i];
      if (tab.id === draggedTabIdRef.current) continue;
      const el = tabRefs.current.get(tab.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right) continue;
      const edge: "left" | "right" = clientX < rect.left + rect.width / 2 ? "left" : "right";
      const nextTab = openTabs[i + 1];
      const beforeTabId = edge === "left" ? tab.id : (nextTab?.id ?? null);
      return { beforeTabId, edge };
    }
    return null;
  }

  function HandlePointerDown(event: React.PointerEvent<HTMLDivElement>, tab: (typeof openTabs)[number]) {
    if (event.button !== 0) return;
    // Let the close button handle its own click — don't hijack it into a
    // drag/select gesture just because it's nested inside the tab pill.
    if (event.target instanceof Element && event.target.closest("button")) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const el = event.currentTarget;
    let moved = false;
    let preview: { Update: (x: number, y: number) => void; Remove: () => void } | null = null;

    function OnMove(moveEvent: PointerEvent) {
      if (!moved && Math.abs(moveEvent.clientX - startX) < DRAG_THRESHOLD_PX) return;
      if (!moved) {
        moved = true;
        draggedTabIdRef.current = tab.id;
        preview = CreateTabDragPreview(el, startX, startY);
        el.style.opacity = "0.35";
      }
      preview?.Update(moveEvent.clientX, moveEvent.clientY);
      setDragOverTarget(TargetAtPoint(moveEvent.clientX));
    }

    function OnUp(upEvent: PointerEvent) {
      el.releasePointerCapture(event.pointerId);
      el.removeEventListener("pointermove", OnMove);
      el.removeEventListener("pointerup", OnUp);
      preview?.Remove();
      el.style.opacity = "";
      if (!moved) {
        HandleSelect(tab);
      } else {
        const target = TargetAtPoint(upEvent.clientX);
        if (target) moveTab(tab.id, target.beforeTabId);
      }
      draggedTabIdRef.current = null;
      setDragOverTarget(null);
    }

    el.setPointerCapture(event.pointerId);
    el.addEventListener("pointermove", OnMove);
    el.addEventListener("pointerup", OnUp);
  }

  return (
    // Taby se nejdřív smršťují (min-w na tabu), teprve pak scrollují — kolečkem myši.
    <div
      role="tablist"
      aria-label="Open tabs"
      className="no-scrollbar flex h-[52px] min-w-0 items-center gap-0 overflow-x-auto"
      onWheel={(e) => {
        if (!e.deltaX) e.currentTarget.scrollLeft += e.deltaY;
      }}
    >
      {openTabs.map((tab, index) => {
        const nextTab = openTabs[index + 1];
        const showLeftLine =
          dragOverTarget !== null &&
          dragOverTarget.edge === "left" &&
          dragOverTarget.beforeTabId === tab.id;
        const showRightLine =
          dragOverTarget !== null &&
          dragOverTarget.edge === "right" &&
          dragOverTarget.beforeTabId === (nextTab ? nextTab.id : null);
        return (
        <div
          key={tab.id}
          ref={(el) => {
            if (el) tabRefs.current.set(tab.id, el);
            else tabRefs.current.delete(tab.id);
          }}
          role="tab"
          aria-selected={tab.id === activeTabId}
          tabIndex={0}
          onPointerDown={(e) => HandlePointerDown(e, tab)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") HandleSelect(tab);
          }}
          // A plain click still selects the tab — dragging a tab reorders it
          // (see above) instead of moving the window, unlike the rest of
          // the topbar; grab the empty background around the tabs to move
          // the window instead.
          // Only a right border on every tab (plus a left border on just the
          // first one) — giving every tab its own full border-x would stack
          // two 1px lines on top of each other at every shared edge between
          // adjacent tabs, since they sit flush with no gap.
          className={`group flex min-w-[88px] max-w-[200px] shrink cursor-pointer items-center gap-1.5 h-[53px] mt-[2px] z-2 border-1 border-y-0 border-r-[var(--lk-line)] ${
            index === 0 ? "border-l-[var(--lk-line)]" : "border-l-0"
          } px-2 py-1.5 text-sm ${
            tab.id === activeTabId
              ? "bg-white text-black"
              : "text-[var(--lk-text2)] hover:bg-black/[0.03]"
          } ${showLeftLine ? "shadow-[inset_2px_0_0_0_#0088ff]" : ""} ${
            showRightLine ? "shadow-[inset_-2px_0_0_0_#0088ff]" : ""
          }`}
        >
          <span className="flex min-w-0 shrink items-center gap-1.5">
            {(() => {
              if (tab.isProject) {
                return <ProjectIcon icon={tab.icon} size={14} className="shrink-0" />;
              }
              const SpecialIcon = SPECIAL_TAB_ICON[tab.id];
              return SpecialIcon ? (
                <SpecialIcon size={14} strokeWidth={1.5} className="shrink-0" />
              ) : (
                <FileText size={14} strokeWidth={1.5} className="shrink-0" />
              );
            })()}
            <span className="min-w-0 truncate" title={tab.title || "Untitled"}>{tab.title || "Untitled"}</span>
            {documents[tab.id]?.isLocked ? (
              <Lock size={11} strokeWidth={2} aria-label="Locked" className="shrink-0 text-[var(--lk-muted)]" />
            ) : null}
          </span>
          <Button
            variant="ghost"
            isIconOnly
            aria-label={`Close ${tab.title || "Untitled"}`}
            onClick={(e) => e.stopPropagation()}
            onPress={() => HandleClose(tab)}
            className="flex h-4 w-4 shrink-0 rounded p-0.5 text-[var(--lk-text2)] hover:bg-[var(--lk-gray)]"
          >
            <X size={13} strokeWidth={1.5} />
          </Button>
        </div>
        );
      })}
    </div>
  );
}
