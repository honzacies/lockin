import { getCurrentWindow } from "@tauri-apps/api/window";
import type { WindowAdapter } from "@lockin/shared/Platform/Types";

/**
 * `WindowAdapter` nad Tauri okenním API — patří k `"decorations": false`
 * v src-tauri/tauri.conf.json, které odstraní nativní titulkový pruh, takže
 * tohle je jediná cesta, jak okno zavřít, minimalizovat, maximalizovat nebo
 * s ním táhnout.
 *
 * `getCurrentWindow()` umí spadnout **synchronně** (ne až v promise chainu),
 * když chybí Tauri bridge — čte si vnitřně `window.__TAURI_INTERNALS__.metadata`,
 * což v obyčejné záložce prohlížeče neexistuje. Proto jde všechno přes
 * SafeCall, aby se ten případ spolkl stejně jako asynchronní selhání a
 * neshodil to nezachycenou výjimkou Next dev overlay (ten pak blokuje všechny
 * kliky na stránce, i když se fakticky nic nerozbilo).
 */
function SafeCall(action: (win: ReturnType<typeof getCurrentWindow>) => Promise<unknown>, label: string): void {
  try {
    action(getCurrentWindow()).catch((error) =>
      console.warn(`Window ${label} selhal`, error),
    );
  } catch (error) {
    console.warn(`Window ${label} selhal`, error);
  }
}

export const TauriWindow: WindowAdapter = {
  isAvailable: true,

  async IsMaximized() {
    try {
      return await getCurrentWindow().isMaximized();
    } catch {
      return false;
    }
  },

  async OnResized(callback) {
    try {
      return await getCurrentWindow().onResized(() => callback());
    } catch {
      return () => {};
    }
  },

  Close: () => SafeCall((win) => win.close(), "close"),
  Minimize: () => SafeCall((win) => win.minimize(), "minimize"),
  ToggleMaximize: () => SafeCall((win) => win.toggleMaximize(), "toggleMaximize"),
  StartDragging: () => SafeCall((win) => win.startDragging(), "startDragging"),
};
