/**
 * Vygeneruje `TauriBuild/out/mock-fixture.json` — vymyšlený workspace pro
 * screenshoty do README a pro ruční testování UI v prohlížeči (DESIGN.md §9).
 *
 * Spuštění (z kořene repa, po `NEXT_PUBLIC_LOCKIN_MOCK=1 bun run build`):
 *   bun TauriBuild/Tools/MakeMockFixture.ts
 *
 * Obsah je smyšlený naschvál: do veřejných screenshotů nesmí nic z reálného
 * workspacu. Dokumenty se píšou v Markdownu a projdou stejným parserem jako
 * vault (`MarkdownToDoc`), takže není co udržovat navíc v Tiptap JSON.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MarkdownToDoc } from "@lockin/shared/Lib/Markdown";
import type { DocumentRecord, Manifest, ManifestEntry, Project } from "@lockin/shared/Types/Project";

const OUT = fileURLToPath(new URL("../out/mock-fixture.json", import.meta.url));

const DAY = 86_400_000;
/** Pevné datum, ať se fixture nemění od spuštění ke spuštění (a tím i screenshoty). */
const NOW = Date.parse("2026-05-18T09:20:00.000Z");
const Ago = (days: number) => new Date(NOW - days * DAY).toISOString();

// --- knihovna -------------------------------------------------------------

const folders = {
  product: { id: "f-product", name: "Product", description: "Specs, releases and decisions for Harbor.", isFavorite: true, icon: "📦", createdAt: Ago(120), updatedAt: Ago(3) },
  research: { id: "f-research", name: "Research", description: "Interviews, surveys and raw session notes.", isFavorite: false, icon: "🔍", createdAt: Ago(96), updatedAt: Ago(9) },
  personal: { id: "f-personal", name: "Personal", description: "Everything that isn't work.", isFavorite: false, icon: "🌿", createdAt: Ago(140), updatedAt: Ago(1) },
};

const tags = {
  release: { id: "t-release", name: "Release", description: "Has to ship in the next version.", isFavorite: true, color: "#e5484d", createdAt: Ago(120), updatedAt: Ago(3) },
  research: { id: "t-research", name: "Research", description: "Evidence, not opinions.", isFavorite: false, color: "#0e9f6e", createdAt: Ago(96), updatedAt: Ago(9) },
  writing: { id: "t-writing", name: "Writing", description: "Drafts, notes and reading.", isFavorite: false, color: "#7c6cf5", createdAt: Ago(140), updatedAt: Ago(1) },
};

// --- dokumenty ------------------------------------------------------------

/** `{lockin.todolist …}` na vlastním řádku = blok to-do listu v dokumentu. */
const TodoList = (config: object) => `{lockin.todolist ${JSON.stringify(config)}}`;

interface Mock {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  projectId?: string;
  folderId?: string;
  tagIds?: string[];
  isFavorite?: boolean;
  days: number;
  md: string;
}

