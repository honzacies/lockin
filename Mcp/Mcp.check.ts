// Spuštění: bun Mcp/Mcp.check.ts [--write]
// Spustí MCP server přes stdio a zavolá nástroje přesně jako AI klient.
// S --write navíc ověří zápis přes běžící aplikaci: odškrtne první otevřený
// úkol a vrátí ho zpět, přepne prioritu projektu a vrátí ji, přebarví volbu
// a vrátí barvu (LockIn musí běžet na stejném workspacu).
// Všechno, co --write zapíše, hned zase vrátí zpět — po doběhnutí je stav
// přesně takový, jaký byl před spuštěním.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "lockin-check", version: "0" });
await client.connect(new StdioClientTransport({ command: "bun", args: [fileURLToPath(new URL("index.ts", import.meta.url))] }));

async function Call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
}

const tools = (await client.listTools()).tools.map((t) => t.name);
const REQUIRED = [
  "lockin_overview", "lockin_next", "lockin_complete_task", "lockin_send_to_board",
  "lockin_options", "lockin_graph", "lockin_set_project", "lockin_set_option", "lockin_add_group",
  "lockin_canvases", "lockin_delete_task", "lockin_delete_group", "lockin_move_task", "lockin_set_list",
  "lockin_delete_document", "lockin_set_document", "lockin_board_remove", "lockin_board_clear",
  "lockin_session", "lockin_add_option", "lockin_remove_option",
];
const missing = REQUIRED.filter((t) => !tools.includes(t));
assert.equal(missing.length, 0, `tools registered (missing: ${missing.join(", ")})`);

const spaces = await Call("lockin_workspaces");
const overview = await Call("lockin_overview");
assert.ok(overview.totals.open + overview.totals.done > 0, "overview sees tasks");
const next = await Call("lockin_next", { limit: 3 });
assert.ok(next.length > 0 && next[0].why.length > 0 && next[0].ref.listId, "next ranks tasks with reasons and refs");
const tasks = await Call("lockin_tasks", { limit: 5 });
assert.ok(tasks.every((t: { done: boolean }) => !t.done), "tasks default to open");
await Call("lockin_board");
const doc = await Call("lockin_document", { document: next[0].document });
assert.ok(doc.markdown.length > 0, "document returns markdown");

