import type { Project } from "@lockin/shared/Types/Project";
import { BUILTIN_FIELDS, type FieldDefinition, type FieldValue } from "@lockin/shared/Types/ProjectFields";

/**
 * Pole, která projekt ukazuje, v pořadí hlavičky: nejdřív podle
 * `project.fieldOrder`, zbytek ve výchozím pořadí (vestavěná, pak vlastní
 * v pořadí definic). Skrytá a smazaná pole vynechá. Vlastní pole se ukazuje,
 * jen když ho projekt používá (má hodnotu, nebo je v pořadí) — nové pole se
 * tak neobjeví ve všech projektech najednou.
 */
export function VisibleFields(project: Project, definitions: FieldDefinition[]): string[] {
  const hidden = new Set(project.hiddenFields ?? []);
  const known = new Set<string>([...BUILTIN_FIELDS, ...definitions.map((d) => d.id)]);
  const used = (id: string) => (BUILTIN_FIELDS as readonly string[]).includes(id) || id in (project.fields ?? {}) || (project.fieldOrder ?? []).includes(id);
  const defaults = [...BUILTIN_FIELDS, ...definitions.map((d) => d.id)];
  const ordered = [...(project.fieldOrder ?? []), ...defaults];
  return [...new Set(ordered)].filter((id) => known.has(id) && !hidden.has(id) && used(id));
}

/** Pole, která jdou do projektu přidat: skrytá vestavěná a nepoužitá vlastní. */
export function AddableFields(project: Project, definitions: FieldDefinition[]): string[] {
  const visible = new Set(VisibleFields(project, definitions));
  return [...BUILTIN_FIELDS, ...definitions.map((d) => d.id)].filter((id) => !visible.has(id));
}

/** Projekt s polem znovu zobrazeným (a u vlastního pole zařazeným na konec). */
export function ShowField(project: Project, fieldId: string): Project {
  const hiddenFields = (project.hiddenFields ?? []).filter((id) => id !== fieldId);
  const isBuiltin = (BUILTIN_FIELDS as readonly string[]).includes(fieldId);
  const order = project.fieldOrder ?? [...BUILTIN_FIELDS];
  const fieldOrder = isBuiltin || order.includes(fieldId) ? project.fieldOrder : [...order, fieldId];
  return { ...project, hiddenFields, ...(fieldOrder ? { fieldOrder } : {}) };
}

/** Projekt s polem skrytým — hodnota zůstává. */
export function HideField(project: Project, fieldId: string): Project {
  return { ...project, hiddenFields: [...new Set([...(project.hiddenFields ?? []), fieldId])] };
}

/** Projekt s novou hodnotou vlastního pole; `null` hodnotu smaže. */
export function SetFieldValue(project: Project, fieldId: string, value: FieldValue): Project {
  const fields = { ...(project.fields ?? {}) };
  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) delete fields[fieldId];
  else fields[fieldId] = value;
  return { ...project, fields };
}
