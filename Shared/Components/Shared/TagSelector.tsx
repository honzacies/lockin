"use client";

import { useState } from "react";
import { Button, Input } from "@heroui/react";
import { ChevronDown, Plus } from "@lockin/shared/Components/Shared/UiIcons";
import { DEFAULT_TAG_COLOR } from "@lockin/shared/Types/Library";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem } from "@lockin/shared/Components/Shared/ContextMenu";
import { PickerHeader, PILL_CLASS } from "@lockin/shared/Components/Shared/PriorityStatusPicker";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";

/** Library štítky dokumentu nebo projektu — oba sdílí jednu sadu (sidebar → Tags).
 * Pill s popoverem: zaškrtává se libovolně štítků, nový se dá založit rovnou tady. */
export function TagSelector({ tagIds, onToggle }: { tagIds: string[]; onToggle: (tagId: string) => void }) {
  const tags = UseDataStore((s) => s.tags);
  const tagList = Object.values(tags);
  const assignedTags = tagIds.map((id) => tags[id]).filter(Boolean);
  const [draft, setDraft] = useState("");

  function CreateTag() {
    const name = draft.trim();
    if (!name) return;
    const existing = tagList.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const store = UseDataStore.getState();
    const id = existing?.id ?? store.AddTag().id;
    if (!existing) store.RenameTag(id, name);
    if (!tagIds.includes(id)) onToggle(id);
    setDraft("");
  }

  return (
    <Popover
      trigger={() => (
        <Button
          variant="ghost"
          aria-label="Change tags"
          className={`${PILL_CLASS} bg-black/[0.03] text-[var(--lk-text2)] hover:bg-black/[0.06]`}
        >
          {assignedTags.length === 0 ? (
            "No tags"
          ) : (
            <span className="flex items-center gap-1.5">
              {assignedTags.map((tag) => (
                <span key={tag.id} className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full" style={{ background: tag.color ?? DEFAULT_TAG_COLOR }} />
                  {tag.name}
                </span>
              ))}
            </span>
          )}
          <ChevronDown size={12} strokeWidth={1.75} className="text-[var(--lk-subtle)]" />
        </Button>
      )}
      panelClassName="w-56 p-1"
    >
      {() => (
        <div className="flex flex-col gap-px">
          <PickerHeader title="Your tags" />
          {tagList.map((tag) => (
            <ContextMenuItem
              key={tag.id}
              icon={<span className="size-2.5 shrink-0 rounded-full" style={{ background: tag.color ?? DEFAULT_TAG_COLOR }} />}
              onClick={() => onToggle(tag.id)}
              selected={tagIds.includes(tag.id)}
            >
              {tag.name}
            </ContextMenuItem>
          ))}
          <div className="mt-1 flex items-center gap-1 border-t border-[var(--lk-line)] px-1 pt-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") CreateTag();
              }}
              placeholder="New tag…"
              aria-label="New tag name"
              className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[13px] shadow-none"
            />
            <Button
              variant="ghost"
              isIconOnly
              aria-label="Create tag"
              isDisabled={!draft.trim()}
              onPress={CreateTag}
              className="h-7 w-7 min-w-0 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.06] hover:text-[var(--lk-ink)]"
            >
              <Plus size={14} strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}