// --- volby priorit a stavů ---------------------------------------------------
const options = await Call("lockin_options");
assert.ok(options.priorities.length > 0 && options.statuses.length > 0, "options lists priorities and statuses");
assert.ok(options.priorities.every((o: { id: string; label: string; color: string }) => o.id && o.label && /^#/.test(o.color)), "options carry id, label and color");

// --- graf --------------------------------------------------------------------
const graph = await Call("lockin_graph");
assert.equal(graph.nodes.length, graph.totals.notes, "graph totals match node count");
assert.equal(graph.edges.length, graph.totals.links, "graph totals match edge count");
assert.equal(graph.orphans.length, graph.totals.orphans, "orphan list matches its total");
assert.ok(graph.nodes.every((n: { path: string }) => !n.path.endsWith(".md")), "graph paths are clean (no .md)");
assert.ok(graph.edges.every((e: { from: string; to: string }) => e.from !== e.to), "no self-links");
const slim = await Call("lockin_graph", { includeEdges: false });
assert.ok(!slim.edges, "includeEdges:false drops the edge list");
assert.equal(slim.totals.notes, graph.totals.notes, "slim graph keeps totals");

console.log(`workspace: ${overview.workspace} · ${overview.totals.open} open / ${overview.totals.done} done · app running: ${spaces.app.running}`);
console.log(`next: ${next.map((n: { title: string; why: string[] }) => `${n.title} (${n.why.join("; ")})`).join(" | ")}`);
console.log(`graph: ${graph.totals.notes} notes · ${graph.totals.links} links · ${graph.totals.orphans} orphans · ${graph.totals.brokenLinks} broken links`);

if (process.argv.includes("--write")) {
  const target = next.find((n: { ref: { docId: string | null } }) => n.ref.docId) ?? next[0];
  const ticked = await Call("lockin_complete_task", { ...target.ref, done: true });
  const Find = (list: { tasks: { id: string; done: boolean }[]; groups: { tasks: { id: string; done: boolean }[] }[] }) =>
    [...list.tasks, ...list.groups.flatMap((g) => g.tasks)].find((t) => t.id === target.ref.taskId);
  assert.equal(Find(ticked)?.done, true, "task ticked through the app");
  const unticked = await Call("lockin_complete_task", { ...target.ref, done: false });
  assert.equal(Find(unticked)?.done, false, "task unticked again");
  console.log(`write round-trip ok on "${target.title}" (${target.document})`);
}

// --- canvas ------------------------------------------------------------------
const canvases = await Call("lockin_canvases");
assert.ok(Array.isArray(canvases), "canvases returns a list");
for (const c of canvases) {
  assert.equal(c.cards.length, c.totals.cards, `canvas "${c.name}" totals match its cards`);
  assert.equal(c.links.length, c.totals.links, `canvas "${c.name}" totals match its links`);
}

console.log(`canvases: ${canvases.length} (${canvases.reduce((n: number, c: { totals: { cards: number } }) => n + c.totals.cards, 0)} cards)`);

// --- překlad popisku na ID (tohle dřív selhávalo) ----------------------------
// Běží v MCP serveru před odesláním do aplikace, takže se dá ověřit i bez ní.
async function Fails(name: string, args: Record<string, unknown>) {
  const result = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  assert.ok(result.isError, `${name} should reject ${JSON.stringify(args)}`);
  return result.content[0].text;
}
const badPriority = await Fails("lockin_set_project", { project: "lockin", priority: "Urgentissimo" });
assert.match(badPriority, /Unknown priority/i, "unknown priority is rejected by the server");
assert.ok(options.priorities.every((o: { label: string }) => badPriority.includes(o.label)), "the error lists what is allowed");
const badProject = await Fails("lockin_set_project", { project: "neexistuje-xyz", priority: "High" });
assert.match(badProject, /not found/i, "unknown project is rejected");
assert.match(await Fails("lockin_set_option", { kind: "status", option: "nope" }), /Unknown status/i, "unknown status is rejected");
assert.match(await Fails("lockin_delete_document", { document: "rozhodne-neexistuje-xyz" }), /not found/i, "deleting a missing document is rejected");
assert.match(await Fails("lockin_set_document", { document: "rozhodne-neexistuje-xyz", icon: "x" }), /not found/i, "metadata on a missing document is rejected");
assert.match(await Fails("lockin_remove_option", { kind: "priority", option: "nope" }), /Unknown priority/i, "removing a missing option is rejected");

if (process.argv.includes("--write")) {
  // --- priorita projektu: nastavit popiskem, ověřit, vrátit ---
  const project = overview.projects.find((p: { name: string }) => p.name && p.name !== "(Other documents)");
  if (project) {
    const before = options.priorities.find((o: { label: string }) => o.label === project.priority) ?? options.priorities[0];
    const other = options.priorities.find((o: { id: string }) => o.id !== before.id) ?? before;
    // Schválně popiskem ("High"), ne ID — tohle dřív nešlo.
    const changed = await Call("lockin_set_project", { project: project.name, priority: other.label });
    assert.equal(changed.priority, other.id, "priority set by label resolves to its id");
    await Call("lockin_set_project", { project: project.name, priority: before.label });
    console.log(`project round-trip ok on "${project.name}" (${before.label} → ${other.label} → ${before.label})`);
  }

  // --- barva volby: přebarvit a vrátit ---
  const target = options.priorities[options.priorities.length - 1];
  const recolored = await Call("lockin_set_option", { kind: "priority", option: target.label, color: "#123456" });
  assert.equal(recolored.color, "#123456", "option color changed");
  await Call("lockin_set_option", { kind: "priority", option: target.id, color: target.color });
  console.log(`option round-trip ok on "${target.label}" (color restored to ${target.color})`);

  // --- sekce, úkol s popisem a přesun: založit, ověřit, uklidit ---
  // Jede jen nad to-do kartou — checkbox list sekce ani popisy nemá.
  const card = tasks.find((t: { ref: { docId: string | null; taskId: string } }) => t.ref.docId && /^task-|^g\d/.test(t.ref.taskId));
  if (card) {
    const stamp = new Date().toISOString().slice(11, 19);
    const ref = { docId: card.ref.docId, listId: card.ref.listId };

    const withGroup = await Call("lockin_add_group", { ...ref, title: `Check ${stamp}`, icon: "🧪" });
    const group = withGroup.groups?.find((g: { title: string }) => g.title === `Check ${stamp}`);
    assert.ok(group, "group created");

    const withTask = await Call("lockin_add_task", { ...ref, title: `Check task ${stamp}`, groupId: group.id, description: "popis z checku" });
    const made = withTask.groups.find((g: { id: string }) => g.id === group.id).tasks.find((t: { title: string }) => t.title === `Check task ${stamp}`);
    assert.ok(made, "task created inside the group");
    assert.equal(made.description, "popis z checku", "description stored");

    const moved = await Call("lockin_move_task", { ...ref, taskId: made.id });
    assert.ok(moved.tasks.some((t: { id: string }) => t.id === made.id), "task moved out of the group");

    await Call("lockin_delete_task", { ...ref, taskId: made.id });
    const cleaned = await Call("lockin_delete_group", { ...ref, groupId: group.id });
    assert.ok(!cleaned.groups?.some((g: { id: string }) => g.id === group.id), "group removed");
    assert.ok(!cleaned.tasks.some((t: { id: string }) => t.id === made.id), "task removed");
    console.log(`group + task + move + delete round-trip ok on "${cleaned.title}"`);
  }
}

await client.close();
console.log("MCP ok");
