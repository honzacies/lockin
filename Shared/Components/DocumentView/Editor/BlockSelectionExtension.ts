import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

interface BlockRange {
  from: number;
  to: number;
}

interface BlockSelectionPluginState {
  /** The exact [from, to) block range to paint as marquee-selected — set
   * directly from our own marquee math (see RunBlockMarquee), *not* derived
   * from `state.selection`. Decorations render straight from this instead of
   * resolving it through a real Selection, because a real TextSelection can
   * snap its boundary *backward*, away from a trailing atom node with
   * nothing after it (e.g. a to-do block at the end of the doc) — which
   * would silently exclude it from the highlight until the marquee also
   * covered something past it. This also means a *single* selected block
   * gets decorated correctly. `null` while nothing is marquee-selected —
   * any selection-changing transaction we didn't tag ourselves (a plain
   * click, selecting a word, arrow-key navigation, ...) resets it, so normal
   * text selection is never confused for this. */
  range: BlockRange | null;
  /** The block range currently being dragged to a new position (see
   * RunBlockMove) — decorated separately with a "lifted" ghost style. Driven
   * through the same plugin state (rather than direct DOM class toggling) so
   * it survives any re-render of the dragged element during the drag. */
  movingRange: BlockRange | null;
}

/** Exportovaný, aby se kontextové menu mohlo zeptat na vybrané bloky. */
export const BlockSelectionPluginKey = new PluginKey<BlockSelectionPluginState>("blockSelectionHighlight");
const DRAG_THRESHOLD_PX = 4;

interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** AABB intersection — exactly `marquee.left < item.right && marquee.right >
 * item.left && marquee.top < item.bottom && marquee.bottom > item.top`. */
function RectsIntersect(marquee: MarqueeRect, item: DOMRect): boolean {
  const marqueeRight = marquee.left + marquee.width;
  const marqueeBottom = marquee.top + marquee.height;
  return (
    marquee.left < item.right &&
    marqueeRight > item.left &&
    marquee.top < item.bottom &&
    marqueeBottom > item.top
  );
}

/** Decorates every top-level block between `from` and `to` (inclusive) with
 * `className` — including a single block, since the caller only ever sets
 * `range`/`movingRange` from our own drag math, never from an arbitrary
 * native text selection. Walks only top-level children (`doc.forEach`)
 * rather than `doc.nodesBetween`, since this runs on every decoration
 * recompute (i.e. every dispatch during a drag) and has no reason to
 * resolve every nested descendant just to filter them back out. */
function BlockRangeDecorations(doc: ProseMirrorNode, range: BlockRange, className: string): Decoration[] {
  if (range.from === range.to) return [];
  const startBlock = doc.resolve(range.from).index(0);
  const endBlock = doc.resolve(Math.max(range.to - 1, range.from)).index(0);

  const decorations: Decoration[] = [];
  doc.forEach((node, offset, index) => {
    if (index < startBlock || index > endBlock) return;
    decorations.push(Decoration.node(offset, offset + node.nodeSize, { class: className }));
  });
  return decorations;
}

/** Doc [from, to) span covering every top-level block from `firstIndex` to
 * `lastIndex` (inclusive) among the document's direct children. */
function SpanForBlockRange(
  doc: ProseMirrorNode,
  firstIndex: number,
  lastIndex: number,
): BlockRange {
  let from = 0;
  let to = 0;
  doc.forEach((node, offset, index) => {
    if (index === firstIndex) from = offset;
    if (index === lastIndex) to = offset + node.nodeSize;
  });
  return { from, to: Math.min(to, doc.content.size) };
}

/** Whether (clientX, clientY) falls within the bounding rect of any
 * top-level block currently inside [range.from, range.to). Used instead of
 * comparing against a `posAtCoords`-resolved position to decide "did the
 * user grab the current selection to move it" — `posAtCoords` leans on the
 * browser's own hit-testing/caret APIs, which don't reliably resolve a
 * position inside an atom node once its descendants are `pointer-events:
 * none` (needed to stop hover/clicks reaching its internals while
 * selected) — a plain heading (plain text, no nested hit-testing needed)
 * worked fine, but an atom block like the to-do list never did. Geometric
 * containment sidesteps that entirely and behaves identically for both. */
function PointInBlockRange(view: EditorView, range: BlockRange, clientX: number, clientY: number): boolean {
  const doc = view.state.doc;
  let hit = false;
  doc.forEach((node, offset) => {
    if (hit) return;
    const nodeEnd = offset + node.nodeSize;
    if (offset >= range.to || nodeEnd <= range.from) return;
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      hit = true;
    }
  });
  return hit;
}

/**
 * A floating clone of the block(s) being dragged that follows the pointer —
 * without this, only a thin drop-indicator line moved, while the actual
 * content stayed put until dropped, making a drag across a long document
 * (needing to scroll while dragging) hard to track. `grabX`/`grabY` anchor
 * the clone to wherever inside it the user actually grabbed, so it doesn't
 * jump to be centered under the cursor.
 */