const documents: Mock[] = [
  {
    id: "d-harbor-root",
    description: "Photo albums that never leave your disk.",
    name: "Harbor 1.4",
    projectId: "p-harbor",
    days: 1,
    md: `Harbor is a photo library that keeps every album on your own disk. **1.4** is the
release where sharing stops being an export dialog and becomes a first-class feature.

## Milestones

| Milestone | Owner | Status |
| --------------- | ------ | ----------- |
| Shared albums | Mira | In progress |
| Offline sync | Theo | In progress |
| Public beta | Mira | Not started |

## Open questions

- Do shared albums need per-photo permissions, or is per-album enough for 1.4?
- How long do we keep a deleted album recoverable?

> Rule of thumb for this release: if a feature needs a tutorial, it isn't done yet.
`,
  },
  {
    id: "d-release-plan",
    description: "Everything that has to land before we tag v1.4.0.",
    name: "Release 1.4 plan",
    icon: "🚢",
    projectId: "p-harbor",
    tagIds: ["t-release"],
    isFavorite: true,
    days: 0,
    md: `Everything that has to land before we tag \`v1.4.0\`. Research lives in
[[Onboarding research]]; weekly status goes in [[Weekly notes]].

## This release

${TodoList({
  title: "Ship 1.4",
  deadline: "2026-05-29",
  tasks: [
    { title: "Freeze the album schema", description: "No migrations after the beta goes out.", done: true },
    { title: "Shared album invites", description: "Link + email, no accounts needed.", done: true },
    { title: "Offline sync conflicts", description: "Last writer wins, keep a copy of the loser." },
  ],
  groups: [
    {
      title: "Before the beta",
      icon: "🧪",
      tasks: [
        { title: "Crash reporter opt-in screen" },
        { title: "Write the migration note for 1.3 users" },
        { title: "Record a 40 second demo clip" },
      ],
    },
    {
      title: "Nice to have",
      icon: "✨",
      tasks: [{ title: "Keyboard shortcut for \"new album\"" }, { title: "Dark mode for the invite page" }],
    },
  ],
})}

## Release checklist

1. Tag the commit and let CI build the installers.
2. Smoke-test the installer on a clean machine.
3. Publish the notes, then post the demo clip.

## Rollback

If sync corrupts a library we pull the release and ship \`1.3.6\` within the hour:

\`\`\`bash
harbor release rollback --to 1.3.6 --notify
\`\`\`

> Anything still open on release day moves to 1.5. We don't slip the date for polish.
`,
  },
  {
    id: "d-onboarding-research",
    description: "Eight sessions with people who had never opened Harbor.",
    name: "Onboarding research",
    icon: "🔍",
    projectId: "p-harbor",
    folderId: "f-research",
    tagIds: ["t-research"],
    days: 9,
    md: `Eight sessions, 30 minutes each, people who had never opened Harbor before.

## What everyone did

- Dragged a folder onto the window within the first minute. Nobody used the menu.
- Expected the first album to be created *for* them from the folder name.
- Looked for sharing in the right-click menu before the toolbar.

## Where they got stuck

| Step | Finished | Average time |
| --------------- | -------- | ------------ |
| Import a folder | 8 / 8 | 0:40 |
| Make an album | 6 / 8 | 2:10 |
| Share an album | 3 / 8 | 4:55 |

## What we changed

+ The import drop zone is now the empty state, not a hint in the corner.
+ "Share" moved into the album header next to the title.
+ The invite link copies itself to the clipboard the moment it is created.

> "I thought it saved to the cloud, so I waited. It was already done." — session 6
`,
  },
  {
    id: "d-weekly-notes",
    description: "A short log of decisions, not minutes.",
    name: "Weekly notes",
    icon: "🗓️",
    folderId: "f-personal",
    days: 1,
    md: `## Monday

Planning for [[Release 1.4 plan]]. Sync conflicts are the only real risk left —
everything else is polish we can cut.

+ Reviewed the invite flow with Mira
+ Moved the beta date a week later, on purpose, once

## Wednesday

Pairing on the conflict resolver. Keeping a copy of the losing version is cheap
and it makes the whole feature feel safe, so it stays.

## Friday

Read through [[Onboarding research]] again. The pattern is the same every time:
people drag a folder in and expect everything else to follow from that.

> Next week: one thing at a time, and the demo clip before the polish.
`,
  },
  {
    id: "d-reading-list",
    description: "Short things worth finishing.",
    name: "Reading list",
    icon: "📚",
    folderId: "f-personal",
    tagIds: ["t-writing"],
    days: 6,
    md: `Short things worth finishing, long things worth starting.

${TodoList({
  title: "Reading",
  style: { variant: "transparent" },
  tasks: [
    { title: "The Design of Everyday Things — ch. 4", done: true },
    { title: "Notes on file formats that outlive their apps" },
    { title: "Local-first software (the essay, again)" },
  ],
})}
`,
  },
];

// --- projekt --------------------------------------------------------------

const project: Project = {
  id: "p-harbor",
  name: "Harbor 1.4",
  icon: "⚓",
  priority: "high",
  status: "in-progress",
  progress: 62,
  deadline: "2026-05-29",
  createdAt: Ago(120),
  lastEditedAt: Ago(1),
  rootDocumentId: "d-harbor-root",
  documentIds: ["d-release-plan", "d-onboarding-research"],
  isFavorite: true,
  folderId: "f-product",
  tagIds: ["t-release"],
};

// --- focus board ----------------------------------------------------------

const Task = (
  id: string,
  title: string,
  column: "backlog" | "week" | "today",
  extra: { groupId?: string; estimateMin?: number | null; spentSec?: number; done?: boolean; description?: string } = {},
) => ({
  id,
  title,
  column,
  estimateMin: extra.estimateMin ?? null,
  spentSec: extra.spentSec ?? 0,
  done: extra.done ?? false,
  ...extra,
});

const board = {
  runningSince: null,
  groups: [{ id: "fg-ship", column: "today", title: "Ship 1.4", icon: "🚢", sourceListId: "todo" }],
  tasks: [
    Task("ft-1", "Offline sync conflicts", "today", { groupId: "fg-ship", estimateMin: 90, spentSec: 2_640 }),
    Task("ft-2", "Crash reporter opt-in screen", "today", { groupId: "fg-ship", estimateMin: 45, done: true, spentSec: 2_210 }),
    Task("ft-3", "Record a 40 second demo clip", "today", { groupId: "fg-ship", estimateMin: 30 }),
    Task("ft-4", "Reply to the beta waitlist", "today", { estimateMin: 15 }),
    Task("ft-5", "Write the migration note for 1.3 users", "week", { estimateMin: 60 }),
    Task("ft-6", "Smoke-test the installer on a clean machine", "week", { estimateMin: 45 }),
    Task("ft-7", "Dark mode for the invite page", "backlog"),
    Task("ft-8", "Keyboard shortcut for \"new album\"", "backlog"),
    Task("ft-9", "Per-photo permissions (1.5?)", "backlog"),
  ],
};

