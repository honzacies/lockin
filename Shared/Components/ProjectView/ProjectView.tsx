"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs } from "@heroui/react";
import type { JSONContent } from "@tiptap/react";
import type {
  BlockStyle,
  DocumentMode,
  DocumentRecord,
  DocumentStyleConfig,
  DocumentSummary,
  Project,
  SketchContent,
  StyleableBlockType,
} from "@lockin/shared/Types/Project";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectContents } from "./ProjectContents";
import { DocumentModeToolbar } from "@lockin/shared/Components/AppShell/DocumentModeToolbar";
import { RichTextEditor } from "@lockin/shared/Components/DocumentView/RichTextEditor";
import { DocumentCanvas } from "@lockin/shared/Components/DocumentView/DocumentCanvas";
import { BlockStyleModal } from "@lockin/shared/Components/DocumentView/StyleEditor/BlockStyleModal";
import { ProjectIcon } from "@lockin/shared/Components/Shared/ProjectIcon";
import { SaveDocument } from "@lockin/shared/Lib/Storage";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { IsDarkBackground } from "@lockin/shared/Lib/ColorAdapt";
import { UseDebouncedDocumentSave } from "@lockin/shared/Components/DocumentView/UseDebouncedDocumentSave";

interface ProjectViewProps {
  project: Project;
  /** Whatever document is currently open in the body — the project's own
   * root document, or one of its sub-documents from the Contents rail. */
  activeDocument: DocumentRecord;
  subDocuments: DocumentSummary[];
  activeDocumentId?: string | null;
  onUpdateProject: (patch: Partial<Project>) => void;
  onOpenDocument: (id: string) => void;
  onAddDocument: () => void;
  onDocumentSaved?: (doc: DocumentRecord) => void;
  /** Library's 600px side panel vs the full page — passed straight through
   * to DocumentModeToolbar/ProjectHeader, which are the only two places
   * anything actually changes; everything else here renders identically. */
  compact?: boolean;
  /** Compact mode only — closes the panel. */
  onClose?: () => void;
}

/**
 * Note: this component is intentionally *not* remounted (no `key`) when the
 * active document changes — the parent used to key it by activeDocument.id,
 * which reset mode/draft state for free but also destroyed and recreated
 * ProjectHeader/ProjectContents on every document switch, killing any CSS
 * transition on them (e.g. the Contents rail's "Home" pill) since there was
 * never a previous DOM node to animate from. Mode/style/draft state now
 * resets via the effect below instead, keyed off activeDocument.id.
 */
