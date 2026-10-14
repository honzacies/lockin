import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MathBlockNodeView, MathInlineNodeView } from "./MathNodeView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      setMath: (latex?: string) => ReturnType;
      setMathBlock: (latex?: string) => ReturnType;
    };
  }
}

/** `$x^2$` — nesmí začínat ani končit mezerou, aby „$5 a $10" nebyl vzorec. */
const INLINE_RULE = /\$([^\s$][^$]*[^\s$]|[^\s$])\$$/;
const BLOCK_RULE = /^\$\$\s$/;

const Attributes = () => ({
  latex: {
    default: "",
    parseHTML: (element: HTMLElement) => element.getAttribute("data-latex") ?? "",
    renderHTML: (attributes: { latex: string }) => ({ "data-latex": attributes.latex }),
  },
});

/**
 * Vzorce v KaTeX. V Markdownu je to `$…$` a `$$…$$`, tedy zápis, který čte
 * Obsidian i GitHub — ve vaultu tím nevzniká nic vlastního.
 */
export const MathExtension = Node.create({
  name: "math",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes: Attributes,

  parseHTML() {
    return [{ tag: "span[data-latex]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineNodeView);
  },

  addCommands() {
    return {
      setMath:
        (latex = "") =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    };
  },

  addInputRules() {
    return [nodeInputRule({ find: INLINE_RULE, type: this.type, getAttributes: (match) => ({ latex: match[1] }) })];
  },
});

export const MathBlockExtension = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes: Attributes,

  parseHTML() {
    return [{ tag: "div[data-latex]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-math-block": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockNodeView);
  },

  addCommands() {
    return {
      setMathBlock:
        (latex = "") =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    };
  },

  addInputRules() {
    // `$$` + mezera na začátku odstavce udělá blokový vzorec.
    return [nodeInputRule({ find: BLOCK_RULE, type: this.type, getAttributes: () => ({ latex: "" }) })];
  },
});
