"use client";

// Registrace platformy MUSÍ proběhnout tady, ne v layoutu: layout je server
// komponenta, takže by se side-effect vykonal na serveru a klientský bundle
// by ho nikdy nespustil. Tenhle import je první, aby platforma stála dřív,
// než se vyhodnotí moduly storů níž.
import "@/Platform/Register";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@lockin/shared/Components/AppShell/AppShell";
import { GetSessionUser, OnSessionChange, type SessionUser } from "@/Platform/Session";
import { MigrationPrompt } from "./MigrationPrompt";

/**
 * Obálka kolem sdíleného `AppShell`, která přidává webová specifika:
 *
 *  - přihlašovací stránky se renderují samostatně, bez sidebaru a topbaru
 *  - po přihlášení se nabídne přenos lokálních dat na účet
 *
 * Samotný `AppShell` zůstává netknutý a sdílený s desktopem.
 */

const BARE_ROUTES = ["/Login", "/Register"];

export function WebShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // localStorage se čte až po připojení — na serveru neexistuje a čtení
    // při renderu by rozhodilo hydrataci.
    setUser(GetSessionUser());
    setReady(true);
    return OnSessionChange(setUser);
  }, []);

  const isBare = BARE_ROUTES.some((route) => pathname.startsWith(route));

  if (isBare) {
    return <div className="flex min-h-screen flex-col bg-white">{children}</div>;
  }

  // Suspense kolem celého shellu je tu kvůli `Sidebar`, který volá
  // `useSearchParams()`. Bez hranice Next neprerenderuje `/_not-found` a build
  // spadne. Sidebar sám se nemění — hranice kdekoliv nad voláním stačí.
  return (
    <>
      <Suspense fallback={null}>
        <AppShell>{children}</AppShell>
      </Suspense>
      {ready && user ? <MigrationPrompt user={user} /> : null}
    </>
  );
}
