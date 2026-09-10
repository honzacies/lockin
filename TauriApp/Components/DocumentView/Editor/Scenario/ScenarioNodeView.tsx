"use client";

import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/react";
import type { ScenarioBeat, ScenarioConfig, ScenarioStyle } from "@/Types/Scenario";
import { NewScenarioBeat } from "@/Types/Scenario";
import { ScenarioView } from "@/Components/QuickNotes/ScenarioView";

/** Bridges a `scenario` Tiptap node's attrs to ScenarioView — every edit
 * patches the node's `config` attr so it saves with the document, same
 * pattern as ColorPaletteNodeView.tsx. */
export function ScenarioNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const config = node.attrs.config as ScenarioConfig;

  function Patch(patch: Partial<ScenarioConfig>) {
    updateAttributes({ config: { ...config, ...patch } });
  }

  function PatchStyle(patch: Partial<ScenarioStyle>) {
    Patch({ style: { ...config.style, ...patch } });
  }

  function PatchBeat(beatId: string, fn: (beat: ScenarioBeat) => ScenarioBeat) {
    Patch({ beats: config.beats.map((b) => (b.id === beatId ? fn(b) : b)) });
  }

  if (!config) return null;

  return (
    // Chromium natively treats a `contentEditable={false}` island nested
    // inside a `contentEditable="true"` root as "draggable" by default (the
    // browser's own affordance for dragging embedded non-editable widgets
    // out of a rich-text region) — dragging across a *nested real input's*
    // text to select it hit that default first, producing a "not-allowed"
    // drag cursor instead of a text-selection caret. `draggable={false}`
    // overrides that browser default explicitly.
    <NodeViewWrapper data-type="scenario" contentEditable={false} draggable={false}>
      <ScenarioView
        config={config}
        onChangeName={(name) => Patch({ name })}
        onChangeDescription={(description) => Patch({ description })}
        onChangeStyle={PatchStyle}
        onAddBeat={() => Patch({ beats: [...config.beats, NewScenarioBeat()] })}
        onRemoveBeat={(beatId) => Patch({ beats: config.beats.filter((b) => b.id !== beatId) })}
        onChangeBeat={(beatId, patch) => PatchBeat(beatId, (b) => ({ ...b, ...patch }))}
        onDeleteScenario={() => deleteNode()}
      />
    </NodeViewWrapper>
  );
}
