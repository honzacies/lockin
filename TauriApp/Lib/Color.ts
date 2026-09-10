import type { ColorFormat } from "@/Types/ColorPalette";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Returns null for anything that isn't a clean 3- or 6-digit hex string. */
export function ParseHexColor(hex: string): Rgb | null {
  const clean = hex.trim().replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function RgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/** Formats a stored hex color for display/copy in the given representation
 * — falls back to the hex string unchanged if it can't be parsed. */
export function FormatColor(hex: string, format: ColorFormat): string {
  if (format === "hex") return hex.toUpperCase();
  const rgb = ParseHexColor(hex);
  if (!rgb) return hex;
  if (format === "rgb") return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  if (format === "rgba") return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
  const { h, s, l } = RgbToHsl(rgb);
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

/** Picks readable black/white text for a given hex background color. */
export function ContrastTextColor(hex: string): string {
  const rgb = ParseHexColor(hex);
  if (!rgb) return "#2c2c2b";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? "#2c2c2b" : "#ffffff";
}

/** Tiered progress color: red → yellow → yellow-green → green. */
export function ProgressColor(value: number): string {
  if (value <= 20) return "#e5484d";
  if (value <= 49) return "#eab308";
  if (value <= 74) return "#a9c93a";
  return "#30a46c";
}
