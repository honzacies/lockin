"use client";

import { useEffect, useState } from "react";
import { Input, Tabs } from "@heroui/react";
import type { JSONContent } from "@tiptap/react";
import type { DocumentMode, DocumentRecord, SketchContent } from "@lockin/shared/Types/Project";
import { DocumentModeToolbar } from "@lockin/shared/Components/AppShell/DocumentModeToolbar";
import { RichTextEditor } from "@lockin/shared/Components/DocumentView/RichTextEditor";
import { LinkedFrom } from "@lockin/shared/Components/DocumentView/LinkedFrom";
import { DocumentCanvas } from "@lockin/shared/Components/DocumentView/DocumentCanvas";
import { TagSelector } from "@lockin/shared/Components/Shared/TagSelector";
import { DefaultDocumentName } from "@lockin/shared/Lib/CreateDocument";
import { BlockStyleModal } from "@lockin/shared/Components/DocumentView/StyleEditor/BlockStyleModal";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { UpdatedPill } from "@lockin/shared/Components/Shared/MetaPills";
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

  // Text změněný zvenku (MCP, To-do Home) — draft ho převezme a editor se
  // přes `key` znovu připojí s novým obsahem.
  useEffect(() => {
    draftRef.current = { ...draftRef.current, text: document.text, revision: document.revision };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jen při změně zvenku
  }, [document.revision]);

  function HandleModeChange(next: DocumentMode) {
    setDocumentMode(document.id, next);
    ScheduleSave({ lastMode: next });
  }

  const isWide = UseUiStore((state) => state.isDocumentWide);
  const styleEditorTarget = UseUiStore((state) => state.styleEditorTarget);
  const closeStyleEditor = UseUiStore((state) => state.CloseStyleEditor);

  function HandleTextChange(json: JSONContent) {
    ScheduleSave({ text: { json } });
  }

  function HandleSketchChange(sketch: SketchContent) {
    ScheduleSave({ sketch });
  }

  function CommitName() {
    // Prázdný název = zpět na výchozí (ve vaultu jméno souboru). Mění se jen
    // název v LockInu, soubor na disku se nepřejmenuje.
    const next = nameDraft.trim() || DefaultDocumentName(document.id);
    if (next !== document.name) ScheduleSave({ name: next });
    setNameDraft(next);
  }

  function CommitDescription() {
    if (descriptionDraft !== document.description) ScheduleSave({ description: descriptionDraft });
  }

  return (
    <>
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
        className={`min-h-0 flex-1 ${mode === "sketch" ? "flex flex-col overflow-hidden" : "overflow-y-auto pb-16"} ${
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
          className={
            mode === "sketch"
              ? "flex min-h-0 w-full flex-1 flex-col"
              : compact
                ? "flex w-full flex-col"
                : `mx-auto flex w-full flex-col ${isWide ? "" : "max-w-[850px]"}`
          }
        >
          {/* A sibling of both Tabs.Panels below (not nested inside the text
           * one), same as ProjectHeader/ProjectContents in ProjectView.tsx —
           * so it stays visible switching to Sketch mode too. Renders
           * identically in both modes — only the outer padding differs —
           * same reasoning as DocumentModeToolbar above. */}
          {/* Canvas mód = celá plocha jako stránka Canvas; hlavička jen u textu. */}
          <div className={`flex flex-col gap-4 ${compact ? "px-4 pt-4" : "px-[50px] pt-8"} ${mode === "sketch" ? "hidden" : ""}`}>
            <UpdatedPill at={document.updatedAt} />
            {/* textarea, ne input — dlouhý název se zalomí místo useknutí */}
            <textarea
              rows={1}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value.replace(/\n/g, " "))}
              onBlur={CommitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              placeholder="Untitled"
              className="w-full resize-none overflow-hidden bg-transparent text-[40px] leading-[1.15] font-medium tracking-[-0.8px] text-black outline-none [field-sizing:content] placeholder:text-[var(--lk-faint)]"
            />
            <Input
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onBlur={CommitDescription}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Add a description…"
              className="w-full bg-transparent shadow-none ring-0 text-lg text-[var(--lk-muted)] outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
              <TagSelector tagIds={document.tagIds} onToggle={(tagId) => UseDataStore.getState().ToggleDocumentTag(document.id, tagId)} />
            </div>
          </div>
          <Tabs.Panel id="text" className={`flex flex-1 flex-col ${compact ? "pt-4" : "pt-10"}`}>
            <RichTextEditor
              key={document.revision ?? 0}
              initialContent={document.text.json}
              onChange={HandleTextChange}
              style={document.style}
              compact={compact}
              smallText={document.smallText}
              locked={document.isLocked}
              themeForeground={document.theme?.foreground}
            />
            <LinkedFrom document={document} compact={compact} />
          </Tabs.Panel>
          <Tabs.Panel id="sketch" className="flex min-h-0 flex-1 flex-col">
            <DocumentCanvas key={document.id} sketch={document.sketch} onChange={HandleSketchChange} />
          </Tabs.Panel>
        </div>
      </div>
    </Tabs>
    {/* Editor stylů typu bloku (tužka ve slash menu, „Style…" v kontextovém menu). */}
    {styleEditorTarget ? (
      <BlockStyleModal
        blockType={styleEditorTarget}
        value={document.style?.[styleEditorTarget] ?? {}}
        onChange={(next) => ScheduleSave({ style: { ...(draftRef.current.style ?? {}), [styleEditorTarget]: next } })}
        onClose={closeStyleEditor}
      />
    ) : null}
    </>
  );
}
