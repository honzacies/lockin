// Ruční volání nástrojů MCP serveru z terminálu (stejná cesta jako AI klient):
//   bun Mcp/cli.ts lockin_next '{"limit": 5}'
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [tool = "lockin_overview", args = "{}"] = process.argv.slice(2);
const client = new Client({ name: "lockin-cli", version: "0" });
await client.connect(new StdioClientTransport({ command: "bun", args: [fileURLToPath(new URL("index.ts", import.meta.url))] }));
const result = (await client.callTool({ name: tool, arguments: JSON.parse(args) })) as { isError?: boolean; content: { text: string }[] };
console.log(result.content[0].text);
await client.close();
process.exit(result.isError ? 1 : 0);
