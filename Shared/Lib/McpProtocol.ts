import type { FocusColumn } from "@lockin/shared/Store/UseFocusStore";

/**
 * Protokol mezi MCP serverem (Mcp/) a běžící desktopovou aplikací.
 *
 * Zápisy nejdou do souborů napřímo: aplikace drží data v paměti a při dalším
 * uložení by změnu zvenku přepsala. MCP proto položí příkaz do
 * `AppData/mcp/inbox/<id>.json`, aplikace ho provede svými vlastními akcemi
 * (stejně jako klik v To-do Home) a odpověď zapíše do `mcp/outbox/<id>.json`.
 * Každé ~2 s zapisuje `mcp/heartbeat.json`, podle něj MCP pozná, že běží.
 */
export const MCP_DIR = "mcp";
export const MCP_INBOX = `${MCP_DIR}/inbox`;
export const MCP_OUTBOX = `${MCP_DIR}/outbox`;
export const MCP_HEARTBEAT = `${MCP_DIR}/heartbeat.json`;
/** Heartbeat starší než tohle = aplikace neběží. */
export const MCP_HEARTBEAT_MAX_AGE_MS = 8000;

/** Kde list žije — `docId: null` = Quick Notes. */
interface ListTarget {
  docId: string | null;
  listId: string;
}

export type McpCommand =
  | ({ op: "complete_task"; taskId: string; done: boolean } & ListTarget)
  | ({ op: "add_task"; title: string; groupId?: string } & ListTarget)
  | ({ op: "rename_task"; taskId: string; title: string } & ListTarget)
  | ({ op: "send_to_board"; taskId: string; column: FocusColumn } & ListTarget)
  | { op: "board_complete"; boardTaskId: string; done: boolean }
  | { op: "board_move"; boardTaskId: string; column: FocusColumn };

export interface McpRequest {
  id: string;
  /** Workspace, nad kterým MCP četl — aplikace odmítne, když má otevřený jiný. */
  workspaceId: string;
  command: McpCommand;
}

export type McpResponse = { id: string; ok: true; result: unknown } | { id: string; ok: false; error: string };

export interface McpHeartbeat {
  workspaceId: string;
  at: number;
}
