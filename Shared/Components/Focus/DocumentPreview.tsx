"use client";

import { Button } from "@heroui/react";
import { Eye, FileText, X } from "lucide-react";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseTodoPreviewStore } from "@lockin/shared/Store/UseTodoPreviewStore";
import { RichTextEditor } from "@lockin/shared/Components/DocumentView/RichTextEditor";
import { ResizableSidePanel } from "@lockin/shared/Components/Shared/ResizableSidePanel";
import { ProjectIcon } from "@lockin/shared/Components/Shared/ProjectIcon";

const NoChange = () => {};

/** Dokument vedle To-do boardu jen pro čtení — editor je zamčený a změny se
 * nikam neukládají, takže se tu nedá nic omylem přepsat. */
export function DocumentPreview() {
  const docId = UseTodoPreviewStore((s) => s.docId);
  const close = UseTodoPreviewStore((s) => s.Open);
  const doc = UseDataStore((s) => (docId ? s.documents[docId] : undefined));
  if (!doc) return null;

  return (
    <ResizableSidePanel>
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex items-start gap-2 px-4 pb-2 pt-4">
          {doc.icon ? <ProjectIcon icon={doc.icon} size={28} /> : <FileText size={26} strokeWidth={1.5} className="shrink-0 text-black" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="truncate text-[24px] font-medium tracking-[-0.48px] text-black">{doc.name || "Untitled"}</p>
            <span className="flex w-fit select-none items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5 text-[12px] text-[#5f5e59]">
              <Eye size={12} />
              Read only
            </span>
          </div>
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Close preview"
            onPress={() => close(null)}
            className="h-7 w-7 shrink-0 rounded text-[#91918e] hover:bg-black/[0.05] hover:text-[#2c2c2b]"
          >
            <X size={16} />
          </Button>
        </div>
        <RichTextEditor
          key={doc.id}
          initialContent={doc.text.json}
          onChange={NoChange}
          style={doc.style}
          compact
          smallText={doc.smallText}
          locked
        />
      </div>
    </ResizableSidePanel>
  );
}