// --- canvas ---------------------------------------------------------------

const canvas = {
  id: "c-release-flow",
  name: "Release flow",
  updatedAt: Ago(2),
  strokes: [],
  nodes: [
    { id: "n-start", type: "text", shape: "ellipse", text: "", x: -520, y: -60, width: 160, height: 160, fill: "#eef2ff", stroke: "#4f46e5", strokeWidth: 2 },
    { id: "n-start-label", type: "text", shape: "text", text: "Feature freeze", x: -520, y: -4, width: 160, height: 48, stroke: "#4f46e5", fontSize: 20, bold: true, align: "center" },
    { id: "n-beta", type: "text", shape: "rect", text: "", x: -240, y: -140, width: 240, height: 120, fill: "#ffffff", stroke: "#2c2c2b", strokeWidth: 2 },
    { id: "n-beta-label", type: "text", shape: "text", text: "Public beta\n7 days", x: -240, y: -100, width: 240, height: 56, stroke: "#2c2c2b", fontSize: 20, align: "center" },
    { id: "n-fix", type: "text", shape: "rect", text: "", x: -240, y: 60, width: 240, height: 120, fill: "#ffffff", stroke: "#2c2c2b", strokeWidth: 2 },
    { id: "n-fix-label", type: "text", shape: "text", text: "Fix + re-test", x: -240, y: 100, width: 240, height: 40, stroke: "#2c2c2b", fontSize: 20, align: "center" },
    { id: "n-ship", type: "text", shape: "ellipse", text: "", x: 120, y: -60, width: 160, height: 160, fill: "#ecfdf5", stroke: "#0e9f6e", strokeWidth: 2 },
    { id: "n-ship-label", type: "text", shape: "text", text: "Tag v1.4.0", x: 120, y: -4, width: 160, height: 48, stroke: "#0e9f6e", fontSize: 20, bold: true, align: "center" },
  ],
  edges: [
    { id: "e-1", fromNode: "n-start", fromSide: "right", toNode: "n-beta", toSide: "left", label: "day 0" },
    { id: "e-2", fromNode: "n-beta", fromSide: "bottom", toNode: "n-fix", toSide: "top", label: "crash reports" },
    { id: "e-3", fromNode: "n-fix", fromSide: "right", toNode: "n-ship", toSide: "bottom", label: "green build" },
    { id: "e-4", fromNode: "n-beta", fromSide: "right", toNode: "n-ship", toSide: "top", label: "no blockers", bend: 120 },
  ],
};

// --- složení fixture ------------------------------------------------------

const records: DocumentRecord[] = documents.map((d) => ({
  id: d.id,
  projectId: d.projectId ?? null,
  name: d.name,
  description: d.description ?? "",
  icon: d.icon,
  createdAt: Ago(d.days + 14),
  updatedAt: Ago(d.days),
  lastMode: "text",
  folderId: d.folderId ?? null,
  tagIds: d.tagIds ?? [],
  isFavorite: d.isFavorite ?? false,
  text: { json: MarkdownToDoc(d.md) },
  sketch: { strokes: [] },
}));

const entries: ManifestEntry[] = [
  { id: project.id, kind: "project", name: project.name, priority: project.priority, status: project.status, progress: project.progress, deadline: project.deadline, updatedAt: project.lastEditedAt },
  ...records.map((d): ManifestEntry => ({ id: d.id, kind: "document", name: d.name, updatedAt: d.updatedAt })),
];

/** Soubor plugin-store: `{ "<zustand klíč>": "<serializovaný stav>" }`. */
const Store = (key: string, state: unknown) => JSON.stringify({ [key]: JSON.stringify({ state, version: 0 }) });

const fixture: Record<string, string> = {
  "Manifest.json": JSON.stringify({ entries } satisfies Manifest, null, 2),
  [`Projects/${project.id}.json`]: JSON.stringify(project, null, 2),
  ...Object.fromEntries(records.map((d) => [`Documents/${d.id}.json`, JSON.stringify(d, null, 2)])),
  "library-quicknotes.json": Store("lockin-library-quicknotes", {
    folders: Object.fromEntries(Object.values(folders).map((f) => [f.id, f])),
    tags: Object.fromEntries(Object.values(tags).map((t) => [t.id, t])),
    notes: [
      { id: "n-1", group: "Today", heading: "Invite link", body: "Copy to clipboard the moment it is created — nobody looks for the copy button." },
      { id: "n-2", group: "Today", heading: "Demo clip", body: "40 seconds: drag a folder in, make an album, share it. No voice-over." },
      { id: "n-3", group: "Yesterday", heading: "Beta date", body: "One week later than planned, decided once, not moving again." },
    ],
    quickNotesSketch: [],
  }),
  "focus.json": Store("lockin-focus", board),
  "canvases.json": Store("lockin-canvases", { canvases: [canvas] }),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(fixture, null, 2));
console.log(`mock-fixture.json: ${Object.keys(fixture).length} souborů → ${OUT}`);
