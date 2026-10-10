// Spuštění: bun Shared/Lib/ProjectFields.check.ts
import assert from "node:assert/strict";
import type { Project } from "../Types/Project";
import type { FieldDefinition } from "../Types/ProjectFields";
import { AddableFields, HideField, SetFieldValue, ShowField, VisibleFields } from "./ProjectFields";

const base: Project = {
  id: "p",
  name: "P",
  priority: "high",
  status: "done",
  progress: 0,
  deadline: null,
  createdAt: "",
  lastEditedAt: "",
  rootDocumentId: "d",
  documentIds: [],
  isFavorite: false,
  folderId: null,
  tagIds: [],
};
const defs: FieldDefinition[] = [{ id: "version", name: "Verze", type: "text" }];

// Starý projekt bez nových dat = přesně dnešní hlavička, vlastní pole se neukazuje.
assert.deepEqual(VisibleFields(base, defs), ["tags", "priority", "status", "progress", "deadline"]);
assert.deepEqual(AddableFields(base, defs), ["version"]);

// Skrytí vestavěného pole hodnotu nesmaže a pole jde vrátit.
const hidden = HideField(base, "priority");
assert.equal(hidden.priority, "high");
assert.ok(!VisibleFields(hidden, defs).includes("priority"));
assert.deepEqual(VisibleFields(ShowField(hidden, "priority"), defs), VisibleFields(base, defs));

// Vlastní pole: přidání, hodnota, smazání definice.
const withVersion = SetFieldValue(ShowField(base, "version"), "version", "1.2");
assert.deepEqual(VisibleFields(withVersion, defs).slice(-1), ["version"]);
assert.equal(withVersion.fields?.version, "1.2");
assert.ok(!VisibleFields(withVersion, []).includes("version"), "smazaná definice se neukazuje");
assert.equal(SetFieldValue(withVersion, "version", "").fields?.version, undefined);

// Pořadí podle fieldOrder, zbytek ve výchozím pořadí.
assert.deepEqual(VisibleFields({ ...base, fieldOrder: ["status", "tags"] }, defs).slice(0, 3), ["status", "tags", "priority"]);
console.log("ProjectFields ok");
