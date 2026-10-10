import type { Platform } from "./Types";

let current: Platform | null = null;

/**
 * Zavolá build ve svém root layoutu, ještě než se cokoliv vykreslí.
 * Viz TauriBuild/Platform/Register.ts.
 */
export function RegisterPlatform(platform: Platform): void {
  current = platform;
}

/**
 * Adaptéry se resolvují až v okamžiku volání, ne při importu modulu — zustand
 * `createJSONStorage` si storage objekt vyžádá hned při vytvoření storu, což
 * je dřív, než stihne proběhnout registrace. Díky tomuhle odložení na to
 * nenarazíme a nemusí se hlídat pořadí importů.
 */
export function GetPlatform(): Platform {
  if (!current) {
    throw new Error(
      "Platforma není zaregistrovaná — build musí zavolat RegisterPlatform() " +
        "ve svém root layoutu dřív, než se sáhne na úložiště.",
    );
  }
  return current;
}

/** Pro kód, který má fungovat i bez registrace (např. render před bootstrapem). */
export function TryGetPlatform(): Platform | null {
  return current;
}

export function IsPlatformRegistered(): boolean {
  return current !== null;
}
