# LockIn MCP — příručka pro AI agenty

Tahle složka je MCP server nad LockInem: workspace Honzy Cieslara pro projekty,
dokumenty, poznámky a to-do listy. Server má **31 nástrojů** — devět na čtení,
dvacet dva na zápis.

Registrace do Claude Code:

```bash
claude mcp add lockin -- bun D:/Projects/lockin/Mcp/index.ts
```

---

## 1. Jak to funguje

```
          čtení                              zápis
   ┌──────────────────┐            ┌────────────────────────┐
   │  MCP server      │            │  MCP server            │
   │  čte soubory     │            │  položí příkaz do      │
   │  z disku přímo   │            │  AppData/mcp/inbox/    │
   └──────────────────┘            └───────────┬────────────┘
                                               │ ~1 s poll
                                   ┌───────────▼────────────┐
                                   │  běžící LockIn         │
                                   │  provede ho svými      │
                                   │  akcemi a odpoví do    │
                                   │  AppData/mcp/outbox/   │
                                   └────────────────────────┘
```

**Čtení jde vždycky.** Server si načte vault (`.md` soubory) nebo AppData kolekce
sám. LockIn běžet nemusí.

**Zápis vyžaduje běžící LockIn** na stejném workspacu. Důvod: aplikace drží data
v paměti a při dalším uložení by změnu zvenku přepsala. Proto se zápisy posílají
jí a ona je provede stejnými akcemi jako klik v UI.

Co z toho plyne pro tebe:

- Zápis selže hláškou `LockIn desktop isn't running` → aplikace neběží. Řekni to
  uživateli, nezkoušej to obcházet.
- `LockIn has another workspace open` → má otevřený jiný workspace. Musí přepnout
  v sidebaru, nebo pošli `workspace` ten, který má otevřený.
- `LockIn didn't respond in time` → limit je 10 s. Aplikace je zamrzlá nebo se načítá.
- `Unknown command "…" — this LockIn build is older than the MCP server` → server
  umí příkaz, který běžící build ještě nezná. **Uživatel musí restartovat LockIn.**

Stav zjistíš přes `lockin_workspaces` — vrací `app.running` i `app.workspaceMatches`.
**Než začneš zapisovat, zavolej ho.**

---

## 2. Konvence `ref`

Zapisovací nástroje nad to-do listy berou trojici z libovolného čtecího nástroje:

```json
{ "docId": "md:projects/lockin.md", "listId": "todo-lockin", "taskId": "g2t0" }
```

- `docId` — dokument, ve kterém list žije. **`null` znamená Quick Notes.**
- `listId` — list uvnitř dokumentu.
- `taskId` — konkrétní úkol.

`ref` nikdy neskládej ručně. Vezmi ho z `lockin_tasks`, `lockin_next` nebo
`lockin_overview`.

### Dva druhy listů — chovají se jinak

| | **To-do karta** (`{lockin.todolist …}`) | **Checkbox list** (`- [ ] …`) |
|---|---|---|
| Sekce (skupiny) | ano | **ne** |
| Popis úkolu | ano | **ne** |
| Titulek a termín listu | ano | **ne** |
| `taskId` | stabilní (`task-1790…`) | **je to text úkolu** |

Poslední řádek je past: u checkbox listu je ID úkolu jeho vlastní text. Jakmile
úkol přejmenuješ, **jeho `ref` přestane platit**. Po přejmenování si list načti znovu.

Nástroje, které na checkbox listu nedávají smysl (`add_group`, `delete_group`,
`move_task` do sekce, `set_list`), vrátí srozumitelnou chybu, ne tiché nic.

---

## 3. Typické postupy

### „Co mám dělat?"

```
lockin_next { limit: 5 }        → seřazený výběr, každý s odůvodněním (why) a ref
lockin_document { document }    → kontext kolem úkolu
…práce…
lockin_complete_task { ...ref } → odškrtnutí
```

`lockin_next` váží board (Today > This week > Backlog), termíny listu i projektu,
prioritu a stav projektu a úkoly, které dokončí skoro hotový list.

### Naplánovat den