function CreateDragPreview(
  view: EditorView,
  range: BlockRange,
  grabX: number,
  grabY: number,
): { Update: (clientX: number, clientY: number) => void; Remove: () => void } {
  const doc = view.state.doc;
  const container = document.createElement("div");
  container.className = "block-drag-preview";
  container.style.position = "fixed";

  let offsetX = 0;
  let offsetY = 0;
  let firstRect: DOMRect | null = null;
  doc.forEach((node, offset) => {
    const nodeEnd = offset + node.nodeSize;
    if (offset >= range.to || nodeEnd <= range.from) return;
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    if (!firstRect) firstRect = dom.getBoundingClientRect();
    const clone = dom.cloneNode(true) as HTMLElement;
    clone.style.pointerEvents = "none";
    container.appendChild(clone);
  });

  if (firstRect) {
    const rect: DOMRect = firstRect;
    // Grab offset is measured against the clone's own content box (before
    // the preview's card padding is added below), so the pointer stays over
    // the same spot in the clone it grabbed in the real block.
    offsetX = grabX - rect.left;
    offsetY = grabY - rect.top;
    // .block-drag-preview is box-sizing: border-box with its own padding —
    // widen by that padding so the *content* keeps the original block's
    // width instead of being squeezed narrower by it.
    container.style.width = `${rect.width + 28}px`;
    offsetX += 14;
    offsetY += 10;
  }

  document.body.appendChild(container);

  // Keep the floating preview inside the document container — without this
  // it can be dragged past the visible page (over the sidebar, off-screen,
  // etc.), which reads as broken since there's nothing to actually drop it
  // on out there.
  const bounds = view.dom.closest<HTMLElement>("[data-marquee-zone]");

  function Update(clientX: number, clientY: number) {
    let left = clientX - offsetX;
    let top = clientY - offsetY;
    if (bounds) {
      const boundsRect = bounds.getBoundingClientRect();
      const maxLeft = Math.max(boundsRect.right - container.offsetWidth, boundsRect.left);
      const maxTop = Math.max(boundsRect.bottom - container.offsetHeight, boundsRect.top);
      left = Math.min(Math.max(left, boundsRect.left), maxLeft);
      top = Math.min(Math.max(top, boundsRect.top), maxTop);
    }
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
  }
  Update(grabX, grabY);

  return { Update, Remove: () => container.remove() };
}

function CreateMarqueeOverlay(): HTMLDivElement {
  const overlay = document.createElement("div");
  // Position/size are updated per-frame below; everything else (translucent
  // fill, border, rounded corners) lives in the .marquee-box rule in
  // globals.css.
  overlay.className = "marquee-box";
  overlay.style.position = "fixed";
  document.body.appendChild(overlay);
  return overlay;
}

function CreateDropIndicator(): HTMLDivElement {
  const indicator = document.createElement("div");
  indicator.className = "drop-indicator";
  indicator.style.position = "fixed";
  document.body.appendChild(indicator);
  return indicator;
}

/** Whether `clientX` falls in the empty padding beside the editor's actual
 * text content (rather than on the text itself). */
function IsInGutter(view: EditorView, clientX: number): boolean {
  const rect = view.dom.getBoundingClientRect();
  const styles = getComputedStyle(view.dom);
  const contentLeft = rect.left + (parseFloat(styles.paddingLeft) || 0);
  const contentRight = rect.right - (parseFloat(styles.paddingRight) || 0);
  return clientX < contentLeft || clientX > contentRight;
}

/** Anything a block's own NodeView wants to keep clickable no matter what —
 * form controls, links, its own drag-to-reorder rows (e.g. a to-do task
 * row), and anything explicitly opted out via `data-block-drag-ignore`
 * (e.g. the rename-on-click title/description spans in TodoListView, which
 * aren't a native `<input>` until actively being edited). Shared between the
 * marquee's "is this the background" check and RunBlockMove's "did the user
 * grab the selection to move it" check below — a click on any of these
 * should never be swallowed as the start of a drag. */
const INTERACTIVE_SELECTOR =
  'input, textarea, button, a, [draggable="true"], [data-block-drag-ignore="true"], [data-marquee-ignore="true"]';

/** Same idea as `INTERACTIVE_SELECTOR`, but *without* `[draggable="true"]` —
 * used only for "did the user grab the current selection to move it" below.
 * A to-do block's task rows are `draggable` (for their own in-list
 * drag-to-reorder), but once the whole block is selected, grabbing anywhere
 * on it — including a task row's own background — should move the block as
 * a unit (that's the entire point of selecting it first); only its actual
 * controls (buttons, the rename inputs/spans, links) should stay exempt. */
