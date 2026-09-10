"use client";

import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/react";
import type { ColorPaletteConfig, ColorPaletteStyle, ColorSwatch } from "@/Types/ColorPalette";
import { NewSwatch, NewSwatchGroup } from "@/Types/ColorPalette";
import { ColorPaletteView } from "@/Components/QuickNotes/ColorPaletteView";

/** Bridges a `colorPalette` Tiptap node's attrs to ColorPaletteView — every
 * edit patches the node's `config` attr so it saves with the document, same
 * pattern as TodoListNodeView.tsx. */
export function ColorPaletteNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const config = node.attrs.config as ColorPaletteConfig;

  function Patch(patch: Partial<ColorPaletteConfig>) {
    updateAttributes({ config: { ...config, ...patch } });
  }

  function PatchStyle(patch: Partial<ColorPaletteStyle>) {
    Patch({ style: { ...config.style, ...patch } });
  }

  function PatchGroup(groupId: string, fn: (group: ColorPaletteConfig["groups"][number]) => ColorPaletteConfig["groups"][number]) {
    Patch({ groups: config.groups.map((g) => (g.id === groupId ? fn(g) : g)) });
  }

  if (!config) return null;

  return (
    // See ScenarioNodeView.tsx's comment on `draggable={false}` — Chromium
    // makes a contentEditable={false} island natively draggable by default,
    // which hijacks drag-to-select-text gestures on any real input nested
    // inside it into a native "not-allowed" element drag instead.
    <NodeViewWrapper data-type="color-palette" contentEditable={false} draggable={false}>
      <ColorPaletteView
        config={config}
        onChangeTitle={(title) => Patch({ title })}
        onChangeIcon={(icon) => Patch({ icon })}
        onChangeDescription={(description) => Patch({ description })}
        onChangeStyle={PatchStyle}
        onAddGroup={() => Patch({ groups: [...config.groups, NewSwatchGroup()] })}
        onRemoveGroup={(groupId) => Patch({ groups: config.groups.filter((g) => g.id !== groupId) })}
        onChangeGroupTitle={(groupId, title) => PatchGroup(groupId, (g) => ({ ...g, title }))}
        onAddSwatch={(groupId) => PatchGroup(groupId, (g) => ({ ...g, swatches: [...g.swatches, NewSwatch()] }))}
        onRemoveSwatch={(groupId, swatchId) =>
          PatchGroup(groupId, (g) => ({ ...g, swatches: g.swatches.filter((s) => s.id !== swatchId) }))
        }
        onChangeSwatch={(groupId, swatchId, patch: Partial<Pick<ColorSwatch, "color" | "label">>) =>
          PatchGroup(groupId, (g) => ({
            ...g,
            swatches: g.swatches.map((s) => (s.id === swatchId ? { ...s, ...patch } : s)),
          }))
        }
        onDeletePalette={() => deleteNode()}
      />
    </NodeViewWrapper>
  );
}
