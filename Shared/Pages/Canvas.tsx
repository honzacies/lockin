"use client";

import { useEffect } from "react";
import { CanvasView } from "@lockin/shared/Components/Canvas/CanvasView";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";

export default function CanvasPage() {
  const openTab = UseUiStore((state) => state.OpenTab);
  useEffect(() => {
    openTab({ id: "canvas", title: "Canvas", href: "/Canvas" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <CanvasView />;
}