const MOVE_TRIGGER_EXCLUDED_SELECTOR =
  'input, textarea, button, a, [data-block-drag-ignore="true"], [data-marquee-ignore="true"]';

/** Requirement: the marquee only ever starts on the *background* — never on
 * text, never on an interactive element (input/textarea/button/link/anything
 * draggable). Clicking directly on `view.dom` itself (blank space below or
 * between blocks) or in the side gutter counts as background; everything
 * else is left to native text selection / the element's own click handler. */
/**
 * Leží bod události na posuvníku prvku? Scrollbar je mimo jeho
 * `clientWidth`/`clientHeight`, ale událost má za cíl pořád ten prvek —
 * bez téhle výjimky tažení za posuvník spustí marquee: nakreslí modrou
 * čáru (obdélník nulové šířky), sebere scrollu pohyb a na dlouhém
 * dokumentu appku uvaří přepočítáváním bloků při každém posunu.
 */
function IsOnScrollbar(event: PointerEvent, element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    event.clientX > rect.left + element.clientLeft + element.clientWidth ||
    event.clientY > rect.top + element.clientTop + element.clientHeight
  );
}

function IsBackgroundTarget(view: EditorView, event: PointerEvent): boolean {
  const target = event.target;
  if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) {
    return false;
  }
  if (target === view.dom) return !IsOnScrollbar(event, view.dom as HTMLElement);
  return IsInGutter(view, event.clientX);
}

/** A drag-to-select-text gesture inside an already-focused input/textarea
 * (e.g. a to-do task's rename field, a Scenario beat's time/title/text)
 * keeps that element as `document.activeElement` for its whole duration —
 * checking this, not just the pointerdown's own `event.target`, catches a
 * drag that starts on the focused field but where the *next* pointerdown
 * (rare, but e.g. a fast re-click) or a delegated event resolves its target
 * to something else in the same node view. Belt-and-suspenders alongside
 * `INTERACTIVE_SELECTOR`: a focused text field should never lose a
 * selection drag to the marquee/move system, full stop. */
function IsFocusedTextField(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLElement && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
}

/** Disables pointer events (and native text selection) on the whole page
 * while a marquee/move drag is active, so hovering or releasing over nested
 * interactive content mid-drag (a to-do task's checkbox, its "+"/settings
 * buttons, etc.) never triggers it by accident, and the browser's own
 * text-selection highlight never appears alongside ours. */
function SetPageDragging(active: boolean) {
  document.body.classList.toggle("lockin-block-dragging", active);
}

/**
 * Only one marquee/move drag can ever be in flight — starting a new one
 * always force-ends whatever came before. This is what makes losing the
 * pointerup (alt-tab, the window losing focus mid-drag, anything that stops
 * the OS from ever delivering it) harmless instead of leaking a stuck
 * overlay and a duplicate set of listeners the next time a drag starts.
 */
let activeDragCleanup: (() => void) | null = null;

function AttachLifecycle(cleanup: () => void): {
  OnVisibilityChange: () => void;
  Register: () => void;
} {
  function OnVisibilityChange() {
    if (document.hidden) cleanup();
  }
  function Register() {
    activeDragCleanup = cleanup;
    window.addEventListener("blur", cleanup);
    document.addEventListener("visibilitychange", OnVisibilityChange);
  }
  return { OnVisibilityChange, Register };
}

/** requestAnimationFrame-throttles a per-move callback so intersection tests
 * run at most once per frame, no matter how many pointermove events the
 * pointer-captured element fires in between. */
function CreateRafThrottle<E>(run: (event: E) => void): {
  Schedule: (event: E) => void;
  Cancel: () => void;
} {
  let rafId: number | null = null;
  let pending: E | null = null;
  function Flush() {
    rafId = null;
    if (pending === null) return;
    const event = pending;
    pending = null;
    run(event);
  }
  return {
    Schedule(event: E) {
      pending = event;
      if (rafId === null) rafId = requestAnimationFrame(Flush);
    },
    Cancel() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      pending = null;
    },
  };
}

const EDGE_SCROLL_ZONE_PX = 60;
const EDGE_SCROLL_MAX_SPEED_PX = 18;

/**
 * Auto-scrolls the document container while the pointer sits near its top or
 * bottom edge during a drag — measured against the scrollable
 * `[data-marquee-zone]` container (the same element the marquee itself can
 * start a drag from), not the viewport, so this still works correctly when
 * the editor doesn't fill the whole window. Runs its own rAF loop
 * independent of pointermove events, since the pointer can simply sit still
 * near the edge and scrolling should keep going. The resulting `scrollTop`
 * change fires a native `scroll` event, which `TrackScrollDuringDrag` (below)
 * already listens for to keep the drag's own math in sync — this only needs
 * to move the container, nothing else.
 */