export function ProjectView({
  project,
  activeDocument,
  subDocuments,
  activeDocumentId = null,
  onUpdateProject,
  onOpenDocument,
  onAddDocument,
  onDocumentSaved,
  compact = false,
  onClose,
}: ProjectViewProps) {
  const isWide = UseUiStore((state) => state.isDocumentWide);
  const toggleProjectFavorite = UseDataStore((state) => state.ToggleProjectFavorite);
  const styleEditorTarget = UseUiStore((state) => state.styleEditorTarget);
  const CloseStyleEditor = UseUiStore((state) => state.CloseStyleEditor);
  const [mode, setMode] = useState<DocumentMode>(activeDocument.lastMode);
  const [style, setStyle] = useState<DocumentStyleConfig>(
    activeDocument.style ?? {},
  );
  const { draftRef, ScheduleSave, FlushNow } = UseDebouncedDocumentSave({
    initialDocument: activeDocument,
    onSave: (saved) => {
      SaveDocument(saved)
        .then(() => onDocumentSaved?.(saved))
        .catch((error) => console.warn("SaveDocument failed", error));
    },
  });
  const activeDocumentIdRef = useRef(activeDocument.id);

  useEffect(() => {
    if (activeDocumentIdRef.current === activeDocument.id) return;
    activeDocumentIdRef.current = activeDocument.id;

    // Flush (rather than silently drop) a save still pending for the
    // document we're navigating away from — this component isn't remounted
    // between documents, so nothing else would ever cancel/flush it.
    FlushNow();

    setMode(activeDocument.lastMode);
    setStyle(activeDocument.style ?? {});
    draftRef.current = activeDocument;
    // Only the identity of the active document should trigger this reset —
    // not every field on it (e.g. a field updated by the flush above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocument.id]);

  // The settings menu (font/theme/lock toggles) writes straight to the
  // store, bypassing ScheduleSave/draftRef below — without this, the local
  // `style` state (kept for BlockStyleModal's optimistic edits) would never
  // notice a font change, and a later debounced save (e.g. typing right
  // after) would flush the stale draftRef and silently revert theme/lock/
  // smallText back to their old values. Comparing style against
  // draftRef.current.style (not just any change) skips this document's own
  // pending edits, which already update both in the same tick.
  useEffect(() => {
    if (activeDocument.style !== draftRef.current.style) {
      setStyle(activeDocument.style ?? {});
    }
    draftRef.current = {
      ...draftRef.current,
      style: activeDocument.style,
      theme: activeDocument.theme,
      smallText: activeDocument.smallText,
      isLocked: activeDocument.isLocked,
      showTableOfContents: activeDocument.showTableOfContents,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeDocument.style,
    activeDocument.theme,
    activeDocument.smallText,
    activeDocument.isLocked,
    activeDocument.showTableOfContents,
  ]);

  // Text změněný zvenku (MCP, To-do Home) — viz DocumentRecord.revision.
  useEffect(() => {
    draftRef.current = { ...draftRef.current, text: activeDocument.text, revision: activeDocument.revision };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocument.revision]);

  function HandleModeChange(next: DocumentMode) {
    setMode(next);
    ScheduleSave({ lastMode: next });
  }

  function HandleTextChange(json: JSONContent) {
    ScheduleSave({ text: { json } });
  }

  function HandleSketchChange(sketch: SketchContent) {
    ScheduleSave({ sketch });
  }

  // Applies a full BlockStyle for one block type, then persists it.
  function HandleBlockStyleChange(
    blockType: StyleableBlockType,
    next: BlockStyle,
  ) {
    const updated: DocumentStyleConfig = { ...style, [blockType]: next };
    setStyle(updated);
    ScheduleSave({ style: updated });
  }

  return (
    <>
    <Tabs
      selectedKey={mode}
      onSelectionChange={(key) => HandleModeChange(key as DocumentMode)}
      className="flex h-full flex-col"
    >
      <DocumentModeToolbar
        title={activeDocument.id === project.rootDocumentId ? project.name : activeDocument.name}
        icon={<ProjectIcon icon={project.icon} size={20} className="text-[var(--lk-text2)]" />}
        isFavorite={project.isFavorite}
        onToggleFavorite={() => toggleProjectFavorite(project.id)}
        compact={compact}
        externalHref={compact ? `/YourProjects/Project?id=${project.id}` : undefined}
        onClose={compact ? onClose : undefined}
        document={activeDocument}
      />
      <div
        className={`min-h-0 flex-1 ${mode === "sketch" ? "flex flex-col overflow-hidden" : "overflow-y-auto pb-16"} ${
          activeDocument.theme?.adaptBlocks && IsDarkBackground(activeDocument.theme?.background)
            ? "lockin-adapt-blocks"
            : ""
        }`}
        data-marquee-zone=""
        style={{
          background: activeDocument.theme?.background,
          color: activeDocument.theme?.foreground,
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
          {/* Canvas mód = celá plocha jako stránka Canvas; hlavička a obsah projektu jen u textu. */}
          {mode === "sketch" ? null : (
            <>
          <ProjectHeader project={project} onUpdate={onUpdateProject} compact={compact} />
          <ProjectContents
            documents={subDocuments}
            activeDocumentId={activeDocumentId}
            homeDocumentId={project.rootDocumentId}
            onOpenDocument={onOpenDocument}
            onAddDocument={onAddDocument}
            compact={compact}
          />
            </>
          )}
          <Tabs.Panel id="text" className={`flex flex-1 flex-col ${compact ? "pt-4" : "pt-10"}`}>
            {/* Keyed by document — TipTap's useEditor only reads its
             * `content` option once, at creation, so without this the
             * editor would silently keep showing the previous document's
             * content after switching (ProjectView itself no longer
             * remounts wholesale; see the note above HandleModeChange's
             * effect). Keying just these two, not the whole subtree, is
             * what lets ProjectHeader/ProjectContents stay mounted. */}
            <RichTextEditor
              key={`${activeDocument.id}:${activeDocument.revision ?? 0}`}
              initialContent={activeDocument.text.json}
              onChange={HandleTextChange}
              style={style}
              compact={compact}
              smallText={activeDocument.smallText}
              locked={activeDocument.isLocked}
              themeForeground={activeDocument.theme?.foreground}
            />
          </Tabs.Panel>
          <Tabs.Panel id="sketch" className="flex min-h-0 flex-1 flex-col">
            <DocumentCanvas key={activeDocument.id} sketch={activeDocument.sketch} onChange={HandleSketchChange} />
          </Tabs.Panel>
        </div>
      </div>
    </Tabs>
    {styleEditorTarget ? (
      <BlockStyleModal
        blockType={styleEditorTarget}
        value={style[styleEditorTarget] ?? {}}
        onChange={(next) => HandleBlockStyleChange(styleEditorTarget, next)}
        onClose={CloseStyleEditor}
      />
    ) : null}
    </>
  );
}
