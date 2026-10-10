import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CreatePersistStorage } from "@lockin/shared/Platform/PersistStorage";

/**
 * To-do listy, které se nepočítají jako úkoly — typicky opakovaný checklist
 * v návodu („Checklist před nasazením"), který se neodškrtává jednou provždy.
 * ID listu = jeho `listId` (karta: config.id, checkbox list: `docId#nadpis`).
 * Čte ho i MCP server (`ignored-lists.json`), ať AI ignoruje totéž co Home.
 */
interface IgnoredListsState {
  ids: string[];
  SetIgnored: (listId: string, ignored: boolean) => void;
}

export const UseIgnoredListsStore = create<IgnoredListsState>()(
  persist(
    (set) => ({
      ids: [],
      SetIgnored: (listId, ignored) =>
        set((s) => ({ ids: ignored ? [...new Set([...s.ids, listId])] : s.ids.filter((id) => id !== listId) })),
    }),
    {
      name: "lockin-ignored-lists",
      storage: createJSONStorage(() => CreatePersistStorage("ignored-lists.json")),
      skipHydration: true,
      partialize: ({ ids }) => ({ ids }),
    },
  ),
);
