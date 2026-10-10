"use client";

import { useEffect, useState } from "react";
import { Input } from "@heroui/react";

const DEFAULT_VIEW_CLASS = "truncate rounded px-0.5 hover:bg-black/[0.04]";
const DEFAULT_INPUT_CLASS =
  "min-w-0 flex-1 rounded border border-[var(--lk-gray)] bg-white px-1 py-0.5 text-sm font-medium text-[var(--lk-ink)] outline-none focus:border-[#0485f7]";

interface InlineRenameFieldProps {
  value: string;
  onCommit: (next: string) => void;
  /** Owned by the parent (not this component) so a context menu's "Rename"
   * action can flip it on from outside — e.g. Sidebar/ProjectsTable/
   * LibraryTable's rows all start editing via SidebarItemMenu's onRenameStart. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  viewClassName?: string;
  inputClassName?: string;
}

/** Click-to-rename text — a view-mode span that becomes a bordered input on
 * click (or when `editing` flips on externally), committing on blur/Enter
 * and reverting on Escape. Shared by every "name" cell across the Sidebar,
 * Library table, and Projects table, which all had their own hand-copy of
 * this exact behavior. */
export function InlineRenameField({
  value,
  onCommit,
  editing,
  onEditingChange,
  viewClassName,
  inputClassName,
}: InlineRenameFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (editing) setDraft(value);
    // Only entering edit mode should reset the draft — not every value change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function Commit() {
    onEditingChange(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else setDraft(value);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={Commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(value);
            onEditingChange(false);
          }
        }}
        className={inputClassName ?? DEFAULT_INPUT_CLASS}
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onEditingChange(true);
      }}
      className={viewClassName ?? DEFAULT_VIEW_CLASS}
    >
      {value}
    </span>
  );
}