```
lockin_board                                  → co už na boardu je
lockin_send_to_board { ...ref, column }       → přidat úkol
lockin_session { action: "start" }            → spustit časovač
lockin_session { action: "complete" }         → odbavit aktuální, časovač jede dál
lockin_board_clear { column, all: false }     → uklidit hotové
```

### Založit projekt

Projekt ve vaultu = dokument se značkou `{lockin.project}`.

```
lockin_write_document { name: "Nový projekt", markdown: "{lockin.project}\n\n# Nový projekt\n\n…" }
lockin_set_project { project: "Nový projekt", priority: "High", status: "In Progress" }
```

### Audit vaultu (LintMyBrain)

```
lockin_graph { includeEdges: false }   → totals, orphans, brokenLinks — bez 500 hran
lockin_graph                           → navíc nodes a edges
```

`orphans` = poznámky, na které nikdo neodkazuje a samy nikam neodkazují.
`brokenLinks` = `[[odkazy]]` mířící na neexistující poznámku.

---

## 4. Nástroje na čtení

Fungují i bez běžící aplikace. `workspace` je všude volitelný — bez něj se použije
ten, který je v LockInu otevřený.

| Nástroj | Parametry | Co vrátí |
|---|---|---|
| `lockin_workspaces` | — | Seznam workspaců, který je aktivní, a **jestli aplikace běží** |
| `lockin_overview` | `workspace` | Souhrn jako To-do Home: celkové počty, board, projekty a jejich listy |
| `lockin_board` | `workspace` | Board v pořadí Today / This week / Backlog + aktuální úkol a běžící session |
| `lockin_tasks` | `workspace` `project` `query` `status` `limit` | Hledání úkolů napříč listy. Každý má `ref` a `description` |
| `lockin_next` | `workspace` `limit` | Seřazený výběr co dělat, s odůvodněním |
| `lockin_document` | `document`* `workspace` | Dokument jako Markdown (ve vaultu přesný soubor i s frontmatterem) |
| `lockin_options` | `workspace` | Volby priorit a stavů i s barvami |
| `lockin_graph` | `workspace` `includeEdges` | Graf poznámek jako data: uzly, hrany, osiřelé, rozbité odkazy |
| `lockin_canvases` | `workspace` `name` | Nástěnky: karty, na jaké dokumenty ukazují, spojnice |

`status` nabývá `open` (výchozí) / `done` / `all`. `limit` u `lockin_tasks`
výchozí 50, u `lockin_next` 5.

**`lockin_overview` nevrací jednotlivé úkoly, jen počty.** Popisy úkolů najdeš
v `lockin_tasks` a `lockin_next`.

---

## 5. Nástroje na zápis

Všechny vyžadují běžící LockIn na stejném workspacu.

### Úkoly

| Nástroj | Povinné | Volitelné | Co dělá |
|---|---|---|---|
| `lockin_complete_task` | `docId` `listId` `taskId` | `done` | Odškrtne (nebo s `done:false` vrátí zpět) |
| `lockin_add_task` | `docId` `listId` `title` | `groupId` `description` | Přidá úkol, volitelně do sekce |
| `lockin_rename_task` | `docId` `listId` `taskId` `title` | `description` | Změní titulek a/nebo popis |
| `lockin_delete_task` | `docId` `listId` `taskId` | — | **Smaže natrvalo.** Bez undo |
| `lockin_move_task` | `docId` `listId` `taskId` | `toDocId` `toListId` `groupId` | Přesune do jiné sekce nebo jiného listu |

`lockin_move_task` bez `toDocId`/`toListId` přesouvá uvnitř stejného listu.
Bez `groupId` skončí úkol mezi nezařazenými.

### Listy a sekce

| Nástroj | Povinné | Volitelné | Co dělá |
|---|---|---|---|
| `lockin_add_group` | `docId` `listId` `title` | `icon` | Nová sekce (jen to-do karta) |
| `lockin_delete_group` | `docId` `listId` `groupId` | — | Smaže sekci. **Úkoly v ní zůstanou** — spadnou mezi nezařazené |
| `lockin_set_list` | `docId` `listId` | `title` `deadline` `deadlineTime` | Titulek a termín listu (jen to-do karta) |
| `lockin_ignore_list` | `listId` | `ignored` | Přestane list počítat jako úkoly (opakovaný checklist v návodu) |