function CreateAutoScroller(view: EditorView, getLastEvent: () => PointerEvent): () => void {
  const container = view.dom.closest<HTMLElement>("[data-marquee-zone]") ?? view.dom;
  let rafId: number | null = null;

  function Tick() {
    const rect = container.getBoundingClientRect();
    const { clientY } = getLastEvent();

    let delta = 0;
    if (clientY < rect.top + EDGE_SCROLL_ZONE_PX) {
      const intensity = (rect.top + EDGE_SCROLL_ZONE_PX - clientY) / EDGE_SCROLL_ZONE_PX;
      delta = -EDGE_SCROLL_MAX_SPEED_PX * Math.min(Math.max(intensity, 0), 1);
    } else if (clientY > rect.bottom - EDGE_SCROLL_ZONE_PX) {
      const intensity = (clientY - (rect.bottom - EDGE_SCROLL_ZONE_PX)) / EDGE_SCROLL_ZONE_PX;
      delta = EDGE_SCROLL_MAX_SPEED_PX * Math.min(Math.max(intensity, 0), 1);
    }
    if (delta !== 0) container.scrollTop += delta;

    rafId = requestAnimationFrame(Tick);
  }

  rafId = requestAnimationFrame(Tick);
  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  };
}

/**
 * Keeps a drag pinned to the same *content* pixel as the page scrolls.
 * `getBoundingClientRect()` (used for every item's rect) is always viewport-
 * relative and updates for free — but a drag's own *anchor* point, captured
 * once at pointerdown as a raw viewport coordinate, does not: if the
 * container scrolls mid-drag (wheel, or dragging near an edge), that fixed
 * viewport point silently stops corresponding to the content pixel it
 * started on. `adjustAnchor` shifts the caller's stored anchor by the same
 * delta the container scrolled, and `onRecompute` re-runs the drag's own
 * per-move logic with the last known pointer position, since content can
 * shift under an otherwise-stationary cursor. Scroll events don't bubble,
 * so this listens on `document` with `capture: true`, which still sees them
 * from any scrollable descendant.
 */
function TrackScrollDuringDrag(
  getLastEvent: () => PointerEvent,
  onRecompute: (event: PointerEvent) => void,
  adjustAnchor: (dx: number, dy: number) => void,
): () => void {
  let scrollTarget: EventTarget | null = null;
  let lastLeft = 0;
  let lastTop = 0;

  function OnScroll(event: Event) {
    const el = event.target;
    const scrollLeft = el instanceof HTMLElement ? el.scrollLeft : (document.scrollingElement?.scrollLeft ?? null);
    const scrollTop = el instanceof HTMLElement ? el.scrollTop : (document.scrollingElement?.scrollTop ?? null);
    if (scrollLeft === null || scrollTop === null) return;

    if (scrollTarget === null) {
      scrollTarget = el;
      lastLeft = scrollLeft;
      lastTop = scrollTop;
      return;
    }
    if (el !== scrollTarget) return;

    const dx = scrollLeft - lastLeft;
    const dy = scrollTop - lastTop;
    lastLeft = scrollLeft;
    lastTop = scrollTop;
    if (dx === 0 && dy === 0) return;
    adjustAnchor(dx, dy);
    onRecompute(getLastEvent());
  }

  document.addEventListener("scroll", OnScroll, true);
  return () => document.removeEventListener("scroll", OnScroll, true);
}

/**
 * Drives a Windows-Explorer-style marquee drag starting from `startEvent`,
 * which must already have passed `IsBackgroundTarget`. Tracked via Pointer
 * Events with `setPointerCapture` on `view.dom`, so move/up keep arriving
 * even if the cursor leaves the editor mid-drag — no `window` listeners
 * needed for those two. `Shift`/`Cmd`/`Ctrl` held at drag start extends the
 * selection that existed before the drag instead of replacing it. A plain
 * click with no real movement clears the selection (collapses the cursor
 * near the click point) — Explorer's "click empty space to deselect".
 */
