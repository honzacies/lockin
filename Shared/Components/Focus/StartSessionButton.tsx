"use client";

import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import type { TodoSource } from "@lockin/shared/Lib/CollectTodoSources";
import { ShowSession, StartListSession } from "@lockin/shared/Lib/TodoActions";

/** ▶ u listu: jeho otevřené úkoly na začátek Today a rovnou session. `className`
 * nese hover skupinu rodiče (group-hover/list, group-hover/row…). */
export function StartSessionButton({ source, className = "" }: { source: TodoSource; className?: string }) {
  const router = useRouter();
  const open = source.tasks.filter((t) => !t.done).length;
  if (!open) return null;
  return (
    <button
      type="button"
      aria-label="Start session on this list"
      title={`Start session — ${open} task${open === 1 ? "" : "s"} to Today`}
      onClick={async () => {
        if (!StartListSession(source)) return;
        if (!(await ShowSession())) router.push("/Todo/Board");
      }}
      className={`shrink-0 rounded p-0.5 text-[#0088ff] hover:bg-[#0088ff]/10 focus:opacity-100 ${className}`}
    >
      <Play size={13} strokeWidth={2} />
    </button>
  );
}
