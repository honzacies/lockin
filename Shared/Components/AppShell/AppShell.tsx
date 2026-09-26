"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { TodoSettingsPanelSlot } from "./TodoSettingsPanelSlot";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { UseTodoStore } from "@lockin/shared/Store/UseTodoStore";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseSidebarStore } from "@lockin/shared/Store/UseSidebarStore";
import { UseFocusStore } from "@lockin/shared/Store/UseFocusStore";
import { UseGraphStore } from "@lockin/shared/Store/UseGraphStore";
import { UseCanvasStore } from "@lockin/shared/Store/UseCanvasStore";
import { LoadAllProjectsAndDocuments, RebuildIndex } from "@lockin/shared/Lib/Storage";
import { SweepOrphanedMedia } from "@lockin/shared/Lib/MediaStorage";

interface AppShellProps {
  children: ReactNode;
  /** Volitelný obsah na patě sidebaru. Desktop nechává prázdné, web sem dává
   * účet a odhlášení — slot je schválně obecný, aby Shared nemusel vědět,
   * že nějaké přihlašování vůbec existuje. */
  sidebarFooter?: ReactNode;
}

export function AppShell({ children, sidebarFooter }: AppShellProps) {
  const sidebarCollapsed = UseUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = UseUiStore((state) => state.ToggleSidebar);
  const closeTodoSettings = UseUiStore((state) => state.CloseBlockSettings);
  const pathname = usePathname();

  useEffect(() => {
    UseUiStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UseUiStore: rehydrate failed", error);
    });
    UsePriorityStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UsePriorityStore: rehydrate failed", error);
    });
    UseTodoStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UseTodoStore: rehydrate failed", error);
    });
    const dataRehydrated = UseDataStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UseDataStore: rehydrate failed", error);
    });
    UseSidebarStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UseSidebarStore: rehydrate failed", error);
    });
    UseFocusStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UseFocusStore: rehydrate failed", error);
    });
    UseGraphStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UseGraphStore: rehydrate failed", error);
    });
    UseCanvasStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UseCanvasStore: rehydrate failed", error);
    });
    // Rebuild the index from the underlying data before trusting it —
    // self-heals an index that drifted from reality (e.g. an entry dropped by
    // a past write race, or a crash mid-write). No-op on the web build, where
    // the server owns the index.
    RebuildIndex()
      .catch((error: unknown) => console.warn("RebuildIndex failed", error))
      .then(() => LoadAllProjectsAndDocuments())
      .then(({ projects, documents, folders }) => {
        UseDataStore.getState().HydrateProjectsAndDocuments(projects, documents);
        // Složkový workspace: podsložky vaultu jako Library složky. Uložené
        // (přejmenované, s ikonou) mají přednost před těmi z disku — proto až
        // po rehydrataci, jinak by ji persist přepsal.
        if (folders) {
          Promise.resolve(dataRehydrated).then(() =>
            UseDataStore.setState((state) => ({
              folders: { ...Object.fromEntries(folders.map((f) => [f.id, f])), ...state.folders },
            })),
          );
        }
        // Only now, with every document actually loaded, is it safe to say
        // a media file is truly unreferenced — see SweepOrphanedMedia's own
        // doc comment for why nothing removes these earlier.
        SweepOrphanedMedia(documents).catch((error: unknown) =>
          console.warn("SweepOrphanedMedia failed", error),
        );
      })
      .catch((error: unknown) => {
        console.warn("LoadAllProjectsAndDocuments failed", error);
      });
  }, []);

  // A to-do list's settings panel only makes sense while that list is still
  // mounted — closing it on navigation avoids a blank reserved column.
  useEffect(() => {
    closeTodoSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      {/* Sidebar volá `useSearchParams()` (zvýrazňuje řádek podle URL), což
        * u prerenderu vyžaduje hranici Suspense — bez ní neprojde statický
        * export ani prerender `/_not-found` na serveru. Hranice je jen kolem
        * sidebaru, ne kolem celého shellu, aby se zbytek layoutu prerenderovat
        * mohl. Fallback je skeleton stejné šířky, takže se při hydrataci
        * neposune obsah. */}
      {!sidebarCollapsed && (
        <Suspense fallback={<SidebarPlaceholder />}>
          <Sidebar footer={sidebarFooter} />
        </Suspense>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onToggleSidebar={toggleSidebar} />
        <TodoSettingsPanelSlot>{children}</TodoSettingsPanelSlot>
      </div>
    </div>
  );
}

/** Prázdný sidebar ve stejných rozměrech — drží místo, než se Sidebar
 * vykreslí, aby obsah vedle nepodskočil. Vlastní řádky nekreslí; Sidebar má
 * své skeletony a naskočí hned po hydrataci. */
function SidebarPlaceholder() {
  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col border-r border-[#f0efed] bg-[#faf9f8] p-2.5" />
  );
}