`deadline` je `"YYYY-MM-DD"`, `deadlineTime` `"HH:mm"`; `null` je smaže.

### Board a session

| Nástroj | Povinné | Volitelné | Co dělá |
|---|---|---|---|
| `lockin_send_to_board` | `docId` `listId` `taskId` `column` | — | Naplánuje úkol z listu na board |
| `lockin_board_complete` | `boardTaskId` | `done` | Odškrtne kartu na boardu |
| `lockin_board_move` | `boardTaskId` `column` | — | Přesune kartu do jiného sloupce |
| `lockin_board_remove` | `boardTaskId` | — | Sundá kartu z boardu. **Úkol v listu zůstane** |
| `lockin_board_clear` | `column` | `all` | Uklidí hotové, s `all:true` celý sloupec i se sekcemi |
| `lockin_session` | `action` | — | `start` / `pause` / `complete` / `skip` |

`column` je `today` / `week` / `backlog`. `boardTaskId` se bere z `lockin_board`,
**není to stejné ID jako `taskId` v listu.**

### Dokumenty a projekty

| Nástroj | Povinné | Volitelné | Co dělá |
|---|---|---|---|
| `lockin_write_document` | `markdown` | `document` `name` `mode` | Založí dokument, nebo přepíše/doplní existující |
| `lockin_set_document` | `document` | `name` `description` `icon` `folderId` `tagIds` `tags` `isFavorite` `isLocked` | Metadata dokumentu |
| `lockin_delete_document` | `document` | — | **Smaže natrvalo.** Ve vaultu smaže `.md` soubor |
| `lockin_set_project` | `project` | `priority` `status` `tagIds` `tags` `deadline` `progress` `icon` | Metadata projektu |

`document` i `project` přijímají ID, cestu (`projects/lockin`) i název.
`mode` je `replace` (výchozí) nebo `append`. `tags` jsou názvy štítků — přidají
se k existujícím a chybějící se založí. `icon` bere emoji, `lucide:<název>`,
`material:<název>` nebo `data:` URL obrázku.

**`lockin_delete_document` u projektu smaže i projekt a jeho podřízené dokumenty.**
Je to nevratné. Dělej to jen když o to uživatel výslovně požádal.

### Priority a stavy

Platí globálně napříč všemi projekty.

| Nástroj | Povinné | Volitelné | Co dělá |
|---|---|---|---|
| `lockin_add_option` | `kind` `label` | `color` | Nová volba |
| `lockin_set_option` | `kind` `option` | `label` `color` | Přejmenuje nebo přebarví |
| `lockin_remove_option` | `kind` `option` | — | Smaže; projekty, které ji používaly, spadnou na první zbylou |

`kind` je `priority` nebo `status`. `option` bere popisek i ID. `color` je hex
`#e5484d`. Poslední volbu smazat nejde.

### Štítky

Sdílí je dokumenty i projekty. Seznam vrací `lockin_options` (`tags`).

| Nástroj | Povinné | Volitelné | Co dělá |
|---|---|---|---|
| `lockin_create_tag` | `name` | `color` | Založí štítek (stejný název vrátí existující) |
| `lockin_delete_tag` | `tag` | — | Smaže štítek a odebere ho ze všech dokumentů a projektů |

---

## 6. LockIn Markdown (pro `lockin_write_document`)

`lockin_document` vrací stejný formát, takže **čtení → úprava → zápis** funguje
jako kolečko.

Běžný Markdown: odstavce, `#`/`##`/`###`, `**tučně**`, `*kurzíva*`, `~~škrtnuté~~`,
`` `kód` ``, `[odkaz](https://…)`, `[[Wiki odkaz]]`, `> citace`, ```` ```lang ````,
`---`, odrážky `- `, `+ `, `1. `, checkboxy `- [ ]` / `- [x]`, tabulky `| … |`.

Komponenty — každá sama na svém řádku jako `{lockin.<název> <JSON>}`, všechna pole
volitelná:

```
{lockin.todolist {"title":"Launch","deadline":"2026-10-10",
  "tasks":["Napsat texty",{"title":"Nasadit","done":true,"description":"…"}],
  "groups":[{"title":"Později","tasks":["…"]}]}}