function RunBlockMarquee(view: EditorView, startEvent: PointerEvent) {
  activeDragCleanup?.();

  let startX = startEvent.clientX;
  let startY = startEvent.clientY;
  const additive = startEvent.shiftKey || startEvent.metaKey || startEvent.ctrlKey;
  const baseSelection = view.state.selection;
  const baseRange: BlockRange | null =
    additive && !baseSelection.empty ? { from: baseSelection.from, to: baseSelection.to } : null;

  let overlay: HTMLDivElement | null = null;
  let moved = false;
  let lastPointerEvent = startEvent;
  let finalRange: BlockRange | null = baseRange;
  let stopAutoScroll: (() => void) | null = null;

  function ApplyMove(event: PointerEvent) {
    const rect: MarqueeRect = {
      left: Math.min(startX, event.clientX),
      top: Math.min(startY, event.clientY),
      width: Math.abs(event.clientX - startX),
      height: Math.abs(event.clientY - startY),
    };

    if (!moved && Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD_PX) {
      return;
    }
    moved = true;
    SetPageDragging(true);
    overlay = overlay ?? CreateMarqueeOverlay();
    stopAutoScroll = stopAutoScroll ?? CreateAutoScroller(view, () => lastPointerEvent);
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    const doc = view.state.doc;
    let firstIndex = -1;
    let lastIndex = -1;
    doc.forEach((_node, offset, index) => {
      const dom = view.nodeDOM(offset);
      if (!(dom instanceof HTMLElement)) return;
      if (RectsIntersect(rect, dom.getBoundingClientRect())) {
        if (firstIndex === -1) firstIndex = index;
        lastIndex = index;
      }
    });

    if (firstIndex === -1) {
      // Nothing under the rectangle this frame — fall back to whatever was
      // selected before the drag started (so extending an existing
      // selection with Shift never gets wiped out just because the live
      // rectangle briefly isn't touching anything new), or clear entirely
      // for a fresh (non-additive) drag.
      finalRange = baseRange;
      view.dispatch(view.state.tr.setMeta(BlockSelectionPluginKey, { range: baseRange }));
      return;
    }

    let { from, to } = SpanForBlockRange(doc, firstIndex, lastIndex);
    if (baseRange) {
      from = Math.min(from, baseRange.from);
      to = Math.max(to, baseRange.to);
    }
    finalRange = { from, to };
    // Meta-only — no real Selection change (and so no risk of it snapping
    // away from a trailing atom node) while the drag is still in progress.
    // Decorations render straight from this range (see plugin state above).
    view.dispatch(view.state.tr.setMeta(BlockSelectionPluginKey, { range: finalRange }));
  }

  const throttle = CreateRafThrottle(ApplyMove);

  function OnPointerMove(event: PointerEvent) {
    event.preventDefault();
    lastPointerEvent = event;
    throttle.Schedule(event);
  }

  const untrackScroll = TrackScrollDuringDrag(
    () => lastPointerEvent,
    (event) => throttle.Schedule(event),
    (dx, dy) => {
      startX -= dx;
      startY -= dy;
    },
  );

  function OnPointerUp(event: PointerEvent) {
    throttle.Cancel();
    if (!moved) {
      // A plain click on the background — deselect (collapse the cursor
      // near the click instead of leaving the previous selection lit up).
      const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (pos) {
        const { doc } = view.state;
        view.dispatch(
          view.state.tr
            .setSelection(TextSelection.near(doc.resolve(pos.pos)))
            .setMeta(BlockSelectionPluginKey, { range: null }),
        );
      }
    } else if (finalRange) {
      // Commit a real Selection now that the drag is done — needed for
      // copy/cut and for RunBlockMove to recognize a follow-up drag as
      // "grabbing the selection". .between() snaps to the nearest valid
      // text position instead of throwing when a boundary lands right after
      // an atom node; the highlight itself no longer depends on this
      // resolving exactly, so any snap here is cosmetic, not a correctness
      // issue for what's visibly selected.
      const { doc } = view.state;
      const range = finalRange;
      view.dispatch(
        view.state.tr
          .setSelection(TextSelection.between(doc.resolve(range.from), doc.resolve(range.to)))
          .setMeta(BlockSelectionPluginKey, { range }),
      );
    }
    Cleanup();
  }

  function Cleanup() {
    throttle.Cancel();
    untrackScroll();
    stopAutoScroll?.();
    stopAutoScroll = null;
    try {
      view.dom.releasePointerCapture(startEvent.pointerId);
    } catch {
      // already released (e.g. pointer already up)
    }
    view.dom.removeEventListener("pointermove", OnPointerMove);
    view.dom.removeEventListener("pointerup", OnPointerUp);
    window.removeEventListener("blur", Cleanup);
    document.removeEventListener("visibilitychange", lifecycle.OnVisibilityChange);
    overlay?.remove();
    overlay = null;
    SetPageDragging(false);
    if (activeDragCleanup === Cleanup) activeDragCleanup = null;
  }

  const lifecycle = AttachLifecycle(Cleanup);
  view.dom.setPointerCapture(startEvent.pointerId);
  view.dom.addEventListener("pointermove", OnPointerMove);
  view.dom.addEventListener("pointerup", OnPointerUp);
  lifecycle.Register();
}

/**
 * Drags the *current* multi-block selection to a new position in the
 * document — reordering. Native contentEditable drag-to-move doesn't
 * reliably work here (same root cause as the marquee needing its own
 * tracking: the editor's custom atom node views break it), so this is
 * tracked by hand too: a thin blue line follows the nearest block edge as
 * the pointer moves, and releasing cuts the selected block range and
 * reinserts it right there. The dragged block(s) get a "lifted" ghost style
 * via `movingRange` in plugin state (see BlockSelectionExtension below).
 */
