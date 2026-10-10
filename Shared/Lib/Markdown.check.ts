// Spuštění: bun Shared/Lib/Markdown.check.ts [složka s .md soubory]
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DocToMarkdown, MarkdownToDoc, SplitFrontmatter } from "./Markdown";

const sample = `# Title

Some **bold**, *it*, \`code\`, ~~gone~~, [link](https://x.y) and [[wiki]] \\*esc\\* &amp;.

- one
- two
  - nested

1. a
2. b

- [x] done
- [ ] todo

> quote

\`\`\`ts
const a = 1;
\`\`\`

| a | b |
| --- | --- |
| 1 | 2 |

---

![img](pic.png)
`;
assert.equal(DocToMarkdown(MarkdownToDoc(sample)), sample);

const custom = { type: "doc", content: [{ type: "youtubeEmbed", attrs: { videoId: "dQw4w9WgXcQ" } }] };
assert.deepEqual(MarkdownToDoc(DocToMarkdown(custom)), custom);
// Všechny bloky ze slash menu najednou (tak, jak je píše MCP)
const mixed = MarkdownToDoc(`+ dash
+ dash 2

{lockin.palette {"title": "Brand", "groups": [{"title": "Primary", "swatches": ["#0088ff", {"color": "#111", "label": "Ink"}]}]}}

{lockin.scenario {"name": "Intro", "beats": [{"time": "0:00", "text": "Hi"}]}}

{lockin.youtube {"url": "https://youtu.be/dQw4w9WgXcQ"}}

{lockin.media {"path": "Media/a.png", "align": "block"}}

{lockin.todolist {"tasks": ["A"]}}

{lockin.todolist {"tasks": ["B"]}}`);
const [dash, palette, scenario, youtube, media, todoA, todoB] = mixed.content!;
assert.equal(dash.attrs!.variant, "dash");
assert.deepEqual(palette.attrs!.config.groups[0].swatches.map((s: { color: string; label: string }) => [s.color, s.label]), [["#0088ff", ""], ["#111", "Ink"]]);
assert.equal(palette.attrs!.config.style.colorFormat, "hex");
assert.deepEqual([scenario.attrs!.config.name, scenario.attrs!.config.beats[0].text, scenario.attrs!.config.style.showWordCount], ["Intro", "Hi", true]);
assert.equal(youtube.attrs!.videoId, "dQw4w9WgXcQ");
assert.deepEqual(media.attrs, { path: "Media/a.png", align: "block" });
assert.notEqual(todoA.attrs!.config.id, todoB.attrs!.config.id, "two lists get distinct ids");
assert.deepEqual(MarkdownToDoc(DocToMarkdown(mixed)), mixed);
// stará paleta `{"config": …}` se pořád čte
assert.equal(MarkdownToDoc('{lockin.palette {"config": {"title": "Old"}}}').content![0].attrs!.config.title, "Old");
// Komponenty: ručně psaný to-do list se doplní a uloží se jako {lockin.todolist …}
const todo = MarkdownToDoc('{lockin.todolist {"title": "Launch", "tasks": ["A", {"title": "B", "done": true}]}}');
const config = todo.content![0].attrs!.config;
assert.equal(todo.content![0].type, "richTodoList");
assert.deepEqual(config.tasks.map((t: { title: string; done: boolean }) => [t.title, t.done]), [["A", false], ["B", true]]);
assert.ok(DocToMarkdown(todo).startsWith("{lockin.todolist {"));
assert.deepEqual(MarkdownToDoc(DocToMarkdown(todo)), todo);
// skupiny s ikonou a úkoly s popisem
const grouped = MarkdownToDoc(`{lockin.todolist {
  "id": "gw",
  "title": "Game Within",
  "deadline": "2026-10-20",
  "groups": [
    { "icon": "⚙️", "title": "Základ projektu", "tasks": [{ "title": "Založit GitHub repozitáře", "description": "Privátní web a api." }, "Fonty"] }
  ]
}}`).content![0].attrs!.config;
assert.equal(grouped.deadline, "2026-10-20");
assert.deepEqual(
  [grouped.groups[0].icon, grouped.groups[0].title, grouped.groups[0].tasks[0].description, grouped.groups[0].tasks[1].title],
  ["⚙️", "Základ projektu", "Privátní web a api.", "Fonty"],
);
// starý ```lockin blok se pořád načte
assert.equal(MarkdownToDoc('```lockin\n{"type":"media","attrs":{"src":"a.png"}}\n```').content![0].type, "media");
// rozbitý JSON zůstane textem
assert.equal(MarkdownToDoc("{lockin.todolist {oops}").content![0].type, "paragraph");

