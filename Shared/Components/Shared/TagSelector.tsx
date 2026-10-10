"use client";

import { Button } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { DEFAULT_TAG_COLOR } from "@lockin/shared/Types/Library";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem } from "@lockin/shared/Components/Shared/ContextMenu";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";

/** Library štítky dokumentu nebo projektu — oba sdílí jednu sadu (sidebar → Tags),
 * pill s popoverem, ve kterém se štítky zaškrtávají. */
export function TagSelector({ tagIds, onToggle }: { tagIds: string[]; onToggle: (tagId: string) => void }) {
  const tags = UseDataStore((s) => s.tags);
  const tagList = Object.values(tags);
  const assignedTags = tagIds.map((id) => tags[id]).filter(Boolean);

  return (
    <Popover
      trigger={() => (
        <Button
          variant="ghost"
          className="h-auto gap-1 rounded-xl bg-black/[0.03] px-2 py-1 text-xs font-medium text-[var(--lk-text2)]"
        >
          {assignedTags.length === 0 ? (
            "No tags"
          ) : (
            <span className="flex items-center gap-1">
              {assignedTags.map((tag) => (
                <span key={tag.id} className="size-1.5 rounded-full" style={{ background: tag.color ?? DEFAULT_TAG_COLOR }} />
              ))}
              {assignedTags.map((tag) => tag.name).join(", ")}
            </span>
          )}
          <ChevronDown size={12} strokeWidth={1.75} className="text-[var(--lk-subtle)]" />
        </Button>
      )}
      panelClassName="w-52 p-1"
    >
      {() => (
        <div className="flex flex-col gap-px">
          {tagList.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[13px] text-[var(--lk-muted)]">No tags yet — add one in the sidebar under Tags</p>
          ) : (
            tagList.map((tag) => (
              <ContextMenuItem
                key={tag.id}
                icon={<span className="size-2 shrink-0 rounded-full" style={{ background: tag.color ?? DEFAULT_TAG_COLOR }} />}
                onClick={() => onToggle(tag.id)}
                selected={tagIds.includes(tag.id)}
              >
                {tag.name}
              </ContextMenuItem>
            ))
          )}
        </div>
      )}
    </Popover>
  );
}
