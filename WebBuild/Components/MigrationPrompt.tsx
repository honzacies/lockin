"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { CloudUpload, Loader2 } from "lucide-react";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { LoadAllProjectsAndDocuments } from "@lockin/shared/Lib/Storage";
import {
  DiscardLocalData,
  HasLocalData,
  InspectLocalData,
  MigrateLocalDataToAccount,
  type LocalDataSummary,
  type MigrationProgress,
} from "@/Platform/Migration";
import type { SessionUser } from "@/Platform/Session";

/**
 * Po přihlášení se zeptá, jestli přenést data z prohlížeče na účet.
 *
 * Automaticky se to nedělá schválně — kdyby si někdo půjčil cizí prohlížeč,
 * natáhl by si cizí anonymní dokumenty do svého účtu.
 *
 * Vzhled drží kompaktní panelový styl z DESIGN.md: bílá karta, `rounded-xl`,
 * okraj `#f0efed`, tiny uppercase label.
 */

const DISMISS_KEY = "lockin.migrationDismissed";

export function MigrationPrompt({ user }: { user: SessionUser }) {
  const [summary, setSummary] = useState<LocalDataSummary | null>(null);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Odmítnutí se pamatuje per účet — jinak by se dotaz vracel po každém
    // přihlášení, i když ho uživatel jednou zamítl.
    if (localStorage.getItem(`${DISMISS_KEY}.${user.id}`)) return;

    InspectLocalData()
      .then((found) => {
        if (!cancelled && HasLocalData(found)) setSummary(found);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  if (!summary || done) return null;

  async function HandleUpload() {
    setError(null);
    try {
      await MigrateLocalDataToAccount(setProgress);
      // Store se přenačte z účtu, ať uživatel hned vidí nahraná data.
      const { projects, documents } = await LoadAllProjectsAndDocuments();
      UseDataStore.getState().HydrateProjectsAndDocuments(projects, documents);
      setDone(true);
    } catch (caught) {
      setProgress(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Nahrávání se nepovedlo. Data zůstala v prohlížeči, zkus to znovu.",
      );
    }
  }

  async function HandleDiscard() {
    await DiscardLocalData().catch(() => {});
    localStorage.setItem(`${DISMISS_KEY}.${user.id}`, "1");
    setDone(true);
  }

  function HandleLater() {
    localStorage.setItem(`${DISMISS_KEY}.${user.id}`, "1");
    setDone(true);
  }

  const busy = progress !== null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[360px] rounded-xl border border-[#f0efed] bg-white p-4 shadow-xl">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CloudUpload size={16} strokeWidth={1.75} className="text-[#0088ff]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
            Nalezena lokální data
          </span>
        </div>

        <p className="text-[13px] leading-relaxed text-[#2c2c2b]">
          V tomhle prohlížeči máš{" "}
          <strong>
            {summary.documents} {Plural(summary.documents, "dokument", "dokumenty", "dokumentů")}
          </strong>
          {summary.projects > 0 ? (
            <>
              {" a "}
              <strong>
                {summary.projects} {Plural(summary.projects, "projekt", "projekty", "projektů")}
              </strong>
            </>
          ) : null}
          . Nahrát je na účet <strong>{user.username}</strong>?
        </p>

        {busy ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs text-[#5f5e59]">
              <Loader2 size={13} strokeWidth={1.75} className="animate-spin" />
              <span className="truncate">{progress.label}</span>
              <span className="ml-auto shrink-0 tabular-nums">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-[#0088ff] transition-[width]"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        {error ? <p className="text-xs text-[#e5484d]">{error}</p> : null}

        {!busy ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="primary"
              onPress={HandleUpload}
              className="h-auto flex-1 justify-center rounded-lg bg-black px-3 py-1.5 text-[13px] font-normal text-white"
            >
              Nahrát na účet
            </Button>
            <Button
              variant="ghost"
              onPress={HandleLater}
              className="h-auto rounded-lg border border-[#f0efed] px-3 py-1.5 text-[13px] font-normal text-[#5f5e59] hover:border-[#c9c8c4]"
            >
              Později
            </Button>
          </div>
        ) : null}

        {!busy ? (
          <button
            type="button"
            onClick={HandleDiscard}
            className="self-start text-xs font-normal text-[#91918e] underline underline-offset-2 hover:text-[#e5484d]"
          >
            Smazat lokální data
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 1 dokument / 2–4 dokumenty / 5+ dokumentů */
function Plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  if (count >= 2 && count <= 4) return few;
  return many;
}
