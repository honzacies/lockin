"use client";

import { Button } from "@heroui/react";
import { PanelLeft } from "lucide-react";
import { TabStrip } from "./TabStrip";
import { WindowControls } from "./WindowControls";

interface TopbarProps {
  onToggleSidebar?: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  return (
    <div className="flex h-[52px] shrink-0 bg-[#F9F8F7] items-center justify-between border-b z-0 border-[#f0efed]">
      <div className="flex min-w-0 flex-1 flex-row gap-2.5 items-center px-2.5">
        <Button
          variant="ghost"
          isIconOnly
          onPress={onToggleSidebar}
          className="h-7 w-7 shrink-0 rounded-md text-[#91918e] hover:bg-black/[0.03]"
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={20} strokeWidth={1.5} />
        </Button>
        <TabStrip />
      </div>
      {/* The only drag region in the topbar now — deliberately *not* an
       * ancestor of TabStrip's draggable tabs (the root div used to carry
       * this too, but even though `data-tauri-drag-region` is documented to
       * only fire on its exact target, having it on a wrapping element that
       * also contains natively-draggable children was enough to make
       * Chromium show a permanent "not-allowed" cursor over the tabs — so
       * this spacer is now the sole tagged element, a sibling of TabStrip
       * rather than an ancestor). */}
      <div data-tauri-drag-region className="h-full min-w-4 flex-1" />
      <div className="shrink-0">
        <WindowControls />
      </div>
    </div>
  );
}