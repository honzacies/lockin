import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PriorityOption, StatusOption } from "@lockin/shared/Types/PriorityStatus";
import { CreatePersistStorage } from "@lockin/shared/Platform/PersistStorage";

export const DEFAULT_PRIORITIES: PriorityOption[] = [
  { id: "low", label: "Low", color: "#30a46c", icon: "material:keyboard-arrow-down" },
  { id: "medium", label: "Medium", color: "#f5a524", icon: "material:horizontal-rule" },
  { id: "high", label: "High", color: "#e5484d", icon: "material:keyboard-arrow-up" },
];

export const DEFAULT_STATUSES: StatusOption[] = [
  { id: "not-started", label: "Not Started", color: "#8b8d98", icon: "material:circle-outline" },
  { id: "in-progress", label: "In Progress", color: "#3b7cff", icon: "material:progress-activity" },
  { id: "done", label: "Done", color: "#30a46c", icon: "material:check-circle-outline" },
];

/** Výchozí volby před verzí 1 (bez ikon). Volba, která jim přesně odpovídá,
 * je nesahaná a dostane nový vzhled; cokoliv, co si uživatel změnil, zůstane. */
const V0_DEFAULTS: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "#8b8d98" },
  medium: { label: "Medium", color: "#f5a524" },
  high: { label: "High", color: "#e5484d" },
  "not-started": { label: "Not Started", color: "#8b8d98" },
  "in-progress": { label: "In Progress", color: "#3b7cff" },
  done: { label: "Done", color: "#30a46c" },
};

export function UpgradeUntouched<T extends PriorityOption>(options: T[], defaults: T[]): T[] {
  return options.map((option) => {
    const old = V0_DEFAULTS[option.id];
    const untouched = old && !option.icon && option.label === old.label && option.color.toLowerCase() === old.color;
    return untouched ? { ...option, ...defaults.find((d) => d.id === option.id) } : option;
  });
}

/** Přesune prvek na nový index (drag v Nastavení). */
function MoveTo<T extends { id: string }>(list: T[], id: string, index: number): T[] {
  const from = list.findIndex((item) => item.id === id);
  if (from === -1) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
  return next;
}

interface PriorityStoreState {
  priorities: PriorityOption[];
  statuses: StatusOption[];
  AddPriority: () => void;
  UpdatePriority: (id: string, patch: Partial<Omit<PriorityOption, "id">>) => void;
  RemovePriority: (id: string) => void;
  AddStatus: () => void;
  UpdateStatus: (id: string, patch: Partial<Omit<StatusOption, "id">>) => void;
  RemoveStatus: (id: string) => void;
  MovePriority: (id: string, index: number) => void;
  MoveStatus: (id: string, index: number) => void;
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
      MovePriority: (id, index) => set((state) => ({ priorities: MoveTo(state.priorities, id, index) })),
      MoveStatus: (id, index) => set((state) => ({ statuses: MoveTo(state.statuses, id, index) })),
    }),
    {
      name: "lockin-priority-status",
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Pick<PriorityStoreState, "priorities" | "statuses">;
        if (version >= 1 || !state) return state;
        return {
          ...state,
          priorities: UpgradeUntouched(state.priorities ?? DEFAULT_PRIORITIES, DEFAULT_PRIORITIES),
          statuses: UpgradeUntouched(state.statuses ?? DEFAULT_STATUSES, DEFAULT_STATUSES),
        };
      },
      storage: createJSONStorage(() => CreatePersistStorage("priority-status.json")),
      skipHydration: true,
    },
  ),
);
