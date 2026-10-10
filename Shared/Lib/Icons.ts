/**
 * Ikona je v datech obyčejný řetězec:
 *  - emoji ("🚀")
 *  - obrázek jako data URL ("data:image/png;base64,…")
 *  - Lucide ikona ("lucide:rocket" — kebab-case jméno z lucide-react/dynamic)
 *  - Google Material Symbol ("material:home-outline" — jméno z @iconify-json/material-symbols)
 * Starší data (emoji, data URL) tak zůstávají platná beze změny.
 */
export type IconKind = "emoji" | "image" | "lucide" | "material";

export function IconKindOf(icon: string): IconKind {
  if (icon.startsWith("data:")) return "image";
  if (icon.startsWith("lucide:")) return "lucide";
  if (icon.startsWith("material:")) return "material";
  return "emoji";
}

export const IconName = (icon: string) => icon.slice(icon.indexOf(":") + 1);

interface IconifySet {
  icons: Record<string, { body: string; width?: number; height?: number }>;
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
}

let material: Promise<IconifySet> | null = null;
const bodies = new Map<string, string>();

/** Sada Material Symbols (~9 MB JSON) — načte se až při první potřebě, pak je v paměti. */
export function LoadMaterial(): Promise<IconifySet> {
  material ??= import("@iconify-json/material-symbols/icons.json").then((m) => ((m as { default?: IconifySet }).default ?? m) as IconifySet);
  return material;
}

/** SVG tělo ikony (už načtené = synchronně, jinak undefined). */
export function MaterialBodySync(name: string): string | undefined {
  return bodies.get(name);
}

export async function MaterialBody(name: string): Promise<string | undefined> {
  const cached = bodies.get(name);
  if (cached) return cached;
  const set = await LoadMaterial();
  const resolved = set.icons[name] ? name : set.aliases?.[name]?.parent;
  const body = resolved ? set.icons[resolved]?.body : undefined;
  if (body) bodies.set(name, body);
  return body;
}

/** Jména pro výběr: jedna (outlined) varianta každého tvaru, jako na fonts.google.com/icons. */
export async function MaterialNames(): Promise<string[]> {
  const set = await LoadMaterial();
  const names = Object.keys(set.icons);
  const all = new Set(names);
  return names
    .filter((n) => !/-(outline|rounded|sharp)/.test(n))
    .map((n) => (all.has(`${n}-outline`) ? `${n}-outline` : n));
}