function RunBlockMove(view: EditorView, startEvent: PointerEvent) {
  activeDragCleanup?.();

  const { selection } = view.state;
  const selFrom = selection.from;
  const selTo = selection.to;
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;

  let indicator: HTMLDivElement | null = null;
  let preview: { Update: (x: number, y: number) => void; Remove: () => void } | null = null;
  let engaged = false;
  let targetPos: number | null = null;
  let lastPointerEvent = startEvent;
  let stopAutoScroll: (() => void) | null = null;

  function ApplyMove(event: PointerEvent) {
    if (!engaged && Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD_PX) {
      return;
    }
    if (!engaged) {
      engaged = true;
      SetPageDragging(true);
      document.body.classList.add("lockin-block-moving");
      view.dispatch(
        view.state.tr.setMeta(BlockSelectionPluginKey, { movingRange: { from: selFrom, to: selTo } }),
      );
      preview = CreateDragPreview(view, { from: selFrom, to: selTo }, startX, startY);
      stopAutoScroll = CreateAutoScroller(view, () => lastPointerEvent);
    }
    preview?.Update(event.clientX, event.clientY);

    const doc = view.state.doc;
    let bestPos: number | null = null;
    let bestRect: DOMRect | null = null;
    let bestIsBottomEdge = false;
    let offset = 0;
    let stop = false;
    doc.forEach((node, nodeOffset) => {
      if (stop) return;
      offset = nodeOffset;
      const el = view.nodeDOM(nodeOffset);
      if (!(el instanceof HTMLElement)) return;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (event.clientY < mid) {
        bestPos = offset;
        bestRect = rect;
        bestIsBottomEdge = false;
        stop = true;
        return;
      }
      bestPos = offset + node.nodeSize;
      bestRect = rect;
      bestIsBottomEdge = true;
    });
    if (bestPos === null || !bestRect) return;
    // TS can't re-widen a `let`'s narrowed type after it was reassigned
    // inside the doc.forEach callback above — snapshot into fresh consts.
    const finalPos = bestPos;
    const finalRect: DOMRect = bestRect;

    // Dropping inside the range being moved is a no-op — show no indicator.
    if (finalPos > selFrom && finalPos < selTo) {
      targetPos = null;
      indicator?.remove();
      indicator = null;
      return;
    }

    targetPos = finalPos;
    indicator = indicator ?? CreateDropIndicator();
    const lineY = bestIsBottomEdge ? finalRect.bottom : finalRect.top;
    indicator.style.left = `${finalRect.left}px`;
    indicator.style.top = `${lineY - 1.5}px`;
    indicator.style.width = `${finalRect.width}px`;
  }

  const throttle = CreateRafThrottle(ApplyMove);

  function OnPointerMove(event: PointerEvent) {
    event.preventDefault();
    lastPointerEvent = event;
    throttle.Schedule(event);
  }

  const untrackScroll = TrackScrollDuringDrag(
    () => lastPointerEvent,
    (event) => throttle.Schedule(event),
    () => {
      // No stored anchor to shift — every frame is computed directly from
      // the pointer position against live (scroll-aware) bounding rects.
    },
  );

  function OnPointerUp() {
    throttle.Cancel();
    if (targetPos !== null && (targetPos <= selFrom || targetPos >= selTo)) {
      const slice = view.state.doc.slice(selFrom, selTo);
      const tr = view.state.tr.delete(selFrom, selTo);
      const mappedTarget = tr.mapping.map(targetPos);
      tr.insert(mappedTarget, slice.content);
      tr.setMeta(BlockSelectionPluginKey, { movingRange: null });
      view.dispatch(tr);
    } else {
      view.dispatch(view.state.tr.setMeta(BlockSelectionPluginKey, { movingRange: null }));
    }
    Cleanup();
  }

  function Cleanup() {
    untrackScroll();
    throttle.Cancel();
    stopAutoScroll?.();
    stopAutoScroll = null;
    try {
      view.dom.releasePointerCapture(startEvent.pointerId);
    } catch {
      // already released
    }
    view.dom.removeEventListener("pointermove", OnPointerMove);
    view.dom.removeEventListener("pointerup", OnPointerUp);
    window.removeEventListener("blur", Cleanup);
    document.removeEventListener("visibilitychange", lifecycle.OnVisibilityChange);
    indicator?.remove();
    indicator = null;
    preview?.Remove();
    preview = null;
    document.body.classList.remove("lockin-block-moving");
    SetPageDragging(false);
    if (activeDragCleanup === Cleanup) activeDragCleanup = null;
  }

  const lifecycle = AttachLifecycle(Cleanup);
  view.dom.setPointerCapture(startEvent.pointerId);
  view.dom.addEventListener("pointermove", OnPointerMove);
  view.dom.addEventListener("pointerup", OnPointerUp);
  lifecycle.Register();
}

