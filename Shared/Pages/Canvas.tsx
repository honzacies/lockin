"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CanvasView } from "@lockin/shared/Components/Canvas/CanvasView";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";

function CanvasPageContent() {
  const openTab = UseUiStore((state) => state.OpenTab);
  // Sidebar na uložené canvasy odkazuje jako na soubory: /Canvas?id=…
  const openId = useSearchParams().get("id") ?? undefined;
  useEffect(() => {
    openTab({ id: "canvas", title: "Canvas", href: "/Canvas" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <CanvasView openId={openId} />;
}

export default function CanvasPage() {
  // `useSearchParams` potřebuje hranici Suspense, jinak neprojde statický export.
  return (
    <Suspense fallback={null}>
      <CanvasPageContent />
    </Suspense>
  );
}
