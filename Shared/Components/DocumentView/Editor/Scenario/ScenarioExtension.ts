import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { ScenarioConfig } from "@lockin/shared/Types/Scenario";
import { DEFAULT_SCENARIO_STYLE, NewScenarioBeat } from "@lockin/shared/Types/Scenario";
import { ScenarioNodeView } from "./ScenarioNodeView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    scenario: {
      insertScenario: () => ReturnType;
    };
  }
}

/** A fresh config for a newly-inserted scenario block — one starter beat so
 * it isn't just an empty "add a beat" prompt on insert. */
export function CreateEmptyScenarioConfig(): ScenarioConfig {
  return {
    id: `doc-scenario-${Date.now()}`,
    name: "Scenario Name",
    description: "",
    beats: [NewScenarioBeat()],
    style: DEFAULT_SCENARIO_STYLE,
  };
}

/**
 * Movie/video scenario block — a named script broken into timestamped beats
 * (time + title + the actual words to say), with a live word count. Config
 * lives entirely in this node's attrs, same architecture as
 * ColorPaletteExtension.ts / TodoListExtension.ts.
 */
export const ScenarioExtension = Node.create({
  name: "scenario",
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
            return JSON.parse(raw) as ScenarioConfig;
          } catch {
            return null;
          }
        },
        renderHTML: (attributes: { config: ScenarioConfig | null }) => {
          if (!attributes.config) return {};
          return { "data-config": JSON.stringify(attributes.config) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="scenario"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "scenario" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScenarioNodeView);
  },

  addCommands() {
    return {
      insertScenario:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { config: CreateEmptyScenarioConfig() },
          }),
    };
  },
});
