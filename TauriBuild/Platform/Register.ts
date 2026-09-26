import { RegisterPlatform } from "@lockin/shared/Platform/Platform";
import type { KeyValueAdapter } from "@lockin/shared/Platform/Types";
import { ActiveWorkspace, ListWorkspaces } from "@lockin/shared/Lib/Workspace";
import { TauriDataStorage } from "./TauriDataStorage";
import { TauriMedia } from "./TauriMedia";
import { TauriKeyValue } from "./TauriKeyValue";
import { TauriWindow } from "./TauriWindow";
import { CreateVaultStorage } from "./VaultStorage";

/**
 * Registrace platformy jako vedlejší efekt importu. Root layout tenhle modul
 * importuje jako první, takže je hotová dřív, než se cokoliv vykreslí nebo
 * než si nějaký store sáhne na úložiště.
 *
 * Složkový workspace: data jdou z .md souborů a drobné kolekce (složky, tagy,
 * sidebar, UI) do vlastních souborů `ws-<id>-*.json`, aby se nemíchaly
 * s výchozím in-app workspacem.
 */
const workspace = ActiveWorkspace();

const kv: KeyValueAdapter = workspace.path
  ? {
      GetItem: (store, key) => TauriKeyValue.GetItem(`${workspace.id}-${store}`, key),
      SetItem: (store, key, value) => TauriKeyValue.SetItem(`${workspace.id}-${store}`, key, value),
      RemoveItem: (store, key) => TauriKeyValue.RemoveItem(`${workspace.id}-${store}`, key),
    }
  : TauriKeyValue;

// Seznam workspaců žije v localStorage okna, kam MCP server (Mcp/) nevidí —
// zrcadlí se proto při každém startu do AppData/workspaces.json.
TauriKeyValue.SetItem("workspaces.json", "state", JSON.stringify({ active: workspace.id, list: ListWorkspaces() })).catch(
  (error: unknown) => console.warn("Workspace mirror failed", error),
);

RegisterPlatform({
  name: "tauri",
  data: workspace.path ? CreateVaultStorage(workspace.path, kv) : TauriDataStorage,
  // Úklid médií vidí jen dokumenty aktivního workspacu — ve vaultu by smazal
  // obrázky in-app dokumentů, proto tam neběží.
  media: workspace.path ? { ...TauriMedia, SweepOrphaned: async () => {} } : TauriMedia,
  kv,
  window: TauriWindow,
});
