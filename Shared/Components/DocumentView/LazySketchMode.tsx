"use client";

import dynamic from "next/dynamic";

export const LazySketchMode = dynamic(() => import("./SketchMode"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center text-sm text-[#91918e]">
      Loading canvas…
    </div>
  ),
});
