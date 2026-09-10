"use client";

import { useEffect, useState } from "react";
import { Button, Input, Tabs } from "@heroui/react";
import type { JSONContent } from "@tiptap/react";
import { ChevronDown, Clock } from "lucide-react";
import type { DocumentMode, DocumentRecord, SketchStroke } from "@lockin/shared/Types/Project";
import { DEFAULT_TAG_COLOR } from "@lockin/shared/Types/Library";
import { DocumentModeToolbar } from "@lockin/shared/Components/AppShell/DocumentModeToolbar";
import { RichTextEditor } from "@lockin/shared/Components/DocumentView/RichTextEditor";
import { LazySketchMode } from "@lockin/shared/Components/DocumentView/LazySketchMode";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem } from "@lockin/shared/Components/Shared/ContextMenu";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { FormatRelativeDate } from "@lockin/shared/Lib/FormatDate";
import { IsDarkBackground } from "@lockin/shared/Lib/ColorAdapt";
import { UseDebouncedDocumentSave } from "@lockin/shared/Components/DocumentView/UseDebouncedDocumentSave";

interface StandaloneDocumentEditorProps {
  document: DocumentRecord;
  /** 600px Library side panel vs a full page — passed straight through to
   * DocumentModeToolbar, the only place anything actually differs; the
   * header block below it (Updated pill, title, description, tags) renders
   * completely identically either way, just in a narrower container. */
  compact?: boolean;
  /** Compact mode only — closes the panel. */
  onClose?: () => void;
}

/** The document equivalent of ProjectHeader.tsx's tag pill — a document can
 * carry several Library tags (not one freeform string like a project), so
 * this toggles membership in a checklist instead of picking a single value,
 * but matches the same trigger-pill/popover shape. */
