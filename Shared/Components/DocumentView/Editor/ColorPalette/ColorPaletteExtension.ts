import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { ColorPaletteConfig } from "@lockin/shared/Types/ColorPalette";
import { DEFAULT_COLOR_PALETTE_STYLE, NewSwatchGroup } from "@lockin/shared/Types/ColorPalette";
import { ColorPaletteNodeView } from "./ColorPaletteNodeView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    colorPalette: {
      insertColorPalette: () => ReturnType;
    };
  }
}

/** A fresh config for a newly-inserted color palette block — one starter
 * group so the block isn't just an empty "add a group" prompt on insert. */
export function CreateEmptyColorPaletteConfig(): ColorPaletteConfig {
  return {
    id: `doc-palette-${crypto.randomUUID()}`,
    title: "Color Palette",
    description: "",
    groups: [NewSwatchGroup()],
    style: DEFAULT_COLOR_PALETTE_STYLE,
  };
}

/**
 * The rich color palette block — named groups of color swatches with
 * copy-to-clipboard, editable title/icon/description. Its config lives
 * entirely in this node's attrs, same architecture as TodoListExtension.ts.
 */
export const ColorPaletteExtension = Node.create({
  name: "colorPalette",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      config: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-config");
          if (!raw) return null;
          try {
            return JSON.parse(raw) as ColorPaletteConfig;
          } catch {
            return null;
          }
        },
        renderHTML: (attributes: { config: ColorPaletteConfig | null }) => {
          if (!attributes.config) return {};
          return { "data-config": JSON.stringify(attributes.config) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="color-palette"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "color-palette" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColorPaletteNodeView);
  },

  addCommands() {
    return {
      insertColorPalette:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { config: CreateEmptyColorPaletteConfig() },
          }),
    };
  },
});
