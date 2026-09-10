import { RegisterPlatform } from "@lockin/shared/Platform/Platform";
import { TauriDataStorage } from "./TauriDataStorage";
import { TauriMedia } from "./TauriMedia";
import { TauriKeyValue } from "./TauriKeyValue";
import { TauriWindow } from "./TauriWindow";

/**
 * Registrace platformy jako vedlejší efekt importu. Root layout tenhle modul
 * importuje jako první, takže je hotová dřív, než se cokoliv vykreslí nebo
 * než si nějaký store sáhne na úložiště.
 */
RegisterPlatform({
  name: "tauri",
  data: TauriDataStorage,
  media: TauriMedia,
  kv: TauriKeyValue,
  window: TauriWindow,
});
