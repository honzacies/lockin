"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@heroui/react";
import { KeyRound, Loader2, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { ApiFetch } from "@/Platform/ApiClient";
import { GetSessionUser, type SessionUser } from "@/Platform/Session";
import { ChangePassphrase } from "@/Platform/KeyVault";
import { FormatBytes } from "@/Components/FormatBytes";

interface Me {
  id: string;
  username: string;
  role: "USER" | "ADMIN";
  storageQuota: string;
  storageUsed: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const session = GetSessionUser();
    if (!session) {
      window.location.href = "/Login";
      return;
    }
    setUser(session);
    ApiFetch<Me>("/auth/me")
      .then(setMe)
      .catch(() => {});
  }, []);

  if (!user) return null;

  const used = me ? Number(me.storageUsed) : 0;
  const quota = me ? Number(me.storageQuota) : 0;
  const percent = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-[50px] pt-6 pb-16">
      <div className="flex items-center gap-1.5 text-sm text-[#91918e]">
        <SettingsIcon size={16} strokeWidth={1.5} />
        Settings
      </div>
      <div className="flex items-center gap-2.5">
        <SettingsIcon size={56} strokeWidth={1.5} className="text-black" />
        <p className="text-[40px] font-medium tracking-[-0.8px] text-black">Settings</p>
      </div>

      <section className="flex max-w-[560px] flex-col gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
          Account
        </span>
        <div className="flex flex-col gap-2 rounded-xl border border-[#f0efed] px-4 py-3">
          <Row label="Username" value={user.username} />
          <Row label="Role" value={user.role === "ADMIN" ? "administrator" : "user"} />
          {me ? (
            <>
              <Row
                label="Account created"
                value={new Date(me.createdAt).toLocaleDateString("en-GB")}
              />
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-[#5f5e59]">Storage</span>
                  <span className="text-xs text-[#91918e]">
                    {FormatBytes(used)} of {FormatBytes(quota)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${percent}%`,
                      background: percent > 90 ? "#e5484d" : "#30a46c",
                    }}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <PassphraseSection />

      <section className="flex max-w-[560px] flex-col gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
          Encryption
        </span>
        <div className="flex gap-2.5 rounded-xl border border-[#f0efed] px-4 py-3">
          <ShieldCheck size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#30a46c]" />
          <p className="text-[13px] leading-relaxed text-[#5f5e59]">
            Documents are encrypted in your browser before they ever leave it. The server only
            sees the encrypted form, its size and when it last changed — never the titles or the
            contents. We do not hold the key and cannot derive it.
          </p>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[13px] text-[#5f5e59]">{label}</span>
      <span className="text-[13px] text-[#2c2c2b]">{value}</span>
    </div>
  );
}

/**
 * Změna passphrase. Přebalí se **stejný** hlavní klíč, takže dokumenty
 * zůstanou nedotčené — proto to je rychlé bez ohledu na to, kolik jich je.
 *
 * Heslo k účtu je tu kvůli serveru: ten nemá jak ověřit, že změnu vyvolal
 * skutečný vlastník, a bez téhle pojistky by ukradený access token stačil
 * k tomu data zamknout.
 */
function PassphraseSection() {
  const [open, setOpen] = useState(false);
  const [oldPassphrase, setOldPassphrase] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function HandleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (newPassphrase.length < 10) {
      setError("The new passphrase must be at least 10 characters.");
      return;
    }
    if (newPassphrase !== confirmation) {
      setError("The new passphrases do not match.");
      return;
    }

    setBusy(true);
    try {
      await ChangePassphrase(oldPassphrase, newPassphrase, password);
      setDone(true);
      setOldPassphrase("");
      setNewPassphrase("");
      setConfirmation("");
      setPassword("");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The change did not go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex max-w-[560px] flex-col gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
        Passphrase
      </span>

      {done ? (
        <p className="rounded-lg border border-[#30a46c]/20 bg-[#30a46c]/[0.06] px-3 py-2 text-[13px] text-[#30a46c]">
          Passphrase changed. Your documents were untouched — only the key was re-wrapped.
        </p>
      ) : null}

      {!open ? (
        <div className="flex items-center justify-between rounded-xl border border-[#f0efed] px-4 py-3">
          <div className="flex items-center gap-2">
            <KeyRound size={15} strokeWidth={1.75} className="text-[#5f5e59]" />
            <span className="text-[13px] text-[#5f5e59]">Change your encryption passphrase</span>
          </div>
          <Button
            variant="ghost"
            onPress={() => setOpen(true)}
            className="h-auto rounded-lg border border-[#f0efed] px-2.5 py-1.5 text-[13px] font-normal text-[#2c2c2b] hover:border-[#c9c8c4]"
          >
            Change
          </Button>
        </div>
      ) : (
        <form
          onSubmit={HandleSubmit}
          className="flex flex-col gap-3 rounded-xl border border-[#f0efed] px-4 py-4"
        >
          <Field
            label="Current passphrase"
            value={oldPassphrase}
            onChange={setOldPassphrase}
            autoComplete="current-password"
          />
          <Field
            label="New passphrase"
            value={newPassphrase}
            onChange={setNewPassphrase}
            autoComplete="new-password"
            hint="At least 10 characters."
          />
          <Field
            label="Confirm new passphrase"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />
          <Field
            label="Account password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            hint="So the server can confirm it is really you."
          />

          {error ? (
            <p className="rounded-lg border border-[#e5484d]/20 bg-[#e5484d]/[0.06] px-3 py-2 text-[13px] text-[#e5484d]">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-1.5">
            <Button
              type="submit"
              variant="primary"
              isDisabled={busy}
              className="h-auto justify-center gap-2 rounded-lg bg-black px-3 py-1.5 text-[13px] font-normal text-white disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} strokeWidth={1.75} className="animate-spin" /> : null}
              {busy ? "Changing…" : "Change passphrase"}
            </Button>
            <Button
              variant="ghost"
              isDisabled={busy}
              onPress={() => {
                setOpen(false);
                setError(null);
              }}
              className="h-auto rounded-lg border border-[#f0efed] px-3 py-1.5 text-[13px] font-normal text-[#5f5e59] hover:border-[#c9c8c4]"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
        {label}
      </span>
      <Input
        type="password"
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#2c2c2b] outline-none focus:border-[#0485f7]"
      />
      {hint ? <span className="text-xs text-[#91918e]">{hint}</span> : null}
    </label>
  );
}
