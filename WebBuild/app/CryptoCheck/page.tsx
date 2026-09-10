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
      <p className="text-[32px] font-medium tracking-[-0.6px] text-black">Kontrola šifrování</p>
      {running ? (
        <p className="text-sm text-[#91918e]">Běží… odvození klíče je schválně pomalé.</p>
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
            ? "Všechno prošlo."
            : `Selhalo ${results.filter((r) => !r.ok).length} z ${results.length}.`}
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
      "Argon2id ve WASM funguje",
      true,
      `odvození klíče trvalo ${derivationMs} ms (má být stovky ms, ne jednotky)`,
    );

    const key = await UnwrapKey("prvni-passphrase-123", record);
    Add("Odemčení správnou passphrase", true, "hlavní klíč se rozbalil");

    let rejected = false;
    try {
      await UnwrapKey("spatna-passphrase", record);
    } catch {
      rejected = true;
    }
    Add(
      "Špatná passphrase je odmítnutá",
      rejected,
      rejected ? "AES-GCM neověřil značku, jak má" : "PROŠLA — to je vážná chyba",
    );

    const document = { name: "Tajný dokument", text: { json: { type: "doc" } } };
    const sealed = await SealJson(key, document);
    const opened = await OpenJson<typeof document>(key, sealed);
    Add(
      "Dokument se zašifruje a otevře",
      opened.name === document.name,
      `ciphertext ${sealed.ciphertext.length} znaků, název sedí po dešifrování`,
    );

    const leaks = sealed.ciphertext.includes(btoa("Tajný")) || sealed.ciphertext.includes("Tajn");
    Add(
      "V ciphertextu není čitelný název",
      !leaks,
      leaks ? "název PROSAKUJE" : "žádný čitelný zbytek",
    );

    // Jádro celého návrhu: změna passphrase nesmí znehodnotit už zašifrovaná data.
    const rewrapped = await RewrapKey("prvni-passphrase-123", "druha-passphrase-456", record);
    const keyAfterChange = await UnwrapKey("druha-passphrase-456", rewrapped);
    const openedAfterChange = await OpenJson<typeof document>(keyAfterChange, sealed);
    Add(
      "Po změně passphrase jdou stará data otevřít",
      openedAfterChange.name === document.name,
      "hlavní klíč zůstal stejný, přebalil se jen jeho obal",
    );

    let oldRejected = false;
    try {
      await UnwrapKey("prvni-passphrase-123", rewrapped);
    } catch {
      oldRejected = true;
    }
    Add(
      "Stará passphrase po změně neplatí",
      oldRejected,
      oldRejected ? "odmítnuta" : "PROŠLA — to je vážná chyba",
    );

    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "foto.png", { type: "image/png" });
    const sealedFile = await SealFile(key, file);
    const openedFile = await OpenFile(key, await sealedFile.arrayBuffer());
    Add(
      "Soubor se zašifruje i s názvem a typem",
      openedFile.name === "foto.png" && openedFile.type === "image/png",
      `po dešifrování: ${openedFile.name}, ${openedFile.type}`,
    );
  } catch (error) {
    Add("Neočekávaná chyba", false, error instanceof Error ? error.message : String(error));
  }

  return out;
}
