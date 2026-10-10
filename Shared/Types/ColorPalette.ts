export type ColorFormat = "hex" | "rgb" | "rgba" | "hsl";

export type ColorPaletteVariant = "solid" | "transparent";

export interface ColorSwatch {
  id: string;
  /** Always stored as a hex string — ColorFormat only affects display/copy. */
  color: string;
  label: string;
}

/** A named cluster of swatches inside a palette, rendered as its own
 * sub-section (e.g. "Primary colors", "Surface colors"). */
export interface ColorSwatchGroup {
  id: string;
  title: string;
  swatches: ColorSwatch[];
}

export interface ColorPaletteStyle {
  variant: ColorPaletteVariant;
  showTitle: boolean;
  showIcon: boolean;
  showDescription: boolean;
  colorFormat: ColorFormat;
}

export interface ColorPaletteConfig {
  id: string;
  title: string;
  /** Emoji or uploaded-image icon, same convention as Project.icon. */
  icon?: string;
  description: string;
  groups: ColorSwatchGroup[];
  style: ColorPaletteStyle;
}

export const DEFAULT_COLOR_PALETTE_STYLE: ColorPaletteStyle = {
  variant: "solid",
  showTitle: true,
  showIcon: true,
  showDescription: false,
  colorFormat: "hex",
};

export function NewSwatchGroup(): ColorSwatchGroup {
  return { id: `swatch-group-${crypto.randomUUID()}`, title: "New group", swatches: [] };
}

export function NewSwatch(color = "#0088ff"): ColorSwatch {
  return { id: `swatch-${crypto.randomUUID()}`, color, label: "New color" };
}
