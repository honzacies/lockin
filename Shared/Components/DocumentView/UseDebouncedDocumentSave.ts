import { useEffect, useRef } from "react";
import type { DocumentRecord } from "@lockin/shared/Types/Project";

const SAVE_DEBOUNCE_MS = 600;

interface UseDebouncedDocumentSaveOptions {
  initialDocument: DocumentRecord;
  onSave: (doc: DocumentRecord) => void | Promise<void>;
}

/**
 * Debounces document field patches into one save ~600ms after the last
 * change, shared by StandaloneDocumentEditor.tsx and ProjectView.tsx — both
 * keep a mutable draft (so a burst of edits collapses into one write) and
 * need it flushed rather than dropped when the component goes away.
 * Persistence itself stays with the caller: StandaloneDocumentEditor saves
 * via the Zustand store's UpsertDocument, ProjectView saves directly via
 * Lib/Storage plus its own onDocumentSaved callback — different enough that
 * folding it into this hook too would need as many options as it saves lines.
 */
export function UseDebouncedDocumentSave({
  initialDocument,
  onSave,
}: UseDebouncedDocumentSaveOptions) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<DocumentRecord>(initialDocument);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  function ScheduleSave(patch: Partial<DocumentRecord>) {
    draftRef.current = { ...draftRef.current, ...patch };
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const saved: DocumentRecord = { ...draftRef.current, updatedAt: new Date().toISOString() };
      draftRef.current = saved;
      onSave(saved);
    }, SAVE_DEBOUNCE_MS);
  }

  /** Cancels any pending debounce and saves immediately — for a caller that
   * isn't remounted between documents (ProjectView switching activeDocument),
   * so a pending edit for the document being navigated away from doesn't get
   * silently dropped. */
  function FlushNow() {
    if (!saveTimeoutRef.current) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    const saved: DocumentRecord = { ...draftRef.current, updatedAt: new Date().toISOString() };
    draftRef.current = saved;
    onSave(saved);
  }

  return { draftRef, ScheduleSave, FlushNow };
}
