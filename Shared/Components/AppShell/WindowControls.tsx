"use client";

import { Minus, Square, X } from "lucide-react";
import { useWindowControls } from "./UseWindowControls";

/** Windows-style caption buttons (minimize / maximize-restore / close) for
 * the custom titlebar — pairs with `"decorations": false` in
 * src-tauri/tauri.conf.json. Drop this at the trailing edge of whatever row
 * acts as your titlebar.
 *
 * Renders nothing on the web build: there is no OS window to control there,
 * and leaving three dead buttons in the topbar would just be confusing. */
export function WindowControls() {
  const { isAvailable, isMaximized, Minimize, ToggleMaximize, Close } = useWindowControls();

  if (!isAvailable) return null;

  return (
    <div className="flex h-full items-stretch">
      <button
        type="button"
        onClick={Minimize}
        aria-label="Minimize"
        className="flex w-[46px] items-center justify-center text-[#8a8a8a] hover:bg-white/10 hover:text-white"
      >
        <Minus size={14} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={ToggleMaximize}
        aria-label={isMaximized ? "Restore" : "Maximize"}
        className="flex w-[46px] items-center justify-center text-[#8a8a8a] hover:bg-white/10 hover:text-white"
      >
        <Square size={12} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={Close}
        aria-label="Close"
        className="flex w-[46px] items-center justify-center text-[#8a8a8a] hover:bg-[#e81123] hover:text-white"
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
