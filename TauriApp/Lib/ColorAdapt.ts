import { ParseHexColor } from "./Color";

/** Relative luminance (WCAG) of a hex color, 0 (black) – 1 (white). */
function Luminance(hex: string): number {
  const rgb = ParseHexColor(hex);
  if (!rgb) return 1;
  const Linear = (c: number) => {
    const n = c / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * Linear(rgb.r) + 0.7152 * Linear(rgb.g) + 0.0722 * Linear(rgb.b);
}

/** Whether a document's custom background reads as dark — embedded blocks
 * (to-do lists, color palettes) are built for a light card surface, so their
 * "adapt to theme" filter only makes sense to switch on past this point. */
export function IsDarkBackground(hex: string | undefined): boolean {
  if (!hex) return false;
  return Luminance(hex) < 0.5;
}
