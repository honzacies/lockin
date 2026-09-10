"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Button, Input } from "@heroui/react";
import { Loader2 } from "lucide-react";

/**
 * Společný rám pro přihlášení i registraci — jeden vzhled pro obojí, ať se
 * ty dvě stránky nerozejdou do dvou různých designů (viz DESIGN.md).
 */

export interface AuthField {
  name: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}

export function AuthForm({
  title,
  subtitle,
  fields,
  submitLabel,
  onSubmit,
  footer,
}: {
  title: string;
  subtitle: string;
  fields: AuthField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  footer: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function HandleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit(values);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Něco se pokazilo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-[380px] flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <p className="text-[40px] font-medium tracking-[-0.8px] text-black">{title}</p>
          <p className="text-sm text-[#91918e]">{subtitle}</p>
        </div>

        <form onSubmit={HandleSubmit} className="flex flex-col gap-4">
          {fields.map((field) => (
            <label key={field.name} className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
                {field.label}
              </span>
              <Input
                type={field.type}
                required
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                value={values[field.name] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                }
                className="w-full rounded-lg border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#2c2c2b] outline-none focus:border-[#0485f7]"
              />
              {field.hint ? <span className="text-xs text-[#91918e]">{field.hint}</span> : null}
            </label>
          ))}

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
            {submitLabel}
          </Button>
        </form>

        <div className="text-[13px] text-[#5f5e59]">{footer}</div>
      </div>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[#3b7cff] underline underline-offset-2">
      {children}
    </Link>
  );
}
