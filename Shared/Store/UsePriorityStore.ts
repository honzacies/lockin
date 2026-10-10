import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PriorityOption, StatusOption } from "@lockin/shared/Types/PriorityStatus";
import { CreatePersistStorage } from "@lockin/shared/Platform/PersistStorage";

const DEFAULT_PRIORITIES: PriorityOption[] = [
  { id: "low", label: "Low", color: "#8b8d98" },
  { id: "medium", label: "Medium", color: "#f5a524" },
  { id: "high", label: "High", color: "#e5484d" },
];

const DEFAULT_STATUSES: StatusOption[] = [
  { id: "not-started", label: "Not Started", color: "#8b8d98" },
  { id: "in-progress", label: "In Progress", color: "#3b7cff" },
  { id: "done", label: "Done", color: "#30a46c" },
];

interface PriorityStoreState {
  priorities: PriorityOption[];
  statuses: StatusOption[];
  AddPriority: () => void;
  UpdatePriority: (id: string, patch: Partial<Omit<PriorityOption, "id">>) => void;
  RemovePriority: (id: string) => void;
  AddStatus: () => void;
  UpdateStatus: (id: string, patch: Partial<Omit<StatusOption, "id">>) => void;
  RemoveStatus: (id: string) => void;
}

/** Global, app-wide priority/status definitions (labels + colors), editable
 * from the pencil in any priority/status picker — applies to every project. */
export const UsePriorityStore = create<PriorityStoreState>()(
  persist(
    (set) => ({
      priorities: DEFAULT_PRIORITIES,
      statuses: DEFAULT_STATUSES,
      AddPriority: () =>
        set((state) => ({
          priorities: [
            ...state.priorities,
            { id: `priority-${crypto.randomUUID()}`, label: "New priority", color: "#8b8d98" },
          ],
        })),
      UpdatePriority: (id, patch) =>
        set((state) => ({
          priorities: state.priorities.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      RemovePriority: (id) =>
        set((state) => ({ priorities: state.priorities.filter((p) => p.id !== id) })),
      AddStatus: () =>
        set((state) => ({
          statuses: [
            ...state.statuses,
            { id: `status-${crypto.randomUUID()}`, label: "New status", color: "#8b8d98" },
          ],
        })),
      UpdateStatus: (id, patch) =>
        set((state) => ({
          statuses: state.statuses.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      RemoveStatus: (id) =>
        set((state) => ({ statuses: state.statuses.filter((s) => s.id !== id) })),
    }),
    {
      name: "lockin-priority-status",
      storage: createJSONStorage(() => CreatePersistStorage("priority-status.json")),
      skipHydration: true,
    },
  ),
);
