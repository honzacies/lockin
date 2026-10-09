import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { MarkdownToDoc } from "@lockin/shared/Lib/Markdown";
import {
  MCP_HEARTBEAT,
  MCP_HEARTBEAT_MAX_AGE_MS,
  MCP_INBOX,
  MCP_OUTBOX,
  type McpCommand,
  type McpHeartbeat,
  type McpResponse,
} from "@lockin/shared/Lib/McpProtocol";
import { AppDataDir, type Workspace } from "./Data";

type JSONContent = ReturnType<typeof MarkdownToDoc>;

const TIMEOUT_MS = 10000;

/** Běží LockIn a má otevřený tenhle workspace? */
export function AppStatus(workspace: Workspace): { running: boolean; workspaceMatches: boolean; openWorkspaceId?: string } {
  try {
    const beat = JSON.parse(readFileSync(join(AppDataDir(), MCP_HEARTBEAT), "utf8")) as McpHeartbeat;
    const running = Date.now() - beat.at < MCP_HEARTBEAT_MAX_AGE_MS;
    return { running, workspaceMatches: running && beat.workspaceId === workspace.id, openWorkspaceId: beat.workspaceId };
  } catch {
    return { running: false, workspaceMatches: false };
  }
}

const MEDIA_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

/**
 * Média s `src` (cesta k souboru na disku) zkopíruje do AppData/Media, kam je
 * ukládá i upload v aplikaci, a nahradí `src` za `path`. Soubory nejsou stav,
 * který aplikace drží v paměti, takže je MCP smí zapsat samo.
 */
export function ImportMedia(node: JSONContent): JSONContent {
  const content = node.content?.map(ImportMedia);
  if (node.type !== "media" || typeof node.attrs?.src !== "string") return content ? { ...node, content } : node;
  const { src, ...attrs } = node.attrs;
  const ext = extname(src).toLowerCase();
  if (!MEDIA_TYPES[ext]) throw new Error(`Unsupported media "${src}" — use ${Object.keys(MEDIA_TYPES).join(" ")}.`);
  if (!existsSync(src)) throw new Error(`Media file not found: ${src}`);
  const path = `Media/media-${Date.now()}-${randomUUID().slice(0, 6)}${ext}`;
  mkdirSync(join(AppDataDir(), "Media"), { recursive: true });
  copyFileSync(src, join(AppDataDir(), path));
  return { ...node, attrs: { ...attrs, path, mimeType: MEDIA_TYPES[ext] } };
}

/**
 * Pošle příkaz běžící aplikaci a počká na odpověď. Zapisuje jen aplikace —
 * kdyby MCP psal do souborů sám, aplikace by změnu při dalším uložení přepsala.
 */
export async function Send(workspace: Workspace, command: McpCommand): Promise<unknown> {
  const status = AppStatus(workspace);
  if (!status.running) throw new Error("LockIn desktop isn't running. Open it to make changes (reading works without it).");
  if (!status.workspaceMatches) {
    throw new Error(`LockIn has another workspace open. Switch to "${workspace.name}" in the sidebar first.`);
  }
  const dir = AppDataDir();
  mkdirSync(join(dir, MCP_INBOX), { recursive: true });
  const id = randomUUID();
  // Zápis přes .tmp + rename, aby aplikace nikdy nepřečetla napůl zapsaný soubor.
  const target = join(dir, MCP_INBOX, `${id}.json`);
  writeFileSync(`${target}.tmp`, JSON.stringify({ id, workspaceId: workspace.id, command }));
  renameSync(`${target}.tmp`, target);

  const reply = join(dir, MCP_OUTBOX, `${id}.json`);
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    if (existsSync(reply)) {
      try {
        const response = JSON.parse(readFileSync(reply, "utf8")) as McpResponse;
        rmSync(reply, { force: true });
        if (!response.ok) throw new Error(response.error);
        return response.result;
      } catch (error) {
        if (error instanceof SyntaxError) continue; // odpověď se ještě zapisuje
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  rmSync(target, { force: true });
  throw new Error("LockIn didn't respond in time — is it frozen or loading?");
}
