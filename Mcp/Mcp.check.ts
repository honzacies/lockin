// Spuštění: bun Mcp/Mcp.check.ts [--write]
// Spustí MCP server přes stdio a zavolá nástroje přesně jako AI klient.
// S --write navíc ověří zápis přes běžící aplikaci: odškrtne první otevřený
// úkol a hned ho vrátí zpět (LockIn musí běžet na stejném workspacu).
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
assert.ok(["lockin_overview", "lockin_next", "lockin_complete_task", "lockin_send_to_board"].every((t) => tools.includes(t)), "tools registered");

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

console.log(`workspace: ${overview.workspace} · ${overview.totals.open} open / ${overview.totals.done} done · app running: ${spaces.app.running}`);
console.log(`next: ${next.map((n: { title: string; why: string[] }) => `${n.title} (${n.why.join("; ")})`).join(" | ")}`);

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

await client.close();
console.log("MCP ok");
