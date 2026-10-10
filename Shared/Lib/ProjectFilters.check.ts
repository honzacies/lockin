// Spuštění: bun Shared/Lib/ProjectFilters.check.ts
import assert from "node:assert/strict";
import type { Project } from "../Types/Project";
import { DeadlineBucketOf, FilterProjects, SortProjects } from "./ProjectFilters";

const P = (id: string, over: Partial<Project>): Project => ({
  id,
  name: id,
  priority: "low",
  status: "not-started",
  progress: 0,
  deadline: null,
  createdAt: "",
  lastEditedAt: "",
  rootDocumentId: `${id}-root`,
  documentIds: [],
  isFavorite: false,
  folderId: null,
  tagIds: [],
  ...over,
});
const today = "2026-10-11";
const list = [
  P("a", { status: "done", priority: "high", progress: 100, deadline: "2026-10-01", tagIds: ["t2"] }),
  P("b", { status: "in-progress", priority: "medium", progress: 40, deadline: "2026-10-14", fields: { f: "o1" } }),
  P("c", { progress: 0, tagIds: ["t1"], fields: { f: ["o1", "o2"], cb: true } }),
];
const ids = (ps: Project[]) => ps.map((p) => p.id);

assert.deepEqual(ids(FilterProjects(list, {}, today)), ["a", "b", "c"]);
assert.deepEqual(ids(FilterProjects(list, { status: "done" }, today)), ["a"]);
assert.deepEqual(ids(FilterProjects(list, { progress: "inProgress" }, today)), ["b"]);
assert.deepEqual(ids(FilterProjects(list, { deadline: "overdue" }, today)), ["a"]);
assert.deepEqual(ids(FilterProjects(list, { deadline: "week" }, today)), ["b"]);
assert.deepEqual(ids(FilterProjects(list, { deadline: "none" }, today)), ["c"]);
assert.deepEqual(ids(FilterProjects(list, { fields: { f: "o1" } }, today)), ["b", "c"], "výběr i více výběrů");
assert.deepEqual(ids(FilterProjects(list, { fields: { cb: "true" } }, today)), ["c"]);
assert.deepEqual(ids(FilterProjects(list, { status: "in-progress", priority: "high" }, today)), [], "filtry platí současně");
assert.equal(DeadlineBucketOf("2026-10-11", today), "today");

const ctx = { statusOrder: ["not-started", "in-progress", "done"], priorityOrder: ["low", "medium", "high"], tagName: (id: string) => ({ t1: "Alpha", t2: "Beta" })[id] ?? "" };
assert.deepEqual(ids(SortProjects(list, { key: "priority", reversed: false }, ctx)), ["a", "b", "c"], "nejvyšší priorita první");
assert.deepEqual(ids(SortProjects(list, { key: "progress", reversed: false }, ctx)), ["a", "b", "c"]);
assert.deepEqual(ids(SortProjects(list, { key: "deadline", reversed: false }, ctx)), ["a", "b", "c"], "bez deadline na konci");
assert.deepEqual(ids(SortProjects(list, { key: "deadline", reversed: true }, ctx)), ["b", "a", "c"], "i obráceně na konci");
assert.deepEqual(ids(SortProjects(list, { key: "tag", reversed: false }, ctx)), ["c", "a", "b"]);
assert.deepEqual(ids(SortProjects(list, { key: "status", reversed: false }, ctx)), ["c", "b", "a"]);
console.log("ProjectFilters ok");
