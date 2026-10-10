import { useEffect, useRef } from "react";
import type { DocumentRecord } from "@lockin/shared/Types/Project";
import { DocToMarkdown } from "@lockin/shared/Lib/Markdown";

const SAVE_DEBOUNCE_MS = 600;

/** Obsah dokumentu bez času uložení. Text přes Markdown — editor po otevření
 * doplní výchozí atributy a vyvolá onChange, aniž by se cokoliv změnilo. */
export function ContentKey({ text, updatedAt: _u, revision: _r, extraLinks: _l, lastMode: _m, ...rest }: DocumentRecord): string {
  let body: string;
  try {
    body = DocToMarkdown(text.json);
  } catch {
    body = JSON.stringify(text.json);
  }
  return body + JSON.stringify(rest);
}

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
  // Podoba naposledy uloženého obsahu podle ID dokumentu — stejný obsah se
  // neukládá a „Updated" se neposouvá jen kvůli otevření.
  const savedKeys = useRef(new Map<string, string>());

  const savedModes = useRef(new Map<string, string>());

  function Save() {
    const draft = draftRef.current;
    const key = ContentKey(draft);
    const contentChanged = savedKeys.current.get(draft.id) !== key;
    // Režim zobrazení (text / canvas) se uloží, ale „Updated" neposune.
    if (!contentChanged && savedModes.current.get(draft.id) === draft.lastMode) return;
    savedKeys.current.set(draft.id, key);
    savedModes.current.set(draft.id, draft.lastMode);
    const saved: DocumentRecord = contentChanged ? { ...draft, updatedAt: new Date().toISOString() } : draft;
    draftRef.current = saved;
    onSave(saved);
  }

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  function ScheduleSave(patch: Partial<DocumentRecord>) {
    // Výchozí bod = dokument, jak byl před první změnou (i po přepnutí na jiný dokument).
    if (!savedKeys.current.has(draftRef.current.id)) {
      savedKeys.current.set(draftRef.current.id, ContentKey(draftRef.current));
      savedModes.current.set(draftRef.current.id, draftRef.current.lastMode);
    }
    draftRef.current = { ...draftRef.current, ...patch };
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      Save();
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
    Save();
  }

  return { draftRef, ScheduleSave, FlushNow };
}