/**
 * Wires up marquee selection starting from anywhere within `zone` — not just
 * inside the ProseMirror-editable region itself. A project's root document
 * page wraps the editor with a header/contents rail above it (outside
 * `view.dom`), so relying solely on the plugin's own `handleDOMEvents` (which
 * only fires for events inside `view.dom`) meant the marquee couldn't be
 * started from anywhere over that header.
 *
 * The header/chrome content itself is never meant to be text-selectable —
 * that's handled declaratively via `user-select: none` on `[data-marquee-zone]`
 * in globals.css (with `user-select: text` restored for inputs/contentEditable
 * descendants).
 */
export function AttachMarqueeZone(view: EditorView, zone: HTMLElement): () => void {
  function OnPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    if (view.dom.contains(event.target as Node)) return;
    if (IsOnScrollbar(event, zone)) return;
    if (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR)) return;
    if (IsFocusedTextField()) return;
    RunBlockMarquee(view, event);
  }
  zone.addEventListener("pointerdown", OnPointerDown);
  return () => zone.removeEventListener("pointerdown", OnPointerDown);
}

/**
 * Smaže rozsah vybraných bloků. Nejde použít `deleteSelection`: marquee
 * commituje `TextSelection.between`, která neumí stát uvnitř atomových uzlů
 * (to-do list, vzorec, kartičky, média), takže nad samými atomy zkolabuje do
 * kurzoru a nativní Delete nemá co mazat. Rozsah proto bereme z pluginu.
 */
function DeleteBlockRange(view: EditorView, range: BlockRange): void {
  const tr = view.state.tr.deleteRange(range.from, range.to);
  // Prázdný dokument schéma (`block+`) nedovolí — po smazání všeho musí
  // zůstat aspoň jeden odstavec.
  if (tr.doc.content.size === 0) tr.insert(0, view.state.schema.nodes.paragraph.create());
  const at = Math.min(range.from, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(at)));
  view.dispatch(tr.setMeta(BlockSelectionPluginKey, { range: null }));
  view.focus();
}

/**
 * Zkopíruje vybrané bloky přes serializér ProseMirroru, takže v HTML jde
 * i `data-pm-slice` a atributy uzlů (config to-do listu, barvy, latex…).
 * Vložení do jiného dokumentu je pak rekonstrukce téhož, ne přepis textu.
 */
function CopyBlockRange(view: EditorView, event: ClipboardEvent, range: BlockRange): boolean {
  if (!event.clipboardData) return false;
  const { dom, text } = view.serializeForClipboard(view.state.doc.slice(range.from, range.to));
  event.clipboardData.clearData();
  event.clipboardData.setData("text/html", dom.innerHTML);
  event.clipboardData.setData("text/plain", text);
  event.preventDefault();
  return true;
}

/**
 * Notion/Figma/Explorer-style block selection. Native browser drag-selection
 * doesn't reliably extend through the editor's custom `contentEditable={false}`
 * node views (e.g. the rich to-do list), so instead of trusting the DOM
 * Selection API we track the drag ourselves and draw our own marquee
 * rectangle (like a Windows Explorer rubber-band) — any top-level block
 * whose bounding box intersects that rectangle gets selected.
 *
 * The marquee only ever starts on the background (see IsBackgroundTarget) —
 * a drag starting on actual text is always left to native text selection,
 * full stop, and a drag starting on a `draggable` element (e.g. a task row
 * inside the embedded to-do block, which has its own drag-to-reorder) is
 * left alone entirely. A drag starting *inside* the current multi-block
 * selection instead moves it (see RunBlockMove above).
 */
