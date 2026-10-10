"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { UseIgnoredListsStore } from "@lockin/shared/Store/UseIgnoredListsStore";
import { DISK_CHANGED_EVENT, LoadAllProjectsAndDocuments, RebuildIndex, SyncFromDisk } from "@lockin/shared/Lib/Storage";
import { SweepOrphanedMedia } from "@lockin/shared/Lib/MediaStorage";
import { GetPlatform } from "@lockin/shared/Platform/Platform";
import { ReleasePointerOnBlur } from "@lockin/shared/Lib/ReleasePointerOnBlur";
import { MatchShortcut } from "@lockin/shared/Lib/Shortcuts";
import { CreateNewDocument } from "@lockin/shared/Lib/CreateDocument";
import { ResolvedTheme, UseSettingsStore } from "@lockin/shared/Store/UseSettingsStore";
import { GlobalTooltip } from "@lockin/shared/Components/Shared/GlobalTooltip";
import { SettingsDialog } from "@lockin/shared/Components/Settings/SettingsDialog";

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

  useEffect(ReleasePointerOnBlur, []);

  // Externí odkazy (README, odkazy v poznámkách, „Open on GitHub") do systémového
  // prohlížeče — WebView v Tauri by je jinak tiše ignoroval.
  useEffect(() => {
    const OnClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href");
      if (!href || !/^(https?:|mailto:)/i.test(href)) return;
      e.preventDefault();
      GetPlatform().window.OpenUrl(href).catch((error: unknown) => console.warn("OpenUrl failed", error));
    };
    document.addEventListener("click", OnClick, true);
    return () => document.removeEventListener("click", OnClick, true);
  }, []);

  // Motiv: třída `dark` (HeroUI) + data-theme (naše CSS proměnné); u "system" sleduje OS.
  const theme = UseSettingsStore((s) => s.theme);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const Apply = () => {
      const dark = ResolvedTheme(theme) === "dark";
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    Apply();
    media.addEventListener("change", Apply);
    return () => media.removeEventListener("change", Apply);
  }, [theme]);

  // Zkratky aplikace — přemapovatelné v Settings → Keyboard shortcuts (Lib/Shortcuts.ts).
  const router = useRouter();
  useEffect(() => {
    const OnKeyDown = (e: KeyboardEvent) => {
      const action = MatchShortcut(e, UseSettingsStore.getState().shortcuts);
      if (!action) return;
      e.preventDefault();
      const settings = UseSettingsStore.getState();
      switch (action) {
        case "search":
          router.push("/Search");
          break;
        case "settings":
          if (settings.open) settings.Close();
          else settings.Open(window.location.pathname.startsWith("/Todo") ? "session" : "general");
          break;
        case "newDocument":
          router.push(`/Document?id=${encodeURIComponent(CreateNewDocument().id)}`);
          break;
        case "toggleSidebar":
          UseUiStore.getState().ToggleSidebar();
          break;
        case "toggleTheme":
          settings.Set({ theme: ResolvedTheme(settings.theme) === "dark" ? "light" : "dark" });
          break;
      }
    };
    window.addEventListener("keydown", OnKeyDown);
    return () => window.removeEventListener("keydown", OnKeyDown);
  }, [router]);

  // Soubory změněné mimo aplikaci (AI agent, Obsidian) se načtou znovu — při
  // návratu do okna a hned, když na ně narazí ukládání.
  useEffect(() => {
    const Sync = () => {
      if (UseDataStore.getState().hydrated) SyncFromDisk().catch((error: unknown) => console.warn("SyncFromDisk failed", error));
    };
    window.addEventListener("focus", Sync);
    // Pojistka: dokument sám se nikdy neposouvá (UI nesmí ujet z okna) — jen jeho sloupce.
    const PinDocument = () => {
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    };
    window.addEventListener("scroll", PinDocument);
    window.addEventListener(DISK_CHANGED_EVENT, Sync);
    return () => {
      window.removeEventListener("focus", Sync);
      window.removeEventListener("scroll", PinDocument);
      window.removeEventListener(DISK_CHANGED_EVENT, Sync);
    };
  }, []);

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
    UseIgnoredListsStore.persist.rehydrate()?.catch((error: unknown) => {
      console.warn("UseIgnoredListsStore: rehydrate failed", error);
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
        // Dřívější textový štítek projektu (`tag`) → Library štítek, stejný
        // systém jako u dokumentů. Až po rehydrataci, ať se vidí existující štítky.
        Promise.resolve(dataRehydrated).then(() => {
          for (const project of Object.values(UseDataStore.getState().projects)) {
            const name = project.tag?.trim();
            if (!name) continue;
            const store = UseDataStore.getState();
            let tag = Object.values(store.tags).find((t) => t.name.toLowerCase() === name.toLowerCase());
            if (!tag) {
              tag = store.AddTag();
              store.RenameTag(tag.id, name);
            }
            const tagIds = project.tagIds.includes(tag.id) ? project.tagIds : [...project.tagIds, tag.id];
            store.UpsertProject({ ...project, tag: undefined, tagIds });
          }
        });
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
    // Pro „Open on start → Where I left off".
    if (pathname && pathname !== "/") UseSettingsStore.getState().Set({ lastPage: pathname + window.location.search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="flex h-screen w-screen overflow-clip bg-white">
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-clip">
        <Topbar onToggleSidebar={toggleSidebar} />
        <TodoSettingsPanelSlot>{children}</TodoSettingsPanelSlot>
      </div>
      <SettingsDialog />
      <GlobalTooltip />
    </div>
  );
}

/** Prázdný sidebar ve stejných rozměrech — drží místo, než se Sidebar
 * vykreslí, aby obsah vedle nepodskočil. Vlastní řádky nekreslí; Sidebar má
 * své skeletony a naskočí hned po hydrataci. */
function SidebarPlaceholder() {
  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col border-r border-[var(--lk-line)] bg-[var(--lk-panel)] p-2.5" />
  );
}
