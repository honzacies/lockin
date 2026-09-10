"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { TodoSettingsPanelSlot } from "./TodoSettingsPanelSlot";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { UseTodoStore } from "@lockin/shared/Store/UseTodoStore";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseSidebarStore } from "@lockin/shared/Store/UseSidebarStore";
import { LoadAllProjectsAndDocuments, RebuildIndex } from "@lockin/shared/Lib/Storage";
import { SweepOrphanedMedia } from "@lockin/shared/Lib/MediaStorage";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
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
    UseDataStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UseDataStore: rehydrate failed", error);
    });
    UseSidebarStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UseSidebarStore: rehydrate failed", error);
    });
    // Rebuild the index from the underlying data before trusting it —
    // self-heals an index that drifted from reality (e.g. an entry dropped by
    // a past write race, or a crash mid-write). No-op on the web build, where
    // the server owns the index.
    RebuildIndex()
      .catch((error: unknown) => console.warn("RebuildIndex failed", error))
      .then(() => LoadAllProjectsAndDocuments())
      .then(({ projects, documents }) => {
        UseDataStore.getState().HydrateProjectsAndDocuments(projects, documents);
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
      {!sidebarCollapsed && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onToggleSidebar={toggleSidebar} />
        <TodoSettingsPanelSlot>{children}</TodoSettingsPanelSlot>
      </div>
    </div>
  );
}
