// Spuštění: bun Shared/Lib/TodoEdit.check.ts
import assert from "node:assert/strict";
import { DocToMarkdown, MarkdownToDoc } from "./Markdown";
import { FindLists } from "./CollectTodoSources";
import { EditDocumentList } from "./TodoEdit";
import type { DocumentRecord } from "@lockin/shared/Types/Project";

const md = `## Úkoly

{lockin.todolist {"id": "todo-x", "title": "X", "tasks": ["A"], "groups": [{"title": "G", "tasks": ["B"]}]}}

## Checklist

- [ ] one
- [x] two
`;
let doc = { id: "md:x.md", text: { json: MarkdownToDoc(md) } } as unknown as DocumentRecord;
const Lists = () => FindLists(doc.id, doc.text.json);
const Edit = (listId: string, edit: Parameters<typeof EditDocumentList>[2]) => {
  const next = EditDocumentList(doc, listId, edit);
  assert.ok(next, "edit applied");
  doc = next;
};

// karta: odškrtnutí, přejmenování, nový úkol do skupiny
Edit("todo-x", { kind: "toggle", taskId: "t0" });
Edit("todo-x", { kind: "rename", taskId: "g0t0", title: "B2" });
Edit("todo-x", { kind: "add", title: "C", groupId: "g0" });
const card = Lists()[0];
assert.equal(card.tasks[0].done, true);
assert.deepEqual(card.groups[0].tasks.map((t) => t.title), ["B2", "C"]);

// checkbox list: odškrtnutí, přejmenování, nový úkol
const checklist = Lists()[1].id;
Edit(checklist, { kind: "toggle", taskId: "one" });
Edit(checklist, { kind: "rename", taskId: "two", title: "dva" });
Edit(checklist, { kind: "add", title: "three" });
assert.deepEqual(
  Lists()[1].tasks.map((t) => [t.title, t.done]),
  [["one", true], ["dva", true], ["three", false]],
);

// uloží se do markdownu a po znovunačtení platí
const saved = DocToMarkdown(doc.text.json);
assert.ok(saved.includes("- [x] one") && saved.includes("- [ ] three"));
assert.equal(FindLists("r", MarkdownToDoc(saved))[0].groups[0].tasks[1].title, "C");
// neznámý list = null, nic se nezmění
assert.equal(EditDocumentList(doc, "nope", { kind: "toggle", taskId: "x" }), null);
console.log("TodoEdit ok");
