# Lockin

## 1. Co to je

Lokální desktopová appka (Notion-like) pro projekty, dokumenty, poznámky a náčrtky — všechno v jednom, offline, data na disku uživatele.

## 2. Stack

- **Frontend:** Next.js **16.2.12** (App Router), React 19.2.4, TypeScript 5, Tailwind **v4**, HeroUI **v3**
- **Editor:** Tiptap 3 (+ table, task-list, text-align, text-style, placeholder, suggestion)
- **State:** Zustand 5 (`persist` middleware)
- **Shell:** **Tauri 2.11** (Rust), pluginy `fs`, `store`, `log`
- **DB:** žádná — JSON soubory v `AppData` (`Projects/`, `Documents/`, `Media/`, `Manifest.json`)
- **Hosting:** žádný — čistě desktop, žádný backend, žádné API routes
- **Package manager:** bun (`bun.lock`)
- ⚠️ **Změna oproti default Next.js očekávání:** `output: "export"` — Next je jen statický build servírovaný z Tauri. Žádné server components, žádné API routes, žádné dynamické `[id]` segmenty.
- ⚠️ `AGENTS.md` explicitně varuje: Next 16 se liší od trénovacích dat, číst `node_modules/next/dist/docs/`.

## 3. Hotové a funkční

- Routes: `/YourProjects`, `/YourProjects/Project?id=`, `/Library`, `/QuickNotes`, `/Document?id=`
- **Blokový editor** s vlastními Tiptap extensions: slash-command menu, marquee selection + drag-and-drop bloků, media (obrázky/video + crop modal), YouTube embed, tabulky, to-do listy, color palette, scenario, spoiler, markdown paste, image paste
- **Per-block styling** (`BlockStyle` / `StyleVars.ts`) — font, barva, velikost, tloušťka; „apply to all future documents"
- **Per-document theme** (background/foreground + `adaptBlocks` filtr)
- **Sketch mode** (canvas, lazy-loaded) v dokumentech i Quick Notes
- **Library**: folders, tags (s barvami), favorites, recents, filtrování, side-panel preview
- **Persistence**: atomický zápis (`.tmp` + rename), serializovaná fronta zápisů manifestu, rebuild manifestu při startu, sweep osiřelých médií
- **Vlastní okenní chrome** (`decorations: false`) + WindowControls, TabStrip s drag-reorder
- **Sidebar** s reorderem a skrýváním nav položek/sekcí
- Skeleton stavy pro hydrataci (`hydrated` flag)

## 4. Rozdělané

- **Search v sidebaru** — `Components/AppShell/Sidebar.tsx:571` je zatím holá `<Search size={18} />` ikona, žádný button, žádný handler. **Potvrzeno: má se implementovat.**
- **`showTableOfContents`** — přepínač v settings menu existuje, ale nic to nečte (v `Types/Project.ts` označeno jako reserved). **Potvrzeno: dodělá se.**
- `sizeLabel: "20 KB"` u dokumentů v Library — natvrdo v `app/Library/page.tsx:98`, nepočítá se
- `ScenarioView` a `ColorPaletteView` existují jen jako editor node views — na stránce Quick Notes nejsou (tam je jen TodoList + NotesList)
- `Project.progress` se nastavuje **jen ručně** slidem v ProjectHeader, nederivuje se z to-do listů

## 5. Na čem to vázne

