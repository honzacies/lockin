import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CreatePersistStorage } from "@lockin/shared/Platform/PersistStorage";

export type SidebarNavId = "quick-notes" | "library" | "your-projects" | "graph" | "canvas";
export type SidebarSectionId = "recents" | "favorites" | "folders" | "tags";

const DEFAULT_NAV_ORDER: SidebarNavId[] = ["quick-notes", "library", "your-projects", "graph", "canvas"];
const DEFAULT_SECTION_ORDER: SidebarSectionId[] = ["recents", "favorites", "folders", "tags"];

function Move<T>(list: T[], id: T, direction: "up" | "down"): T[] {
  const index = list.indexOf(id);
  if (index === -1) return list;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= list.length) return list;
  const next = [...list];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  return next;
}

function Toggle<T>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

interface SidebarLayoutState {
  navOrder: SidebarNavId[];
  hiddenNav: SidebarNavId[];
  sectionOrder: SidebarSectionId[];
  hiddenSections: SidebarSectionId[];
  /** Složky rozbalené přímo v sidebaru (strom). */
  expandedFolders: string[];
  ToggleFolderExpanded: (id: string) => void;
  MoveNav: (id: SidebarNavId, direction: "up" | "down") => void;
  ToggleNavHidden: (id: SidebarNavId) => void;
  MoveSection: (id: SidebarSectionId, direction: "up" | "down") => void;
  ToggleSectionHidden: (id: SidebarSectionId) => void;
}

/** Sidebar customization (nav/section order + hidden state) — persisted so
 * it survives an app restart, same pattern as UseTodoStore/UsePriorityStore. */
export const UseSidebarStore = create<SidebarLayoutState>()(
  persist(
    (set) => ({
      navOrder: DEFAULT_NAV_ORDER,
      hiddenNav: [],
      sectionOrder: DEFAULT_SECTION_ORDER,
      hiddenSections: [],
      expandedFolders: [],
      ToggleFolderExpanded: (id) =>
        set((state) => ({ expandedFolders: Toggle(state.expandedFolders, id) })),
      MoveNav: (id, direction) =>
        set((state) => ({ navOrder: Move(state.navOrder, id, direction) })),
      ToggleNavHidden: (id) =>
        set((state) => ({ hiddenNav: Toggle(state.hiddenNav, id) })),
      MoveSection: (id, direction) =>
        set((state) => ({ sectionOrder: Move(state.sectionOrder, id, direction) })),
      ToggleSectionHidden: (id) =>
        set((state) => ({ hiddenSections: Toggle(state.hiddenSections, id) })),
    }),
    {
      name: "lockin-sidebar-layout",
      storage: createJSONStorage(() => CreatePersistStorage("sidebar-layout.json")),
      skipHydration: true,
      // Uložené pořadí z doby před novou položkou (např. Graph) ji nezná —
      // chybějící se doplní na konec, jinak by se nikdy neukázala.
      merge: (persisted, current) => {
        const saved = persisted as Partial<SidebarLayoutState> | undefined;
        const navOrder = saved?.navOrder ?? current.navOrder;
        return {
          ...current,
          ...saved,
          navOrder: [...navOrder, ...DEFAULT_NAV_ORDER.filter((id) => !navOrder.includes(id))],
        };
      },
    },
  ),
);
