"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { DocumentRecord } from "@lockin/shared/Types/Project";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { ProjectIcon } from "@lockin/shared/Components/Shared/ProjectIcon";
import { DocumentLinkTargets, FindWikiDocument } from "@lockin/shared/Lib/WikiLink";

/** Živé zpětné odkazy jako v Obsidianu: dokumenty, jejichž `[[odkaz]]` míří sem. */
export function LinkedFrom({ document, compact }: { document: DocumentRecord; compact?: boolean }) {
  const documents = UseDataStore((state) => state.documents);
  const sources = useMemo(() => {
    const all = Object.values(documents);
    // ponytail: projde všechny dokumenty při každé změně store; index cílů až když to bude znát
    return all
      .filter((doc) => doc.id !== document.id)
      .filter((doc) => [...DocumentLinkTargets(doc)].some((target) => FindWikiDocument(target, all)?.id === document.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [documents, document.id]);

  if (sources.length === 0) return null;
  return (
    <div className={`flex flex-col gap-2 border-t border-[#f0efed] pb-16 pt-4 ${compact ? "px-4" : "px-[50px]"}`}>
      <p className="select-none text-[14px] text-[#91918e]">Linked from</p>
      {sources.map((doc) => (
        <Link
          key={doc.id}
          href={`/Document?id=${encodeURIComponent(doc.id)}`}
          className="flex w-fit items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-[16px] text-[#5f5e59] hover:bg-black/[0.03]"
        >
          {doc.icon ? <ProjectIcon icon={doc.icon} size={18} /> : <FileText size={18} strokeWidth={1.5} />}
          <span className="truncate">{doc.name || "Untitled"}</span>
        </Link>
      ))}
    </div>
  );
}
