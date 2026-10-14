import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { FileText, Plus } from "@lockin/shared/Components/Shared/UiIcons";
import { ProjectIcon } from "@lockin/shared/Components/Shared/ProjectIcon";

/** Položka nabídky po `[[`: existující dokument, nebo založení nového. */
export type WikiSuggestionItem =
  | { kind: "document"; id: string; name: string; icon?: string }
  | { kind: "create"; name: string };

export interface WikiSuggestionMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const WikiSuggestionMenu = forwardRef<
  WikiSuggestionMenuHandle,
  { items: WikiSuggestionItem[]; command: (item: WikiSuggestionItem) => void }
>(function WikiSuggestionMenu({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false;
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = items[selectedIndex];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="flex w-64 flex-col gap-px rounded-xl border border-[var(--lk-line)] bg-white p-1 shadow-lg">
      <p className="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider text-[var(--lk-subtle)] uppercase">Link to a note</p>
      {items.length === 0 ? (
        <p className="px-2 py-1.5 text-[13px] text-[var(--lk-muted)]">Keep typing a note name, or press Esc to leave it as text.</p>
      ) : (
        items.map((item, index) => (
          <button
            key={item.kind === "create" ? "create" : item.id}
            type="button"
            onMouseDown={(e) => (e.preventDefault(), command(item))}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-left text-[14px] ${
              index === selectedIndex ? "bg-black/[0.05]" : ""
            }`}
          >
            {item.kind === "create" ? (
              <>
                <Plus size={15} className="shrink-0 text-[var(--lk-muted)]" />
                <span className="truncate text-[var(--lk-text2)]">
                  Create note <span className="font-medium text-[var(--lk-ink)]">{item.name}</span>
                </span>
              </>
            ) : (
              <>
                {item.icon ? (
                  <ProjectIcon icon={item.icon} size={16} />
                ) : (
                  <FileText size={15} strokeWidth={1.75} className="shrink-0 text-[var(--lk-muted)]" />
                )}
                <span className="truncate text-[var(--lk-ink)]">{item.name}</span>
              </>
            )}
          </button>
        ))
      )}
    </div>
  );
});
