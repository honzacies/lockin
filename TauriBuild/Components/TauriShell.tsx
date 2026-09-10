"use client";

// Registrace platformy MUSÍ proběhnout tady, ne v layoutu: layout je server
// komponenta, takže by se side-effect vykonal na serveru a klientský bundle
// by ho nikdy nespustil (a všechno by pak padalo na „Platforma není
// zaregistrovaná"). Tenhle import je první, aby platforma stála dřív, než se
// vyhodnotí moduly storů níž.
import "@/Platform/Register";

import type { ReactNode } from "react";
import { AppShell } from "@lockin/shared/Components/AppShell/AppShell";

/** Tenká klientská obálka — jediný důvod její existence je import výše. */
export function TauriShell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
