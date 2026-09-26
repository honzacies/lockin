"use client";

// Registrace platformy MUSÍ proběhnout tady, ne v layoutu: layout je server
// komponenta, takže by se side-effect vykonal na serveru a klientský bundle
// by ho nikdy nespustil (a všechno by pak padalo na „Platforma není
// zaregistrovaná"). Tenhle import je první, aby platforma stála dřív, než se
// vyhodnotí moduly storů níž.
import "@/Platform/Register";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@lockin/shared/Components/AppShell/AppShell";
import { StartFocusSync } from "@/Platform/FocusSync";
import { StartMcpBridge } from "@/Platform/McpBridge";

/** Tenká klientská obálka kolem AppShell. Okno focus session (/Todo/Session)
 * je samostatné malé okno — bez sidebaru, topbaru a bez bootstrapu dat. */
export function TauriShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    StartFocusSync();
    StartMcpBridge();
    // Nativní menu WebView („Save image as", „Inspect") v desktopové appce nedává
    // smysl — zůstává jen v textových polích a nad označeným textem (kopírovat/vložit).
    function OnContextMenu(e: MouseEvent) {
      const editable = e.target instanceof Element && e.target.closest("input, textarea, [contenteditable=true]");
      if (!editable && !window.getSelection()?.toString()) e.preventDefault();
    }
    document.addEventListener("contextmenu", OnContextMenu);
    return () => document.removeEventListener("contextmenu", OnContextMenu);
  }, []);
  if (pathname?.startsWith("/Todo/Session")) return children;
  return <AppShell>{children}</AppShell>;
}
