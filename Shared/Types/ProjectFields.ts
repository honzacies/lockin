/**
 * Pole (vlastnosti) projektu. Vestavěná pole mají hodnoty tam, kde byly vždy
 * (`project.priority`, `project.tagIds`…); vlastní pole uživatele žijí
 * v `project.fields[definition.id]`. Definice vlastních polí jsou společné
 * pro celý workspace — díky tomu jdou řadit a filtrovat napříč projekty.
 */

export const BUILTIN_FIELDS = ["tags", "priority", "status", "progress", "deadline"] as const;
export type BuiltinFieldId = (typeof BUILTIN_FIELDS)[number];

export type FieldType = "text" | "number" | "date" | "select" | "multiSelect" | "checkbox" | "url";

export interface FieldOption {
  id: string;
  label: string;
  color: string;
  icon?: string;
}

/** Vlastní pole — definice sdílená všemi projekty workspace. */
export interface FieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  icon?: string;
  /** Jen u `select` / `multiSelect`. */
  options?: FieldOption[];
}

/** Hodnota vlastního pole: text/odkaz/datum = string, číslo = number,
 * ano/ne = boolean, výběr = id volby, více výběrů = id voleb. */
export type FieldValue = string | number | boolean | string[] | null;

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Select",
  multiSelect: "Multi-select",
  checkbox: "Checkbox",
  url: "Link",
};
