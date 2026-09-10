"use client";

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface TauriWindowControls {
  /** Reflects the real OS window state — keep a maximize/restore icon in
   * sync with it instead of tracking your own toggle state. */
  isMaximized: boolean;
  Close: () => void;
  Minimize: () => void;
  /** Maximize if not maximized, restore if it is — matches the OS titlebar
   * button's own behavior. */
  ToggleMaximize: () => void;
  /** Wire to `onPointerDown` on whatever should act as the titlebar (the
   * custom topbar's background, not its buttons) — drags the window like a
   * native titlebar would. Ignores non-primary-button presses so it doesn't
   * eat right-click/middle-click. */
  StartDragging: (event: React.PointerEvent) => void;
}

/**
 * `getCurrentWindow()` itself can throw *synchronously* (not just the promise
 * chain after it) when there's no real Tauri bridge — it reads
 * `window.__TAURI_INTERNALS__.metadata` internally, which doesn't exist in a
 * plain browser tab. Every call site below goes through this so that case is
 * swallowed the same way as an async failure instead of crashing uncaught.
 */
function SafeWindowCall(
  action: (win: ReturnType<typeof getCurrentWindow>) => Promise<unknown>,
  label: string,
) {
  try {
    action(getCurrentWindow()).catch((error) =>
      console.warn(`Window ${label} failed (no Tauri bridge?)`, error),
    );
  } catch (error) {
    console.warn(`Window ${label} failed (no Tauri bridge?)`, error);
  }
}

/**
 * Custom-titlebar window controls for the Tauri shell — pairs with
 * `"decorations": false` in src-tauri/tauri.conf.json (which removes the
 * OS's native titlebar entirely, so these are the only way left to
 * close/minimize/maximize/drag the window).
 *
 * Every call is wrapped and swallows its own errors, same pattern as
 * Store/TauriStorage.ts — this hook also renders fine in a plain browser
 * tab (`bun run dev` with no Tauri bridge), it just becomes a no-op there
 * instead of throwing and tripping the Next.js dev error overlay.
 */
export function useTauriWindowControls(): TauriWindowControls {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let win: ReturnType<typeof getCurrentWindow>;
    try {
      win = getCurrentWindow();
    } catch {
      return; // no Tauri bridge — isMaximized stays false, harmless
    }
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    win
      .isMaximized()
      .then((value) => {
        if (!cancelled) setIsMaximized(value);
      })
      .catch(() => {
        // no Tauri bridge (plain browser tab) — stays false, harmless
      });

    win
      .onResized(() => {
        // Maximizing/restoring fires a resize event — this is the only
        // reliable way to notice an OS-level state change (e.g. a
        // double-click on the drag region, or a window-manager shortcut),
        // not just a click on our own button.
        win
          .isMaximized()
          .then((value) => {
            if (!cancelled) setIsMaximized(value);
          })
          .catch(() => {});
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  function Close() {
    SafeWindowCall((win) => win.close(), "close");
  }

  function Minimize() {
    SafeWindowCall((win) => win.minimize(), "minimize");
  }

  function ToggleMaximize() {
    SafeWindowCall((win) => win.toggleMaximize(), "toggleMaximize");
  }

  function StartDragging(event: React.PointerEvent) {
    if (event.button !== 0) return;
    SafeWindowCall((win) => win.startDragging(), "startDragging");
  }

  return { isMaximized, Close, Minimize, ToggleMaximize, StartDragging };
}