function DocumentTagSelector({ document }: { document: DocumentRecord }) {
  const tags = UseDataStore((s) => s.tags);
  const toggleTag = UseDataStore((s) => s.ToggleDocumentTag);
  const tagList = Object.values(tags);
  const assignedTags = document.tagIds.map((id) => tags[id]).filter(Boolean);

  return (
    <Popover
      trigger={() => (
        <Button
          variant="ghost"
          className="h-auto gap-1 rounded-xl bg-black/[0.03] px-2 py-1 text-xs font-medium text-[#5f5e59]"
        >
          {assignedTags.length === 0 ? (
            "No tags"
          ) : (
            <span className="flex items-center gap-1">
              {assignedTags.map((tag) => (
                <span
                  key={tag.id}
                  className="size-1.5 rounded-full"
                  style={{ background: tag.color ?? DEFAULT_TAG_COLOR }}
                />
              ))}
              {assignedTags.map((tag) => tag.name).join(", ")}
            </span>
          )}
          <ChevronDown size={12} strokeWidth={1.75} className="text-[#a5a49f]" />
        </Button>
      )}
      panelClassName="w-52 p-1"
    >
      {() => (
        <div className="flex flex-col gap-px">
          {tagList.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[13px] text-[#91918e]">No tags yet</p>
          ) : (
            tagList.map((tag) => (
              <ContextMenuItem
                key={tag.id}
                icon={
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: tag.color ?? DEFAULT_TAG_COLOR }}
                  />
                }
                onClick={() => toggleTag(document.id, tag.id)}
                selected={document.tagIds.includes(tag.id)}
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

/**
 * Note: the parent should key this by document.id when the id can change
 * (e.g. Library's panel swapping between docs), so mode/draft state resets
 * correctly without an effect watching for the id to change.
 */
export function StandaloneDocumentEditor({
  document,
  compact = false,
  onClose,
}: StandaloneDocumentEditorProps) {
  const mode = UseUiStore((state) => state.documentModeByDocId[document.id] ?? "text");
  const setDocumentMode = UseUiStore((state) => state.SetDocumentMode);
  const upsertDocument = UseDataStore((state) => state.UpsertDocument);
  const toggleFavorite = UseDataStore((state) => state.ToggleDocumentFavorite);

  const [nameDraft, setNameDraft] = useState(document.name);
  const [descriptionDraft, setDescriptionDraft] = useState(document.description);
  const { draftRef, ScheduleSave } = UseDebouncedDocumentSave({
    initialDocument: document,
    onSave: upsertDocument,
  });

  // The settings menu (style/theme/lock toggles) writes straight to the
  // store, bypassing ScheduleSave below — without this, a later debounced
  // save (e.g. from editing the title right after) would flush the stale
  // draftRef and silently revert whatever the settings menu just applied.
  useEffect(() => {
    draftRef.current = {
      ...draftRef.current,
      style: document.style,
      theme: document.theme,
      smallText: document.smallText,
      isLocked: document.isLocked,
      showTableOfContents: document.showTableOfContents,
    };
  }, [document.style, document.theme, document.smallText, document.isLocked, document.showTableOfContents]);

  function HandleModeChange(next: DocumentMode) {
    setDocumentMode(document.id, next);
    ScheduleSave({ lastMode: next });
  }

  function HandleTextChange(json: JSONContent) {
    ScheduleSave({ text: { json } });
  }

  function HandleSketchChange(strokes: SketchStroke[]) {
    ScheduleSave({ sketch: { strokes } });
  }

  function CommitName() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== document.name) ScheduleSave({ name: trimmed });
    else setNameDraft(document.name);
  }

  function CommitDescription() {
    if (descriptionDraft !== document.description) ScheduleSave({ description: descriptionDraft });
  }

  return (
    <Tabs
      selectedKey={mode}
      onSelectionChange={(key) => HandleModeChange(key as DocumentMode)}
      className="flex h-full flex-col"
    >
      <DocumentModeToolbar
        title={document.name}
        isFavorite={document.isFavorite}
        onToggleFavorite={() => toggleFavorite(document.id)}
        compact={compact}
        externalHref={compact ? `/Document?id=${document.id}` : undefined}
        onClose={compact ? onClose : undefined}
        document={document}
      />

      <div
        className={`min-h-0 flex-1 overflow-y-auto pb-16 ${
          document.theme?.adaptBlocks && IsDarkBackground(document.theme?.background)
            ? "lockin-adapt-blocks"
            : ""
        }`}
        data-marquee-zone=""
        style={{
          background: document.theme?.background,
          color: document.theme?.foreground,
        }}
      >
        <div
          className={compact ? "flex w-full flex-col" : "mx-auto flex w-full max-w-[850px] flex-col"}
        >
          {/* A sibling of both Tabs.Panels below (not nested inside the text
           * one), same as ProjectHeader/ProjectContents in ProjectView.tsx —
           * so it stays visible switching to Sketch mode too. Renders
           * identically in both modes — only the outer padding differs —
           * same reasoning as DocumentModeToolbar above. */}
          <div className={`flex flex-col gap-4 ${compact ? "px-4 pt-4" : "px-[50px] pt-8"}`}>
            <span className="flex w-fit items-center gap-1.5 rounded-[60px] bg-[#f1f0ef] px-2.5 py-[5px] text-sm text-[#5f5e59]">
              <Clock size={16} strokeWidth={1.5} />
              Updated {FormatRelativeDate(document.updatedAt)}
            </span>
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={CommitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Untitled"
              className="w-full bg-transparent shadow-none ring-0 text-[40px] font-medium tracking-[-0.8px] text-black outline-none"
            />
            <Input
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onBlur={CommitDescription}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Add a description…"
              className="w-full bg-transparent shadow-none ring-0 text-lg text-[#91918e] outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
              <DocumentTagSelector document={document} />
            </div>
          </div>
          <Tabs.Panel id="text" className={`flex flex-1 flex-col ${compact ? "pt-4" : "pt-10"}`}>
            <RichTextEditor
              initialContent={document.text.json}
              onChange={HandleTextChange}
              style={document.style}
              compact={compact}
              smallText={document.smallText}
              locked={document.isLocked}
              themeForeground={document.theme?.foreground}
            />
          </Tabs.Panel>
          <Tabs.Panel id="sketch" className="flex flex-1 flex-col">
            <LazySketchMode
              initialStrokes={document.sketch.strokes}
              onChange={HandleSketchChange}
            />
          </Tabs.Panel>
        </div>
      </div>
    </Tabs>
  );
}
