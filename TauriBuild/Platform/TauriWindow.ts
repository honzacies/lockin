import { availableMonitors, getCurrentWindow, LogicalSize, primaryMonitor, PhysicalPosition } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
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

const SESSION_LABEL = "session";
const SESSION_SIZE = { width: 340, height: 600 };
const SESSION_MINI_SIZE = { width: 320, height: 52 };
/** Odstup okna session od pravého horního rohu monitoru (logické px). */
const SESSION_MARGIN = 24;

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

  // Bez tohohle by po zavření hlavního okna zůstala session viset a aplikace
  // by běžela dál bez možnosti se k ní vrátit.
  Close: () =>
    SafeCall(async (win) => {
      if (win.label !== SESSION_LABEL) await (await WebviewWindow.getByLabel(SESSION_LABEL))?.close();
      await win.close();
    }, "close"),
  Minimize: () => SafeCall((win) => win.minimize(), "minimize"),
  ToggleMaximize: () => SafeCall((win) => win.toggleMaximize(), "toggleMaximize"),
  StartDragging: () => SafeCall((win) => win.startDragging(), "startDragging"),

  async ListMonitors() {
    try {
      const [monitors, primary] = await Promise.all([availableMonitors(), primaryMonitor()]);
      return monitors.map((m, i) => `Monitor ${i + 1}${m.name === primary?.name ? " (primary)" : ""}`);
    } catch {
      return [];
    }
  },

  async SetSessionMini(mini) {
    const { width, height } = mini ? SESSION_MINI_SIZE : SESSION_SIZE;
    await getCurrentWindow().setSize(new LogicalSize(width, height));
  },

  async OpenSessionWindow(monitorIndex) {
    const monitors = await availableMonitors();
    const monitor = monitors[monitorIndex] ?? monitors[0];
    // Pozice se nastavuje fyzicky až po vytvoření — logické souřadnice při
    // vytvoření se u monitorů s různým DPI přepočítávají špatným měřítkem.
    const place = async (win: WebviewWindow) => {
      if (!monitor) return;
      const { position, size } = monitor.workArea;
      const margin = Math.round(SESSION_MARGIN * monitor.scaleFactor);
      // Skutečná šířka okna — v mini režimu je užší než SESSION_SIZE.
      const { width } = await win.outerSize();
      await win.setPosition(new PhysicalPosition(position.x + size.width - width - margin, position.y + margin));
      await win.setFocus();
    };

    const existing = await WebviewWindow.getByLabel(SESSION_LABEL);
    if (existing) return place(existing);

    const win = new WebviewWindow(SESSION_LABEL, {
      url: "/Todo/Session",
      title: "Lockin session",
      ...SESSION_SIZE,
      alwaysOnTop: true,
      decorations: false,
      resizable: false,
      visible: false,
    });
    await win.once("tauri://error", (event) => console.warn("Session window failed", event.payload));
    await win.once("tauri://created", async () => {
      await place(win);
      await win.show();
    });
  },
};
