import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FieldDefinition, FieldOption, FieldType } from "@lockin/shared/Types/ProjectFields";
import { CreatePersistStorage } from "@lockin/shared/Platform/PersistStorage";

interface FieldStoreState {
  /** Vlastní pole projektů v tomhle workspace (vestavěná sem nepatří). */
  definitions: FieldDefinition[];
  AddField: (name: string, type: FieldType) => FieldDefinition;
  UpdateField: (id: string, patch: Partial<Omit<FieldDefinition, "id">>) => void;
  RemoveField: (id: string) => void;
  AddOption: (fieldId: string, label: string) => FieldOption | null;
}

const OPTION_COLORS = ["#8b8d98", "#3b7cff", "#30a46c", "#f5a524", "#e5484d", "#8e4ec6", "#12a594"];

/** Definice vlastních polí projektů — jedna sada pro celý workspace (soubor jako priority). */
export const UseFieldStore = create<FieldStoreState>()(
  persist(
    (set, get) => ({
      definitions: [],
      AddField: (name, type) => {
        const field: FieldDefinition = {
          id: `field-${crypto.randomUUID()}`,
          name: name.trim() || "Untitled",
          type,
          ...(type === "select" || type === "multiSelect" ? { options: [] } : {}),
        };
        set((state) => ({ definitions: [...state.definitions, field] }));
        return field;
      },
      UpdateField: (id, patch) =>
        set((state) => ({ definitions: state.definitions.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      RemoveField: (id) => set((state) => ({ definitions: state.definitions.filter((f) => f.id !== id) })),
      AddOption: (fieldId, label) => {
        const field = get().definitions.find((f) => f.id === fieldId);
        if (!field) return null;
        const options = field.options ?? [];
        const option: FieldOption = {
          id: `option-${crypto.randomUUID()}`,
          label: label.trim() || "Option",
          color: OPTION_COLORS[options.length % OPTION_COLORS.length],
        };
        get().UpdateField(fieldId, { options: [...options, option] });
        return option;
      },
    }),
    {
      name: "lockin-project-fields",
      storage: createJSONStorage(() => CreatePersistStorage("project-fields.json")),
      skipHydration: true,
    },
  ),
);
