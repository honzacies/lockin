/**
 * YAML frontmatter `.md` souborů — jen tolik, kolik potřebujeme na metadata
 * poznámky (ikona, štítky, oblíbené, popis). Záměrně to není plný YAML:
 * čte se plochá mapa `klíč: hodnota`, seznamy v obou zápisech
 * (`[a, b]` i odrážky pod klíčem) a `true`/`false`.
 *
 * Důvod existence: metadata musí žít v samotném souboru, ne vedle v AppData.
 * Složkový workspace se pak dá zkopírovat nebo sdílet a ikony, štítky ani
 * popisy se cestou neztratí. Cizí klíče (Obsidian `aliases`, `cssclasses`,
 * cokoliv uživatelova) se při zápisu nesmí ztratit — proto se frontmatter
 * needituje jako celek, ale po řádcích.
 */

export type FrontmatterValue = string | string[] | boolean;

const FENCE = "---";
/** `klíč: zbytek řádku`; klíč bez mezer, ať se netrefíme do textu v hodnotě. */
const ENTRY = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/;
const BULLET = /^[ \t]*-[ \t]+(.*)$/;

/** Hodnota bez uvozovek. Dvojité se čtou jako JSON, protože se tak i zapisují
 * (viz Quote) — jinak by se z `"\"citace\""` vrátila zpátky i ta lomítka. */
function Unquote(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}

/** Rozdělí `a, "b, c"` na položky — čárka uvnitř uvozovek seznam nedělí. */
function SplitList(inner: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (quote) {
      current += char;
      if (char === "\\" && quote === '"') current += inner[++i] ?? "";
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ",") {
      out.push(current);
      current = "";
    } else current += char;
  }
  out.push(current);
  return out.map(Unquote).filter(Boolean);
}

function ParseValue(raw: string): FrontmatterValue {
  const text = raw.trim();
  if (text === "true") return true;
  if (text === "false") return false;
  if (text.startsWith("[") && text.endsWith("]")) {
    const inner = text.slice(1, -1).trim();
    return inner ? SplitList(inner) : [];
  }
  return Unquote(text);
}

/** Potřebuje hodnota uvozovky, aby se dala přečíst zpátky? */
function Quote(text: string): string {
  return /^[\s>|&*!%@`[{#-]|: |:$|^$|"|'|,/.test(text) ? JSON.stringify(text) : text;
}

function FormatValue(value: FrontmatterValue): string {
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(Quote).join(", ")}]`;
  return Quote(value);
}

/** Řádky uvnitř `---` bloku; prázdné pole, když frontmatter není. */
function Lines(frontmatter: string): string[] {
  const text = frontmatter.trim();
  if (!text.startsWith(FENCE)) return [];
  const body = text.slice(FENCE.length);
  const end = body.indexOf(`\n${FENCE}`);
  return (end === -1 ? body : body.slice(0, end)).split("\n").slice(1);
}

/** Mapa klíč → hodnota z frontmatteru (prázdná, když žádný není). */
export function ParseFrontmatter(frontmatter: string): Record<string, FrontmatterValue> {
  const out: Record<string, FrontmatterValue> = {};
  const lines = Lines(frontmatter);
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(ENTRY);
    if (!match) continue;
    const [, key, rest] = match;
    if (rest.trim()) {
      out[key] = ParseValue(rest);
      continue;
    }
    // Klíč bez hodnoty: buď odrážkový seznam pod ním, nebo prázdno.
    const items: string[] = [];
    while (i + 1 < lines.length && BULLET.test(lines[i + 1])) {
      items.push(Unquote(lines[++i].match(BULLET)![1]));
    }
    out[key] = items.length ? items : "";
  }
  return out;
}

/**
 * Vrátí frontmatter s přepsanými klíči z `patch`. Klíč s `undefined` se
 * smaže, ostatní řádky (i cizí klíče a komentáře) zůstanou, jak byly.
 * Výsledek je buď prázdný řetězec, nebo blok zakončený novým řádkem —
 * stejný tvar, jaký vrací `SplitFrontmatter`.
 */
export function PatchFrontmatter(frontmatter: string, patch: Record<string, FrontmatterValue | undefined>): string {
  const entries = Object.entries(patch);
  if (!entries.length) return frontmatter;

  const lines = Lines(frontmatter);
  const out: string[] = [];
  const handled = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const key = lines[i].match(ENTRY)?.[1];
    if (!key || !(key in patch)) {
      out.push(lines[i]);
      continue;
    }
    // Starý zápis klíče přeskočíme i s jeho odrážkami.
    while (i + 1 < lines.length && BULLET.test(lines[i + 1])) i++;
    handled.add(key);
    const value = patch[key];
    if (value !== undefined && !(Array.isArray(value) && !value.length)) out.push(`${key}: ${FormatValue(value)}`);
  }

  for (const [key, value] of entries) {
    if (handled.has(key) || value === undefined || (Array.isArray(value) && !value.length)) continue;
    out.push(`${key}: ${FormatValue(value)}`);
  }

  const body = out.join("\n").trim();
  return body ? `${FENCE}\n${body}\n${FENCE}\n` : "";
}
