import type { CSSProperties } from "react";
import type {
  BlockStyle,
  DocumentStyleConfig,
  StyleableBlockType,
} from "@/Types/Project";

/**
 * Which BlockStyle fields each block type actually exposes in its settings
 * modal. The pencil UI renders only these controls; StyleVars only emits CSS
 * for these fields. Keep in sync with the .prose-editor rules in globals.css.
 */
export const BLOCK_STYLE_FIELDS: Record<
  StyleableBlockType,
  (keyof BlockStyle)[]
> = {
  paragraph: ["fontFamily", "color", "fontSize"],
  heading1: ["fontFamily", "color", "fontSize"],
  heading2: ["fontFamily", "color", "fontSize"],
  heading3: ["fontFamily", "color", "fontSize"],
  link: ["fontFamily", "color", "fontSize"],
  quote: ["fontFamily", "color", "fontSize"],
  codeBlock: ["fontFamily", "color", "background", "fontSize"],
  divider: ["color", "thickness", "width"],
  bulletList: ["fontFamily", "color", "fontSize", "markerGap"],
  dashedList: ["fontFamily", "color", "fontSize", "markerGap"],
  numberedList: ["fontFamily", "color", "fontSize", "markerGap"],
};

/** BlockStyle field → CSS custom-property suffix (matches globals.css). */
const FIELD_SUFFIX: Record<keyof BlockStyle, string> = {
  color: "color",
  fontFamily: "font",
  fontSize: "size",
  background: "bg",
  thickness: "thickness",
  width: "width",
  markerGap: "gap",
};

/** Turn a numeric field into its CSS value (px / %), else pass strings through. */
function CssValue(field: keyof BlockStyle, value: string | number): string {
  if (field === "width") return `${value}%`;
  if (field === "thickness" || field === "markerGap" || field === "fontSize") {
    return `${value}px`;
  }
  return String(value);
}

/** Block types whose color CSS rule falls back to `inherit` (see the
 * .prose-editor rules in globals.css) — these are the ones a document
 * theme's text color should reach. Link/quote/inline-code keep their own
 * distinct default color instead of blending into body text. */
const THEME_COLOR_BLOCK_TYPES: StyleableBlockType[] = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "dashedList",
  "numberedList",
];

/**
 * Build the inline `style` object of `--ed-<type>-<suffix>` custom properties
 * for a document's style config. Only set fields are emitted, so unset ones
 * fall back to the defaults baked into the .prose-editor rules.
 *
 * `themeForeground` (the settings menu's document-wide "Text" color) is
 * written directly into each block type's own `--ed-<type>-color` var,
 * rather than left to cascade down as an inherited `color` on some ancestor
 * — inheritance is one stray hardcoded color class away from silently
 * breaking (as it did once already), while writing straight into the same
 * var a per-block override already uses can't be shadowed that way. A
 * per-block color, when set, still wins — it's applied after.
 */
export function BuildStyleVars(
  config: DocumentStyleConfig | undefined,
  themeForeground?: string,
): CSSProperties {
  const vars: Record<string, string> = {};

  if (themeForeground) {
    for (const blockType of THEME_COLOR_BLOCK_TYPES) {
      vars[`--ed-${blockType}-color`] = themeForeground;
    }
  }

  if (!config) return vars as CSSProperties;

  for (const [blockType, style] of Object.entries(config)) {
    if (!style) continue;
    for (const [field, value] of Object.entries(style)) {
      if (value === undefined || value === null || value === "") continue;
      const suffix = FIELD_SUFFIX[field as keyof BlockStyle];
      vars[`--ed-${blockType}-${suffix}`] = CssValue(
        field as keyof BlockStyle,
        value as string | number,
      );
    }
  }

  return vars as CSSProperties;
}
