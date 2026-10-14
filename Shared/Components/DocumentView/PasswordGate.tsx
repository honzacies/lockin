"use client";

import { useState, type FormEvent } from "react";
import { Lock } from "@lockin/shared/Components/Shared/UiIcons";
import { OpenLock, type DocumentLock } from "@lockin/shared/Lib/DocumentLock";
import type { JSONContent } from "@tiptap/core";

/**
 * Zeď před zamčeným dokumentem. Dokud nepřijde správné heslo, editor se
 * vůbec nevytvoří — v paměti tedy není ani kousek obsahu.
 *
 * Špatné heslo se pozná spolehlivě: AES-GCM neověří autentizační značku
 * a `OpenLock` vyhodí výjimku. Nic se nevykreslí „rozsypaně", takže se
 * nemůže stát, že by se nesmysl uložil zpátky přes původní text.
 */
export function PasswordGate({
  documentId,
  lock,
  name,
  onUnlock,
}: {
  documentId: string;
  lock: DocumentLock;
  name: string;
  onUnlock: (json: JSONContent) => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function Submit(event: FormEvent) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      onUnlock(await OpenLock(documentId, lock, password));
    } catch {
      setFailed(true);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <form onSubmit={Submit} className="flex w-full max-w-[320px] flex-col items-center gap-3 text-center">
        <Lock size={28} strokeWidth={1.5} className="text-[var(--lk-muted)]" />
        <div>
          <p className="text-[16px] font-medium text-[var(--lk-ink)]">{name || "Untitled"}</p>
          <p className="mt-0.5 text-[13px] text-[var(--lk-muted)]">This document is protected with a password.</p>
        </div>
        <input
          autoFocus
          type="password"
          value={password}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className={`w-full rounded-lg border bg-[var(--lk-panel)] px-3 py-2 text-[14px] outline-none ${
            failed ? "border-[#e5484d]" : "border-[var(--lk-line)] focus:border-[#0088ff]"
          }`}
        />
        {failed ? <p className="text-[13px] text-[#e5484d]">Wrong password.</p> : null}
        <button
          type="submit"
          disabled={!password || busy}
          className="w-full rounded-lg bg-[#0088ff] py-2 text-[14px] font-medium text-white hover:bg-[#0077e0] disabled:opacity-40"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        <p className="text-[12px] leading-4 text-[var(--lk-faint)]">
          There is no recovery. Without the password the content cannot be read, not even by LockIn.
        </p>
      </form>
    </div>
  );
}
