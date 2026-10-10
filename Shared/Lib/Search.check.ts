// Spuštění: bun Shared/Lib/Search.check.ts
import assert from "node:assert/strict";
import type { DocumentRecord } from "@lockin/shared/Types/Project";
import { MarkdownToDoc } from "./Markdown";
import { SearchWorkspace } from "./Search";

const doc = (id: string, name: string, md: string) =>
  ({ id, name, description: "", projectId: null, updatedAt: "2026-10-01", text: { json: MarkdownToDoc(md) } }) as unknown as DocumentRecord;

const documents = [
  doc("a", "Přehrávač", "Plán hudebního přehrávače.\n\n```rust\nfn main() {\n    play_queue();\n}\n```\n\n- [ ] Fronta v Rustu\n- [x] Hotová věc"),
  doc("b", "Nákupy", "Mléko a chleba."),
];
const quickLists = [{ id: "q", title: "Inbox", tasks: [{ id: "t1", title: "Zavolat přehrávač servis", description: "", done: false }], groups: [] }];
const Search = (q: string) => SearchWorkspace(q, { documents, projects: {}, quickLists } as never);

// bez diakritiky a velikosti písmen, název dokumentu vyhrává
assert.equal(Search("prehravac")[0].key, "d:a");
// všechna slova musí sedět
assert.equal(Search("mléko rust").length, 0);
// kód: najde řádek a dá kontext
const code = Search("play_queue").find((h) => h.kind === "code")!;
assert.equal(code.language, "rust");
assert.ok(code.snippet.includes("play_queue();"));
// úkoly z checklistu i Quick Notes, hotové až za otevřenými
const tasks = Search("fronta").filter((h) => h.kind === "task");
assert.deepEqual(tasks.map((t) => t.title), ["Fronta v Rustu"]);
assert.ok(Search("prehravac").some((h) => h.kind === "task" && h.href === "/QuickNotes"));
const done = Search("hotova");
assert.equal(done.at(-1)?.done, true);
assert.deepEqual(Search("   "), []);
console.log("Search ok");