{lockin.palette {"title":"Značka","groups":[{"title":"Primární","swatches":["#0088ff"]}]}}

{lockin.scenario {"name":"Intro video","beats":[{"time":"0:00–0:10","title":"Hook","text":"…"}]}}

{lockin.media {"src":"C:/cesta/obrazek.png","alt":"…","align":"center","width":100}}

{lockin.youtube {"url":"https://youtu.be/…"}}

{lockin.project}
```

- `{lockin.todolist …}` se stane skutečným LockIn to-do listem — jeho úkoly se
  objeví v `lockin_tasks`, `lockin_next` i v To-do Home.
- `{lockin.media …}` bere **cestu k souboru na disku**; server ho zkopíruje
  do úložiště LockInu. Podporuje png, jpg, gif, webp, svg, mp4, webm, mov.
- `{lockin.project}` sám na řádku udělá z poznámky projekt.

---

## 7. Pasti

**Mazání je nevratné.** Žádná koš ani undo. `delete_task`, `delete_group`
a hlavně `delete_document` jsou natvrdo. Když uživatel chce jen „odškrtnout",
použij `lockin_complete_task`.

**Dvě různá čísla jménem progress.** `lockin_overview` hlásí progress
**dopočítaný z úkolů** (hotové / všechny). `lockin_set_project { progress }`
zapisuje **uložené** `project.progress`, které ukazuje hlavička projektu v appce.
Jsou to nezávislé hodnoty — nastavení jednoho nezmění druhé.

**Priority a stavy jsou ID, ne popisky.** `project.priority` je `"high"`, ne
`"High"`. Nástroje berou obojí a překládají to za tebe, ale když čteš surová data
projektu, nenech se zmást. Mapu najdeš v `lockin_options`.

**`ref` u checkbox listu není stabilní** — viz sekce 2.

**Verze aplikace vs. verze serveru.** Příkazy provádí běžící LockIn. Když se do
serveru přidá nový příkaz, starý build ho nezná. Řešení je restart aplikace,
ne obcházení.

**Workspace musí sedět.** Čtení si workspace vybere samo, ale zápis aplikace
odmítne, pokud má otevřený jiný. Zkontroluj `lockin_workspaces` předem.

---

## 8. Ověření

```bash
bun Mcp/Mcp.check.ts           # čtení — nepotřebuje běžící aplikaci
bun Mcp/Mcp.check.ts --write   # + zápis přes běžící aplikaci
```

Check spustí **čerstvý** server přes stdio a volá nástroje přesně jako AI klient.
Kontroluje registraci všech nástrojů, konzistenci grafu a canvasu a odmítání
neplatných vstupů.

`--write` je bezpečný: všechno, co zapíše, hned zase vrátí zpět. Odškrtne a odškrtne
zpátky, přepne prioritu projektu a vrátí ji, přebarví volbu a vrátí barvu, a založí
sekci s úkolem, přesune ho, smaže ho a sekci zruší. Po doběhnutí je stav přesně
takový, jaký byl předtím.

---

## 9. Mapa souborů

| Soubor | K čemu |
|---|---|
| `index.ts` | Registrace nástrojů, validace vstupů (zod), překlad popisků na ID |
| `Data.ts` | Čtení z disku — vault i AppData kolekce |
| `Views.ts` | Odvozené pohledy: overview, board, next, graf, canvasy, vyhledávání |
| `Bridge.ts` | Odeslání příkazu běžící aplikaci a čekání na odpověď |
| `Mcp.check.ts` | Self-check |
| `cli.ts` | Spouštěč |

Protokol mezi serverem a aplikací je v `../Shared/Lib/McpProtocol.ts`,
provádění příkazů v `../TauriBuild/Platform/McpBridge.ts`.
**Když přidáváš příkaz, musíš sáhnout do všech tří míst.**
