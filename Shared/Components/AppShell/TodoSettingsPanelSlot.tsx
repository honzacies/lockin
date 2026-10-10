"use client";

import { createContext, Suspense, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";

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
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <BlockSettingsPortalContext.Provider value={node}>
      <div className="flex min-h-0 flex-1">
        {/* Flex sloupec: stránka s vlastním scrollem (Library, náhled vpravo)
         * dostane výšku okna a scrolluje sama; ostatní přetečou a scrolluje tenhle obal. */}
        <div ref={contentRef} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
        <Suspense fallback={null}>
          <FadeOnNavigate target={contentRef} />
        </Suspense>
        {isOpen ? (
          <div
            ref={setNode}
            className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-[var(--lk-line)] bg-white"
          />
        ) : null}
      </div>
    </BlockSettingsPortalContext.Provider>
  );
}

/** Po přechodu na jinou stránku (i jiný dokument stejné stránky) obsah jemně vybledne dovnitř. */
function FadeOnNavigate({ target }: { target: RefObject<HTMLDivElement | null> }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    target.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
  }, [pathname, search, target]);
  return null;
}
