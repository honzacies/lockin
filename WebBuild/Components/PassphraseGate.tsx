"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@heroui/react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { FetchWrappedKey, SetupPassphrase, TryRestore, Unlock } from "@/Platform/KeyVault";

/**
 * Brána mezi přihlášením a aplikací.
 *
 * Přihlašovací heslo pouští na server, passphrase odemyká data. Jsou to dvě
 * různá tajemství schválně: kdyby to bylo jedno, server by ho při přihlášení
 * viděl a celé šifrování by ztratilo smysl.
 *
 * Dokud není trezor odemčený, aplikace se nevykreslí — adaptéry by stejně
 * neměly čím dešifrovat.
 */

type Phase = "checking" | "setup" | "unlock" | "ready";

export function PassphraseGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Po reloadu bývá klíč ještě v IndexedDB — pak se na nic ptát nemusíme.
      if (await TryRestore()) {
        if (!cancelled) setPhase("ready");
        return;
      }
      try {
        const record = await FetchWrappedKey();
        if (!cancelled) setPhase(record ? "unlock" : "setup");
      } catch {
        if (!cancelled) setPhase("unlock");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "ready") return <>{children}</>;

  if (phase === "checking") {
    return <div className="flex min-h-screen flex-col bg-white" />;
  }

  async function HandleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (phase === "setup") {
      if (passphrase.length < 10) {
        setError("Your passphrase must be at least 10 characters.");
        return;
      }
      if (passphrase !== confirmation) {
        setError("The passphrases do not match.");
        return;
      }
      if (!understood) {
        setError("Please confirm you understand the passphrase cannot be recovered.");
        return;
      }
    }

    setBusy(true);
    try {
      if (phase === "setup") await SetupPassphrase(passphrase);
      else await Unlock(passphrase);
      setPhase("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  const isSetup = phase === "setup";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="flex w-full max-w-[420px] flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-sm text-[#91918e]">
            <KeyRound size={16} strokeWidth={1.5} />
            {isSetup ? "Set up encryption" : "Unlock your data"}
          </div>
          <p className="text-[32px] font-medium tracking-[-0.6px] text-black">
            {isSetup ? "Choose a passphrase" : "Enter your passphrase"}
          </p>
          <p className="text-sm leading-relaxed text-[#5f5e59]">
            {isSetup
              ? "Your documents are encrypted right here in your browser. Only the encrypted form ever reaches the server, and we cannot read it either."
              : "Your data is encrypted. Without the passphrase nobody can decrypt it — not the server, not us."}
          </p>
        </div>

        {isSetup ? (
          <div className="flex gap-2.5 rounded-xl border border-[#e5a000]/30 bg-[#e5a000]/[0.06] px-3 py-2.5">
            <ShieldAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#e5a000]" />
            <p className="text-[13px] leading-relaxed text-[#5f5e59]">
              <strong className="text-[#2c2c2b]">There is no way to recover it.</strong> We do not
              store your passphrase and we hold nothing that could derive it. If you forget it, your
              documents are gone for good — we cannot help with that.
            </p>
          </div>
        ) : null}

        <form onSubmit={HandleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
              Passphrase
            </span>
            <Input
              type="password"
              required
              autoFocus
              autoComplete={isSetup ? "new-password" : "current-password"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#2c2c2b] outline-none focus:border-[#0485f7]"
            />
            {isSetup ? (
              <span className="text-xs text-[#91918e]">
                At least 10 characters. Different from your account password — the server knows
                that one, it never sees this one.
              </span>
            ) : null}
          </label>

          {isSetup ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
                  Confirm passphrase
                </span>
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="w-full rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#2c2c2b] outline-none focus:border-[#0485f7]"
                />
              </label>

              <label className="flex cursor-pointer items-start gap-2 text-[13px] leading-relaxed text-[#2c2c2b]">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 accent-[#2c2c2b]"
                />
                I understand the passphrase cannot be recovered, and that forgetting it means
                losing my data.
              </label>
            </>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-[#e5484d]/20 bg-[#e5484d]/[0.06] px-3 py-2 text-[13px] text-[#e5484d]">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            isDisabled={busy}
            className="h-auto justify-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-normal text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} strokeWidth={1.75} className="animate-spin" /> : null}
            {busy
              ? isSetup
                ? "Creating your key…"
                : "Unlocking…"
              : isSetup
                ? "Turn on encryption"
                : "Unlock"}
          </Button>

          {busy ? (
            <p className="text-center text-xs text-[#91918e]">
              Deriving the key is slow on purpose — it makes brute-forcing expensive.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
