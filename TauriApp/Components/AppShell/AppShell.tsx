"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { TodoSettingsPanelSlot } from "./TodoSettingsPanelSlot";
import { UseUiStore } from "@/Store/UseUiStore";
import { UsePriorityStore } from "@/Store/UsePriorityStore";
import { UseTodoStore } from "@/Store/UseTodoStore";
import { UseDataStore } from "@/Store/UseDataStore";
import { UseSidebarStore } from "@/Store/UseSidebarStore";
import { LoadAllProjectsAndDocuments, RebuildManifest } from "@/Lib/Storage";
import { SweepOrphanedMedia } from "@/Lib/MediaStorage";

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
    // Rebuild the manifest from the actual project/document files on disk
    // before trusting it — self-heals a manifest that drifted from reality
    // (e.g. an entry dropped by a past write race, or a crash mid-write).
    RebuildManifest()
      .catch((error: unknown) => console.warn("RebuildManifest failed (no Tauri bridge?)", error))
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
        console.warn("LoadAllProjectsAndDocuments failed (no Tauri bridge?)", error);
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
