"use client";

import { useState } from "react";
import { Button, Input } from "@heroui/react";
import { FileText, Home, Plus } from "@lockin/shared/Components/Shared/UiIcons";
import type { DocumentSummary } from "@lockin/shared/Types/Project";
import { ContextMenu } from "@lockin/shared/Components/Shared/ContextMenu";
import { SidebarItemMenu } from "@lockin/shared/Components/AppShell/SidebarItemMenu";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";

interface ProjectContentsProps {
  documents: DocumentSummary[];
  activeDocumentId: string | null;
  /** The project's own root document — shown as a "Home" pill when you're
   * viewing anything else, so you can always jump back to it. */
  homeDocumentId: string;
  onOpenDocument: (id: string) => void;
  onAddDocument: () => void;
  /** Library's 600px side panel vs the full page — must match whatever
   * left padding ProjectHeader.tsx and RichTextEditor.tsx use in the same
   * mode, or this rail's pills drift out of alignment with the icon/title
   * above and the editor content below it. */
  compact?: boolean;
}

const PILL =
  "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm transition-colors";

/** A single sub-document pill — right-click for rename/icon/tag/folder/delete
 * (the same `SidebarItemMenu` every other document row in the app uses), and
 * an inline rename input in place of the label when "Rename" is picked. */
function DocumentPill({
  doc,
  active,
  onOpenDocument,
}: {
  doc: DocumentSummary;
  active: boolean;
  onOpenDocument: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.name);

  function Commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === doc.name) {
      setDraft(doc.name);
      return;
    }
    UseDataStore.getState().RenameDocument(doc.id, trimmed);
  }

  return (
    <ContextMenu
      menu={(close) => (
        <SidebarItemMenu
          kind="document"
          id={doc.id}
          close={close}
          onRenameStart={() => {
            setDraft(doc.name);
            setEditing(true);
          }}
        />
      )}
    >
      {editing ? (
        <span
          className={`${PILL} ${
            active
              ? "border-[#0088ff]/30 bg-[#0088ff]/10 text-[#0088ff]"
              : "border-[var(--lk-line)] bg-[var(--lk-panel)] text-[var(--lk-text2)]"
          }`}
        >
          <FileText size={16} strokeWidth={1.5} className="shrink-0" />
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={Commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(doc.name);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent text-inherit outline-none"
            style={{ width: `${Math.max(draft.length, 4) + 1}ch` }}
          />
        </span>
      ) : (
        <Button
          variant="ghost"
          onPress={() => onOpenDocument(doc.id)}
          className={`h-auto font-normal ${PILL} ${
            active
              ? "border-[#0088ff]/30 bg-[#0088ff]/10 text-[#0088ff]"
              : "border-[var(--lk-line)] bg-[var(--lk-panel)] text-[var(--lk-text2)] hover:bg-black/[0.03]"
          }`}
        >
          <FileText size={16} strokeWidth={1.5} />
          {doc.name || "Untitled"}
        </Button>
      )}
    </ContextMenu>
  );
}

export function ProjectContents({
  documents,
  activeDocumentId,
  homeDocumentId,
  onOpenDocument,
  onAddDocument,
  compact = false,
}: ProjectContentsProps) {
  const showHome = activeDocumentId !== null && activeDocumentId !== homeDocumentId;

  return (
    <div className={`flex flex-col gap-2 py-4 ${compact ? "px-4" : "px-[50px]"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lk-subtle)]">
        Project documents
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Always mounted (not conditionally rendered) so max-width has
         * something to actually transition between — a mount/unmount can't
         * animate, since there's no "previous" state for the browser to
         * interpolate from. overflow-hidden clips the pill as its wrapper
         * collapses toward 0; shrink-0 on the pill itself keeps it at its
         * natural size instead of getting squished mid-transition. */}
        <div
          className={`overflow-hidden transition-[max-width,opacity] duration-200 ease-out ${
            showHome ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0"
          }`}
        >
          <Button
            variant="ghost"
            onPress={() => onOpenDocument(homeDocumentId)}
            className={`h-auto shrink-0 font-normal ${PILL} border-[var(--lk-line)] bg-[var(--lk-panel)] text-[var(--lk-text2)] hover:bg-black/[0.03]`}
          >
            <Home size={16} strokeWidth={1.5} />
            Home
          </Button>
        </div>

        {documents.map((doc) => (
          <DocumentPill
            key={doc.id}
            doc={doc}
            active={activeDocumentId === doc.id}
            onOpenDocument={onOpenDocument}
          />
        ))}

        <Button
          variant="ghost"
          onPress={onAddDocument}
          className={`h-auto font-normal ${PILL} border-dashed border-[var(--lk-line2)] text-[var(--lk-muted)] hover:border-[#0088ff]/40 hover:text-[#0088ff]`}
        >
          <Plus size={16} strokeWidth={1.5} />
          Create
        </Button>
      </div>
    </div>
  );
}
