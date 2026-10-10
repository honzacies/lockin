import type { JSONContent } from "@tiptap/core";
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
  | ({ op: "add_task"; title: string; groupId?: string; description?: string } & ListTarget)
  | ({ op: "rename_task"; taskId: string; title: string; description?: string } & ListTarget)
  | ({ op: "send_to_board"; taskId: string; column: FocusColumn } & ListTarget)
  | { op: "board_complete"; boardTaskId: string; done: boolean }
  | { op: "board_move"; boardTaskId: string; column: FocusColumn }
  | { op: "ignore_list"; listId: string; ignored: boolean }
  /** docId null = nový dokument. `json` je hotový Tiptap doc (MCP převádí z Markdownu). */
  | { op: "write_document"; docId: string | null; name?: string; folder?: string; json: JSONContent; mode: "replace" | "append" }
  /** Projekt = kořenový dokument se značkou {lockin.project}; `json` je jeho obsah. */
  | { op: "create_project"; name: string; folder?: string; json?: JSONContent }
  /** Metadata projektu. Posílají se jen pole, která se mají změnit; `priority`
   * a `status` už jsou přeložené na ID (MCP přijímá i popisek, viz index.ts). */
  | {
      op: "set_project";
      projectId: string;
      priority?: string;
      status?: string;
      tagIds?: string[];
      deadline?: string | null;
      progress?: number;
    }
  /** Úprava globálních voleb priorit a stavů (popisek, barva) — platí napříč projekty. */
  | { op: "set_option"; kind: "priority" | "status"; optionId: string; label?: string; color?: string }
  /** Nová sekce (skupina) v to-do listu. Má smysl jen u karty, ne u checkboxového listu. */
  | ({ op: "add_group"; title: string; icon?: string } & ListTarget)
  | ({ op: "delete_task"; taskId: string } & ListTarget)
  /** Sekce zmizí, její úkoly spadnou mezi nezařazené — mazání úkolů je zvlášť. */
  | ({ op: "delete_group"; groupId: string } & ListTarget)
  /** Přesun úkolu. Když je `to` jiný list, úkol se ze zdroje vyjme a vloží do cíle. */
  | { op: "move_task"; from: ListTarget; to: ListTarget; taskId: string; groupId?: string }
  /** Titulek a termín samotného listu (ne úkolu). */
  | ({ op: "set_list"; title?: string; deadline?: string | null; deadlineTime?: string | null } & ListTarget)
  /** Smaže dokument. Je-li to projekt, zmizí i projekt a jeho podřízené dokumenty. */
  | { op: "delete_document"; docId: string }
  /** Metadata dokumentu — posílají se jen pole, která se mají změnit. */
  | {
      op: "set_document";
      docId: string;
      name?: string;
      description?: string;
      icon?: string;
      folderId?: string | null;
      tagIds?: string[];
      isFavorite?: boolean;
      isLocked?: boolean;
    }
  | { op: "board_remove"; boardTaskId: string }
  /** Vyčistí sloupec boardu — hotové, nebo s `all` úplně vše i se skupinami. */
  | { op: "board_clear"; column: FocusColumn; all: boolean }
  /** Ovládání focus session: spustit, pauznout, odbavit aktuální, odložit aktuální. */
  | { op: "session"; action: "start" | "pause" | "complete" | "skip" }
  | { op: "add_option"; kind: "priority" | "status"; label: string; color?: string }
  | { op: "remove_option"; kind: "priority" | "status"; optionId: string };

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
