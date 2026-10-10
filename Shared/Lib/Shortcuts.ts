/**
 * Klávesové zkratky aplikace, které jde v nastavení změnit. Zkratka je řetězec
 * jako "Ctrl+Shift+K" (modifikátory v pevném pořadí Ctrl, Alt, Shift, pak klávesa).
 * Zkratky editoru (Ctrl+B…) patří Tiptapu a měnit nejdou.
 */
export type ShortcutId = "search" | "settings" | "newDocument" | "toggleSidebar" | "toggleTheme";

export const SHORTCUTS: { id: ShortcutId; label: string; default: string }[] = [
  { id: "search", label: "Search documents, to-dos and code", default: "Ctrl+K" },
  { id: "settings", label: "Open settings", default: "Ctrl+," },
  { id: "newDocument", label: "New document", default: "Ctrl+Alt+N" },
  { id: "toggleSidebar", label: "Show or hide the sidebar", default: "Ctrl+\\" },
  { id: "toggleTheme", label: "Switch light / dark", default: "Ctrl+Shift+L" },
];

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta", "AltGraph"]);

/** Klávesa z události jako text ("K", ",", "\\", "F5", "Enter"…). */
function KeyName(e: Pick<KeyboardEvent, "key" | "code">): string {
  // `code` nezávisí na rozložení klávesnice (na české by Ctrl+K hlásil jiné znaky s Alt/Shift).
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  if (/^Digit[0-9]$/.test(e.code)) return e.code.slice(5);
  const codes: Record<string, string> = { Comma: ",", Period: ".", Slash: "/", Backslash: "\\", Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", Backquote: "`" };
  if (codes[e.code]) return codes[e.code];
  return e.key.length === 1 ? e.key.toUpperCase() : e.key;
}

/** Zkratka z události; null = stiskl jen modifikátor nebo zkratku bez modifikátoru (to by kolidovalo s psaním). */
export function ComboFromEvent(e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const ctrl = e.ctrlKey || e.metaKey;
  const key = KeyName(e);
  // Bez Ctrl/Alt jde jen o funkční klávesy (F1–F12), jinak by zkratka sežrala psaní.
  if (!ctrl && !e.altKey && !/^F\d{1,2}$/.test(key)) return null;
  return [ctrl && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", key].filter(Boolean).join("+");
}

export function ShortcutFor(id: ShortcutId, overrides: Partial<Record<ShortcutId, string>>): string {
  return overrides[id] ?? SHORTCUTS.find((s) => s.id === id)!.default;
}

/** Která akce (pokud nějaká) odpovídá stisku. */
export function MatchShortcut(
  e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
  overrides: Partial<Record<ShortcutId, string>>,
): ShortcutId | null {
  const combo = ComboFromEvent(e);
  if (!combo) return null;
  return SHORTCUTS.find((s) => ShortcutFor(s.id, overrides) === combo)?.id ?? null;
}
