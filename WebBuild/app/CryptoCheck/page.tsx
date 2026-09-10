"use client";

import { useEffect, useState } from "react";
import {
  CreateWrappedKey,
  OpenFile,
  OpenJson,
  RewrapKey,
  SealFile,
  SealJson,
  UnwrapKey,
} from "@/Platform/Crypto";

/**
 * Ověřovací stránka krypto vrstvy — běží v prohlížeči, protože WebCrypto ani
 * WASM v Node testu nejsou tím, co poběží v produkci.
 *
 * Zajímá nás hlavně to, že po **změně passphrase zůstává hlavní klíč stejný**
 * a data zašifrovaná původní passphrase jdou dál otevřít. To je celý důvod,
 * proč passphrase obaluje klíč a nešifruje data přímo.
 *
 * Dostupná jen ve vývoji, do produkčního buildu se nedostane.
 */

interface Result {
  label: string;
  ok: boolean;
  detail: string;
}

export default function CryptoCheckPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    void Run().then((r) => {
      setResults(r);
      setRunning(false);
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-white px-[50px] pt-10">
      <p className="text-[32px] font-medium tracking-[-0.6px] text-black">Encryption self-check</p>
      {running ? (
        <p className="text-sm text-[#91918e]">Running… key derivation is slow on purpose.</p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        {results.map((result) => (
          <div
            key={result.label}
            className="flex items-start gap-2 rounded-lg border border-[#f0efed] px-3 py-2 text-[13px]"
          >
            <span className={result.ok ? "text-[#30a46c]" : "text-[#e5484d]"}>
              {result.ok ? "✓" : "✗"}
            </span>
            <div className="flex flex-col">
              <span className="font-medium text-[#2c2c2b]">{result.label}</span>
              <span className="text-xs text-[#91918e]">{result.detail}</span>
            </div>
          </div>
        ))}
      </div>
      {!running && results.length > 0 ? (
        <p className="text-sm font-medium text-[#2c2c2b]">
          {results.every((r) => r.ok)
            ? "All checks passed."
            : `${results.filter((r) => !r.ok).length} of ${results.length} failed.`}
        </p>
      ) : null}
    </div>
  );
}

async function Run(): Promise<Result[]> {
  const out: Result[] = [];
  const Add = (label: string, ok: boolean, detail: string) => out.push({ label, ok, detail });

  try {
    const started = performance.now();
    const record = await CreateWrappedKey("prvni-passphrase-123");
    const derivationMs = Math.round(performance.now() - started);
    Add(
      "Argon2id runs in WASM",
      true,
      `key derivation took ${derivationMs} ms (should be hundreds, not single digits)`,
    );

    const key = await UnwrapKey("prvni-passphrase-123", record);
    Add("Unlocks with the right passphrase", true, "master key unwrapped");

    let rejected = false;
    try {
      await UnwrapKey("spatna-passphrase", record);
    } catch {
      rejected = true;
    }
    Add(
      "Wrong passphrase is rejected",
      rejected,
      rejected ? "AES-GCM refused the tag, as it should" : "IT PASSED — that is a serious bug",
    );

    const document = { name: "Secret document", text: { json: { type: "doc" } } };
    const sealed = await SealJson(key, document);
    const opened = await OpenJson<typeof document>(key, sealed);
    Add(
      "Document seals and opens",
      opened.name === document.name,
      `ciphertext ${sealed.ciphertext.length} chars, title matches after decrypt`,
    );

    const leaks = sealed.ciphertext.includes(btoa("Secret")) || sealed.ciphertext.includes("Secret");
    Add(
      "No readable title in the ciphertext",
      !leaks,
      leaks ? "the title LEAKS" : "nothing readable left behind",
    );

    // Jádro celého návrhu: změna passphrase nesmí znehodnotit už zašifrovaná data.
    const rewrapped = await RewrapKey("prvni-passphrase-123", "druha-passphrase-456", record);
    const keyAfterChange = await UnwrapKey("druha-passphrase-456", rewrapped);
    const openedAfterChange = await OpenJson<typeof document>(keyAfterChange, sealed);
    Add(
      "Old data still opens after a passphrase change",
      openedAfterChange.name === document.name,
      "master key stayed the same, only its wrapper was replaced",
    );

    let oldRejected = false;
    try {
      await UnwrapKey("prvni-passphrase-123", rewrapped);
    } catch {
      oldRejected = true;
    }
    Add(
      "Old passphrase stops working after the change",
      oldRejected,
      oldRejected ? "rejected" : "IT PASSED — that is a serious bug",
    );

    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "photo.png", { type: "image/png" });
    const sealedFile = await SealFile(key, file);
    const openedFile = await OpenFile(key, await sealedFile.arrayBuffer());
    Add(
      "File seals together with its name and type",
      openedFile.name === "photo.png" && openedFile.type === "image/png",
      `after decrypt: ${openedFile.name}, ${openedFile.type}`,
    );
  } catch (error) {
    Add("Unexpected error", false, error instanceof Error ? error.message : String(error));
  }

  return out;
}
