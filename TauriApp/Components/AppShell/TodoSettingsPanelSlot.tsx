"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { UseUiStore } from "@/Store/UseUiStore";

const BlockSettingsPortalContext = createContext<HTMLDivElement | null>(null);

/** The mounted DOM node any open block (to-do list / color palette /
 * scenario) should portal its settings panel content into, or null while no
 * panel is open. */
export function useBlockSettingsPortalNode(): HTMLDivElement | null {
  return useContext(BlockSettingsPortalContext);
}

/**
 * Wraps the app's main content. When a block's settings are open
 * (UseUiStore.openBlockSettings), shrinks the content area and reserves a
 * 320px column beside it — whichever block view owns that kind+id portals
 * its live settings panel there via useBlockSettingsPortalNode.
 */
export function TodoSettingsPanelSlot({ children }: { children: ReactNode }) {
  const isOpen = UseUiStore((state) => state.openBlockSettings !== null);
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  return (
    <BlockSettingsPortalContext.Provider value={node}>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {isOpen ? (
          <div
            ref={setNode}
            className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-[#f0efed] bg-white"
          />
        ) : null}
      </div>
    </BlockSettingsPortalContext.Provider>
  );
}
