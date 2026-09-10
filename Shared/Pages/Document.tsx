"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { StandaloneDocumentEditor } from "@lockin/shared/Components/DocumentView/StandaloneDocumentEditor";
import { DocumentSkeleton } from "@lockin/shared/Components/DocumentView/DocumentSkeleton";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";

function DocumentPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const activeDocument = UseDataStore((state) => (id ? state.documents[id] : undefined));
  const hydrated = UseDataStore((state) => state.hydrated);
  const openTab = UseUiStore((state) => state.OpenTab);

  useEffect(() => {
    if (!activeDocument) return;
    openTab({
      id: activeDocument.id,
      title: activeDocument.name,
      href: `/Document?id=${activeDocument.id}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocument?.id, activeDocument?.name]);

  if (!activeDocument) {
    // Used to declare "not found" unconditionally here, even during the
    // brief window before disk data has loaded at all — every load flashed
    // that message right before the real document popped in.
    if (!hydrated) return <DocumentSkeleton />;
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#91918e]">
        Document not found.
      </div>
    );
  }

  return <StandaloneDocumentEditor key={activeDocument.id} document={activeDocument} />;
}

export default function DocumentPage() {
  return (
    <Suspense fallback={null}>
      <DocumentPageContent />
    </Suspense>
  );
}