const fm = SplitFrontmatter("---\ntags: [a]\n---\n# Hi\n");
assert.equal(fm.frontmatter, "---\ntags: [a]\n---\n");
assert.equal(fm.body, "# Hi\n");

// Druhý průchod už nesmí nic měnit — jinak by se soubor přepisoval pokaždé.
const dir = process.argv[2];
if (dir) {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".md")) files.push(path);
    }
  };
  walk(dir);
  for (const file of files) {
    const once = DocToMarkdown(MarkdownToDoc(SplitFrontmatter(readFileSync(file, "utf8")).body));
    assert.equal(DocToMarkdown(MarkdownToDoc(once)), once, file);
  }
  console.log(`${files.length} files stable`);
}
console.log("Markdown ok");

// Neupravený dokument se musí uložit bajt po bajtu stejně jako originál.
{
  const { PatchMarkdown } = await import("./Markdown");
  assert.equal(PatchMarkdown(sample, MarkdownToDoc(sample)), sample);
  const edited = MarkdownToDoc(sample);
  edited.content![0] = { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Changed" }] };
  assert.equal(PatchMarkdown(sample, edited), sample.replace("# Title", "# Changed"));
  if (dir) {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        if (name.startsWith(".")) continue;
        const path = join(d, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith(".md")) files.push(path);
      }
    };
    walk(dir);
    for (const file of files) {
      const { body } = SplitFrontmatter(readFileSync(file, "utf8"));
      assert.equal(PatchMarkdown(body, MarkdownToDoc(body)), body, `patch ${file}`);
    }
    console.log(`${files.length} files unchanged by save`);
  }
}

// Canvas dokumentu žije v témže .md jako jeden komentář; "-->" uvnitř ho neukončí.
{
  const { JoinCanvas, SplitCanvas } = await import("./Markdown");
  const canvas = { nodes: [{ id: "n", type: "text" as const, x: 0, y: 0, width: 9, height: 9, text: "a --> b" }], edges: [], strokes: [] };
  const md = DocToMarkdown(JoinCanvas(MarkdownToDoc("# Hi"), canvas));
  assert.equal(md.match(/-->/g)?.length, 1);
  const back = SplitCanvas(MarkdownToDoc(md));
  assert.deepEqual(back.canvas, canvas);
  assert.equal(DocToMarkdown(back.doc), "# Hi\n");
  assert.equal(DocToMarkdown(JoinCanvas(MarkdownToDoc("# Hi"), { nodes: [], edges: [], strokes: [] })), "# Hi\n", "empty canvas isn't written");
  console.log("Canvas embed ok");
}

// Šířky sloupců tabulky: `|------|` nese šířku, `| --- |` a Prettierovo `| ------ |` ne.
{
  const md = "| a | b |\n|------------| --- |\n| 1 | 2 |\n";
  const doc = MarkdownToDoc(md);
  const cells = doc.content![0].content![0].content!;
  assert.deepEqual(cells[0].attrs?.colwidth, [120]);
  assert.equal(cells[1].attrs?.colwidth, undefined);
  assert.equal(DocToMarkdown(doc), md);
  const prettier = MarkdownToDoc("| a | b |\n| ------ | ------ |\n| 1 | 2 |\n");
  assert.equal(prettier.content![0].content![0].content![0].attrs?.colwidth, undefined);
  console.log("Table widths ok");
}