- **Projekt teď není v gitu.** `.git` neexistuje — žádná historie, žádný backup, žádný rollback, žádný diff. Cokoliv se rozbije, není kam se vrátit.
- **`node_modules/` chybí** — nic není nainstalováno, `bun install` nikdy neproběhl na tomhle stroji
- **Rust ani MSVC Build Tools nejsou nainstalované** → `tauri:dev` / `tauri:build` nejde spustit. Bez Tauri bridge neběží *žádná* persistence (fs plugin, store plugin) — v prohlížeči přes `bun run dev` appka jen tiše warnuje do konzole
- **Projekt se přestěhoval z `E:\` na `D:\`** — `.claude/settings.local.json` má pořád cesty s `E--Projects-lockin`
- **`.claude/launch.json` má natvrdo `C:\Users\honza\.bun\bin\bun.exe`** — aktuální uživatel je `Honza Cieslar`, cesta neexistuje → preview server se nespustí

## 6. Nejbližší kroky

1. `git init` + první commit — dřív než cokoliv jiného, projekt je momentálně bez jakékoliv záchranné sítě
2. `bun install`, pak doinstalovat Rust (rustup) + VS C++ Build Tools a ověřit `bun run tauri:dev` — teprve pak jde testovat persistenci
3. Opravit `.claude/launch.json` (relativní `bun` místo absolutní cesty) a `settings.local.json` (E: → D:)

Potvrzený feature backlog hned za tím: **Search v sidebaru** a **dodělání `showTableOfContents`**.

## 7. Netriviální architektonická rozhodnutí

- **Statický export místo Next serveru** — `output: "export"`, Tauri servíruje `out/`. Proto se používá `/Document?id=xxx` a `/YourProjects/Project?id=xxx` (query params) místo dynamických `[id]` routes — ty by static export nezvládl. Každá stránka je `"use client"` + obalená v `<Suspense>` kvůli `useSearchParams`.
- **Dvouúrovňová persistence, záměrně nekonzistentní:** projekty a dokumenty = jeden JSON soubor na entitu + `Manifest.json` jako index; folders/tags/notes/sketch = jeden blob přes zustand `persist` do Tauri store. Důvod je v komentáři v `UseDataStore.ts` — malé kolekce nepotřebují vlastní soubory ani manifest.
- **Manifest je odvozená cache, ne zdroj pravdy** — `RebuildManifest()` se volá při **každém** startu ještě před tím, než se manifestu věří. Self-healing po crashi nebo ručním zásahu do souborů.
- **Serializovaná fronta zápisů manifestu** (`QueueManifestWrite`) — bez ní vytvoření projektu (SaveProject + SaveDocument hned po sobě) závodilo o sdílený `Manifest.json.tmp` a padalo na „rename .tmp: file not found".
- **Média jako soubory, ne base64** — v dokumentu je jen relativní cesta, URL se resolvuje až při renderu (`convertFileSrc`), protože absolutní AppData cesta se liší per stroj. Bez toho by se celý obrázek re-serializoval při každém autosave.
- **Úklid médií jen při startu, ne při smazání bloku** — `SweepOrphanedMedia` běží až po načtení *všech* dokumentů, protože dřív nelze bezpečně říct, že soubor nikdo nereferencuje.
- **Root dokument JE projekt** — `Project.rootDocumentId`; jméno se obousměrně synchronizuje a root dokument se filtruje pryč z Library řádků, aby nebyl duplicitní.
- **`skipHydration: true` na všech storech** + ruční `persist.rehydrate()` v `AppShell` — Tauri storage je async a v prohlížeči vůbec neexistuje.
- **`TauriStorage` polyká všechny chyby** — jinak by chybějící `__TAURI__` bridge vyhodil unhandled rejection, ten spustí Next dev overlay a ten zablokuje všechny kliky na stránce.
- **HeroUI v3 všude**, s vědomými výjimkami kde je custom interakce (slash menu, ContextMenu, `BlockSelectionExtension` DOM mimo React, ColorPicker `<input type=range>`, file input, contentEditable) — viz `DESIGN.md`.
- **Vlastní kompaktní menu systém** (`ContextMenu` + slash menu) místo HeroUI Menu/Dropdown — grouped s uppercase labely, ikona+text, `w-52`, hover state na wrapperu.
- **PascalCase konvence** — složky (`Components/`, `Lib/`, `Store/`, `Types/`) i funkce (`SaveProject`, `HandleOpenRow`, `UseDataStore`). Není to `src/` + camelCase, jak by čekal default Next.

## 8. Známé problémy / gotchas

- **Data žijí v AppData, ne v repu.** Smazání AppData = ztráta všeho. Není žádný export/backup.
- **Bez Tauri (`bun run dev` v prohlížeči) se nic neuloží** — appka vypadá funkčně, ale všechny zápisy jen warnují do konzole. Testovat persistenci jen přes `tauri:dev`.
- **`SweepOrphanedMedia` je destruktivní** — smaže cokoliv v `Media/`, co po načtení dokumentů nikdo nereferencuje. Kdyby se načtení dokumentů částečně nepovedlo, sebere to i živá média. `RebuildManifest` to zmírňuje, ale nepokrývá to.
- **ID jsou `Date.now()`-based** (`proj-${Date.now()}`, `doc-${Date.now()}`) — dvě entity vytvořené ve stejné milisekundě dostanou stejné ID.
- **HeroUI `Button` nebere `title`** — používat `aria-label`.
- **Nikdy nevnořovat `<button>` do `<button>`** — HeroUI/react-aria renderuje pravé `<button>`, vnoření tiše rozbije click handling. Řešit sourozenci ve společném wrapperu.
- **HeroUI CSS layering:** `className` overrides **vyhrávají** nad HeroUI defaulty (HeroUI je v `components` vrstvě, Tailwind utilities v `utilities`, deklarované později). `DESIGN.md` upozorňuje, že dřívější poznámka tvrdila opak a byla stale.
- **App Router drží stejnou instanci stránky napříč same-route navigací** — proto `ProjectPageContent` řeší `docParam` přes ref, jinak klik na sub-dokument v sidebaru tiše nic neudělal.
- **`data-tauri-drag-region` nesmí být na předkovi draggable tabů** — jinak Chromium ukazuje permanentní „not-allowed" kurzor nad taby. Proto je tag na samostatném spaceru vedle `TabStrip`, ne na wrapperu.
- `out/` a `.next/` jsou staré buildy (2. a 24. srpna) — v `.gitignore` jsou, ale při `git init` je nekomitovat.
- `tsconfig.tsbuildinfo` (318 KB) leží v rootu, i když je gitignorovaný.
