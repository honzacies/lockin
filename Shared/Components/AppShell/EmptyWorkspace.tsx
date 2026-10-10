"use client";

import { useRouter } from "next/navigation";
import { LockInLogo } from "@lockin/shared/Components/Shared/LockInLogo";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { CREATE_ACTIONS } from "./CreateMenu";
import { UseSettingsStore } from "@lockin/shared/Store/UseSettingsStore";
import { ShortcutFor } from "@lockin/shared/Lib/Shortcuts";

/** Je workspace úplně prázdný (žádný dokument ani projekt) a už načtený? */
export function UseIsWorkspaceEmpty(): boolean {
  return UseDataStore((s) => s.hydrated && Object.keys(s.documents).length === 0 && Object.keys(s.projects).length === 0);
}

/** Prázdný workspace: místo prázdné tabulky pozvánka a rychlé odkazy na vytvoření čehokoli. */
export function EmptyWorkspace() {
  const router = useRouter();
  const shortcuts = UseSettingsStore((s) => s.shortcuts);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <LockInLogo size={56} className="opacity-90" />
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[28px] font-medium tracking-[-0.6px] text-[var(--lk-ink)]">Well, it looks empty here</h2>
          <p className="text-[15px] text-[var(--lk-muted)]">…but you can start anytime. Pick something to create:</p>
        </div>
      </div>
      <div className="grid w-full max-w-[720px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        {CREATE_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => router.push(action.Create())}
            className="group flex items-start gap-3 rounded-xl border border-[var(--lk-line)] p-3.5 text-left transition-colors hover:border-[var(--lk-line2)] hover:bg-black/[0.02]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-[var(--lk-text2)] group-hover:text-[#0088ff]">
              <action.icon size={18} strokeWidth={1.75} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-[var(--lk-ink)]">New {action.label.toLowerCase()}</span>
              <span className="text-[12.5px] leading-snug text-[var(--lk-muted)]">{action.description}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="text-[13px] text-[var(--lk-subtle)]">
        Tip: right-click anywhere in the sidebar to create things, or press {ShortcutFor("search", shortcuts)} to search.
      </p>
    </div>
  );
}
