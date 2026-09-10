"use client";

// Registrace platformy MUSÍ proběhnout tady, ne v layoutu: layout je server
// komponenta, takže by se side-effect vykonal na serveru a klientský bundle
// by ho nikdy nespustil. Tenhle import je první, aby platforma stála dřív,
// než se vyhodnotí moduly storů níž.
import "@/Platform/Register";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@lockin/shared/Components/AppShell/AppShell";
import { GetSessionUser, OnSessionChange, type SessionUser } from "@/Platform/Session";
import { AccountMenu } from "./AccountMenu";
import { PassphraseGate } from "./PassphraseGate";
import { MigrationPrompt } from "./MigrationPrompt";

/**
 * Obálka kolem sdíleného `AppShell`, která přidává webová specifika:
 * vynucení přihlášení, účet v patě sidebaru a nabídku přenosu lokálních dat.
 *
 * Samotný `AppShell` zůstává netknutý a sdílený s desktopem.
 */

/**
 * Když je `true`, bez přihlášení se do aplikace nedostaneš — anonymní režim
 * je vypnutý.
 *
 * Anonymní větev (IndexedDB adaptéry, migrace dat na účet) zůstává v kódu
 * hotová a funkční; přepnutím téhle jediné konstanty na `false` se vrátí,
 * aniž by se muselo cokoliv jiného měnit. Rozhodnutí, ne technické omezení.
 */
const REQUIRE_LOGIN = true;

/** Stránky dostupné i bez přihlášení, renderované bez sidebaru a topbaru. */
const PUBLIC_ROUTES = [
  "/Login",
  "/Register",
  // Ověření krypto vrstvy — jen ve vývoji, v produkci se na ni nedostaneš.
  ...(process.env.NODE_ENV === "development" ? ["/CryptoCheck"] : []),
];

export function WebShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // localStorage se čte až po připojení — na serveru neexistuje a čtení
    // při renderu by rozhodilo hydrataci.
    setUser(GetSessionUser());
    setReady(true);
    return OnSessionChange(setUser);
  }, []);

  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  useEffect(() => {
    if (!ready) return;
    if (REQUIRE_LOGIN && !user && !isPublic) {
      router.replace("/Login");
      return;
    }
    // Přihlášený na přihlašovací stránce nemá co dělat — typicky sem doskočí
    // z historie prohlížeče nebo z uloženého odkazu.
    if (user && isPublic) {
      router.replace("/YourProjects");
    }
  }, [ready, user, isPublic, router]);

  if (isPublic) {
    return <div className="flex min-h-screen flex-col bg-white">{children}</div>;
  }

  // Než se přečte localStorage, není jisté, jestli je uživatel přihlášený —
  // vykreslit zatím aplikaci by znamenalo problesknutí obsahu, který za
  // chvíli stejně vystřídá přesměrování na login.
  if (!ready || (REQUIRE_LOGIN && !user)) {
    return <div className="flex min-h-screen flex-col bg-white" />;
  }

  // PassphraseGate stojí NAD AppShellem schválně: ten při připojení spustí
  // načítání dat, a to by bez odemčeného klíče stejně nešlo dešifrovat.
  return (
    <PassphraseGate>
      <AppShell sidebarFooter={<AccountMenu />}>{children}</AppShell>
      {user ? <MigrationPrompt user={user} /> : null}
    </PassphraseGate>
  );
}
