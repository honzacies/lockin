import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CircleHelp, Info, Lightbulb, OctagonAlert, TriangleAlert, type LucideIcon } from "@lockin/shared/Components/Shared/UiIcons";
import { CalloutNodeView } from "./CalloutNodeView";

/** Druhy, které umíme vykreslit. Obsidian jich zná víc (`abstract`, `bug`…) —
 * neznámý druh si necháme v atributu beze změny a jen ho nakreslíme jako
 * `note`, aby se z cizího vaultu nic neztratilo. */
export const CALLOUT_KINDS: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  note: { label: "Note", icon: Info, color: "#3b7cff" },
  tip: { label: "Tip", icon: Lightbulb, color: "#12a594" },
  question: { label: "Question", icon: CircleHelp, color: "#8e4ec6" },
  warning: { label: "Warning", icon: TriangleAlert, color: "#f5a524" },
  danger: { label: "Danger", icon: OctagonAlert, color: "#e5484d" },
};

export const CalloutStyle = (kind: string) => CALLOUT_KINDS[kind] ?? CALLOUT_KINDS.note;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (kind?: string) => ReturnType;
    };
  }
}

/**
 * Zvýrazněný rámeček s ikonou a vlastním nadpisem. V Markdownu je to
 * Obsidian callout (`> [!tip] Nadpis`), tedy pořád obyčejná citace — soubor
 * zůstane čitelný i v editoru, který callouty nezná.
 */
export const CalloutExtension = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: { default: "note" },
      title: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-callout": String(node.attrs.kind ?? "note") }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },

  addCommands() {
    return {
      setCallout:
        (kind = "note") =>
        ({ commands }) =>
          commands.wrapIn(this.name, { kind }),
    };
  },

  addKeyboardShortcuts() {
    return {
      // Enter na konci prázdného posledního odstavce callout opustí — jinak
      // by z něj nešlo vyjít jinak než myší.
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        const parent = $from.node(-1);
        if (!empty || parent?.type.name !== this.name) return false;
        const isLast = $from.index(-1) === parent.childCount - 1;
        if (!isLast || $from.parent.content.size > 0) return false;
        return editor.chain().deleteNode("paragraph").insertContentAt($from.after(-1), { type: "paragraph" }).focus().run();
      },
    };
  },
});
