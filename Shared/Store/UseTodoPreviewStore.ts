import { create } from "zustand";

/** Který dokument je otevřený jen pro čtení vedle To-do boardu (nepersistuje se). */
export const UseTodoPreviewStore = create<{ docId: string | null; Open: (docId: string | null) => void }>()((set) => ({
  docId: null,
  Open: (docId) => set({ docId }),
}));
