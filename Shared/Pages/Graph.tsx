"use client";

import { useEffect } from "react";
import { GraphView } from "@lockin/shared/Components/Graph/GraphView";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";

/** Graf přes celou stránku — nadpis je součástí skleněné karty v GraphView. */
export default function GraphPage() {
  const openTab = UseUiStore((state) => state.OpenTab);

  useEffect(() => {
    openTab({ id: "graph", title: "Graph", href: "/Graph" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col">
      <GraphView />
    </div>
  );
}