export const BlockSelectionExtension = Extension.create({
  name: "blockSelectionHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<BlockSelectionPluginState>({
        key: BlockSelectionPluginKey,
        state: {
          init: () => ({ range: null, movingRange: null }),
          apply(tr, value) {
            // Always map through a doc-changing transaction first (e.g.
            // RunBlockMove's final delete+insert) — regardless of whether it
            // also carries meta for a *different* field — so a range that
            // isn't mentioned in this transaction's meta never goes stale
            // pointing at positions that no longer mean the same thing.
            let next = value;
            if (tr.docChanged) {
              next = {
                range: next.range
                  ? { from: tr.mapping.map(next.range.from), to: tr.mapping.map(next.range.to) }
                  : null,
                movingRange: next.movingRange
                  ? { from: tr.mapping.map(next.movingRange.from), to: tr.mapping.map(next.movingRange.to) }
                  : null,
              };
            }

            const meta = tr.getMeta(BlockSelectionPluginKey) as Partial<BlockSelectionPluginState> | undefined;
            if (meta) {
              return {
                range: "range" in meta ? (meta.range ?? null) : next.range,
                movingRange: "movingRange" in meta ? (meta.movingRange ?? null) : next.movingRange,
              };
            }

            // Any selection-changing transaction we didn't tag ourselves —
            // a plain click, selecting a word, arrow-key navigation — means
            // this is no longer "our" selection.
            if (tr.selectionSet) return { range: null, movingRange: next.movingRange };
            return next;
          },
        },
        props: {
          decorations(state) {
            const pluginState = BlockSelectionPluginKey.getState(state);
            if (!pluginState) return null;
            const decorations: Decoration[] = [];
            if (pluginState.range) {
              decorations.push(...BlockRangeDecorations(state.doc, pluginState.range, "block-select-highlight"));
            }
            if (pluginState.movingRange) {
              decorations.push(...BlockRangeDecorations(state.doc, pluginState.movingRange, "block-being-moved"));
            }
            return decorations.length ? DecorationSet.create(state.doc, decorations) : null;
          },
          handleKeyDown(view: EditorView, event: KeyboardEvent) {
            if (event.key !== "Backspace" && event.key !== "Delete") return false;
            const range = BlockSelectionPluginKey.getState(view.state)?.range;
            if (!range) return false;
            event.preventDefault();
            DeleteBlockRange(view, range);
            return true;
          },
          handleDOMEvents: {
            copy(view: EditorView, event: Event) {
              const range = BlockSelectionPluginKey.getState(view.state)?.range;
              return range ? CopyBlockRange(view, event as ClipboardEvent, range) : false;
            },
            cut(view: EditorView, event: Event) {
              const range = BlockSelectionPluginKey.getState(view.state)?.range;
              if (!range || !CopyBlockRange(view, event as ClipboardEvent, range)) return false;
              DeleteBlockRange(view, range);
              return true;
            },
            pointerdown(view: EditorView, event: Event) {
              const pointerEvent = event as PointerEvent;
              if (pointerEvent.button !== 0) return false;
              if (IsFocusedTextField()) return false;

              // Grabbing anywhere inside the current selection moves it as a
              // whole — even if that spot happens to be a draggable
              // descendant (a to-do task row), since once a block is
              // selected, dragging it is the unambiguous intent
              // (Explorer/Notion-style: you'd click away to deselect before
              // interacting with its contents again). Without this, a to-do
              // block was near-impossible to move, since almost its entire
              // visible area is covered by its own draggable task rows. Uses
              // geometric containment (PointInBlockRange), not a
              // `posAtCoords`-resolved position — see its doc comment for why
              // that didn't work for an atom block like the to-do list.
              //
              // Its own *controls* (buttons, links, rename inputs/spans)
              // stay exempt though — being selected shouldn't make a block
              // stop working: without this exclusion, once a to-do block was
              // ever selected once, its selection lingers as a plain
              // ProseMirror TextSelection (nothing about clicking inside a
              // `contentEditable={false}` NodeView tells ProseMirror the
              // selection changed), so *every* future click inside it —
              // "+ Add task", the settings gear, renaming the title — got
              // permanently hijacked into a drag attempt instead of reaching
              // the control.
              //
              // Gated on our own plugin `range` (the marquee-selected range),
              // not raw `view.state.selection` — an atom NodeView like the
              // to-do list can end up with a non-empty native ProseMirror
              // selection through paths that never touched the marquee (e.g.
              // a browser fallback "select the atom node" when a click
              // doesn't cleanly resolve, which is likelier when a task row's
              // own native drag doesn't fire — see RunBlockMove for why that
              // was replaced with pointer events). Such a selection shows no
              // blue highlight at all, since it never went through our own
              // dispatch, yet used to satisfy `!selection.empty` — silently
              // making the whole block draggable despite never actually
              // being marquee-selected. `range` is only ever set by our own
              // marquee code, so it's a true "was this selected via the
              // marquee" check.
              const pluginState = BlockSelectionPluginKey.getState(view.state);
              const selectedRange = pluginState?.range ?? null;
              const target = pointerEvent.target;
              const isMoveTriggerExcluded =
                target instanceof Element && target.closest(MOVE_TRIGGER_EXCLUDED_SELECTOR) !== null;
              if (
                !isMoveTriggerExcluded &&
                selectedRange &&
                PointInBlockRange(view, selectedRange, pointerEvent.clientX, pointerEvent.clientY)
              ) {
                // Without this, the browser's default "place the caret where
                // clicked" behavior still runs on this same pointerdown and
                // collapses the selection (and its highlight) before the
                // drag even starts.
                pointerEvent.preventDefault();
                RunBlockMove(view, pointerEvent);
                return false;
              }

              // Not part of a selection — defer to a draggable element's own
              // native drag (e.g. a to-do task row's drag-to-reorder within
              // its own list).
              if (target instanceof Element && target.closest('[draggable="true"]')) {
                return false;
              }

              if (!IsBackgroundTarget(view, pointerEvent)) return false;

              RunBlockMarquee(view, pointerEvent);
              return false;
            },
          },
        },
      }),
    ];
  },
});
