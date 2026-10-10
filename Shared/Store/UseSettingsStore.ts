import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ShortcutId } from "@lockin/shared/Lib/Shortcuts";

export type ThemePreference = "light" | "dark" | "system";
export type StartPage = "last" | "/YourProjects" | "/QuickNotes" | "/Todo" | "/Library";
export type SettingsSection =
  | "general"
  | "appearance"
  | "ai"
  | "shortcuts"
  | "editor"
  | "blocks"
  | "sidebar"
  | "session"
  | "options"
  | "lists"
  | "about";

/**
 * Předvolby aplikace. V localStorage, ne v souborech workspacu: platí pro
 * všechny workspacy a načtou se synchronně ještě před prvním vykreslením —
 * motiv by jinak při startu probliknul světlým.
 */
export interface Settings {
  theme: ThemePreference;
  startPage: StartPage;
  /** Poslední otevřená stránka, pro `startPage: "last"`. */
  lastPage: string;
  /** Smí AI agenti přes MCP měnit data (čtení jde vždy). */
  mcpWrites: boolean;
  spellcheck: boolean;
  /** Nové dokumenty rovnou s menším písmem. */
  newDocumentsSmallText: boolean;
  /** Bloky vypnuté ve slash menu (podle názvu, např. "Scenario"). */
  disabledBlocks: string[];
  /** Odhad pro nové úkoly na boardu, v minutách; null = stopky. */
  defaultEstimateMin: number | null;
  /** Krátký zvuk, když úkolu vyprší odhadovaný čas. */
  timeUpSound: boolean;
  /** Po „Done" pokračovat rovnou dalším úkolem, nebo časovač zastavit. */
  continueAfterDone: boolean;
  /** Kde otevřít okno relace: zeptat se (víc monitorů), nebo vždy hlavní. */
  sessionMonitor: "ask" | "primary";
  /** Přemapované klávesové zkratky (chybějící = výchozí, viz Lib/Shortcuts.ts). */
  shortcuts: Partial<Record<ShortcutId, string>>;
}

const DEFAULTS: Settings = {
  theme: "system",
  startPage: "last",
  lastPage: "/YourProjects",
  mcpWrites: true,
  spellcheck: false,
  newDocumentsSmallText: false,
  disabledBlocks: [],
  defaultEstimateMin: null,
  timeUpSound: true,
  continueAfterDone: true,
  sessionMonitor: "ask",
  shortcuts: {},
};

interface SettingsState extends Settings {
  /** Otevřený dialog nastavení (sekce), null = zavřený. Neukládá se. */
  open: SettingsSection | null;
  Set: (patch: Partial<Settings>) => void;
  Open: (section?: SettingsSection) => void;
  Close: () => void;
}

export const SETTINGS_KEY = "lockin-settings";

export const UseSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      open: null,
      Set: (patch) => set(patch),
      Open: (section = "general") => set({ open: section }),
      Close: () => set({ open: null }),
    }),
    {
      name: SETTINGS_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ open: _open, Set: _set, Open: _o, Close: _c, ...settings }) => settings,
    },
  ),
);

/** Skutečný motiv po vyhodnocení "system". */
export function ResolvedTheme(theme: ThemePreference): "light" | "dark" {
  if (theme !== "system") return theme;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
