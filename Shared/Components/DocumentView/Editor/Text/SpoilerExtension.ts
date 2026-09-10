import { Mark, markInputRule, markPasteRule, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

// Mirrors @tiptap/extension-strike's own `~~text~~` regex shape, swapped to
// `||text||`.
const inputRegex = /(?:^|\s)(\|\|(?!\s+\|\|)((?:[^|]+))\|\|(?!\s+\|\|))$/;
const pasteRegex = /(?:^|\s)(\|\|(?!\s+\|\|)((?:[^|]+))\|\|(?!\s+\|\|))/g;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spoiler: {
      setSpoiler: () => ReturnType;
      toggleSpoiler: () => ReturnType;
      unsetSpoiler: () => ReturnType;
    };
  }
}

/**
 * Discord-style spoiler mark — `||text||` hides the wrapped text behind a
 * solid block until clicked. Revealed/hidden is purely a visual class
 * toggled by the plugin below (`is-revealed`, styled in globals.css) —
 * deliberately not part of the mark's own attrs/the document JSON, so a
 * spoiler always starts hidden again after a reload, matching how spoilers
 * are expected to behave everywhere else.
 */
export const SpoilerExtension = Mark.create({
  name: "spoiler",

  parseHTML() {
    return [{ tag: "span[data-spoiler]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-spoiler": "" }), 0];
  },

  addCommands() {
    return {
      setSpoiler:
        () =>
        ({ commands }) =>
          commands.setMark(this.name),
      toggleSpoiler:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
      unsetSpoiler:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },

  addInputRules() {
    return [markInputRule({ find: inputRegex, type: this.type })];
  },

  addPasteRules() {
    return [markPasteRule({ find: pasteRegex, type: this.type })];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          // A click reveals (or re-hides) the spoiler instead of just
          // placing the caret — returning true tells ProseMirror this
          // click was fully handled, so it skips its own default caret
          // placement for it.
          handleClick(_view, _pos, event) {
            const target = event.target;
            if (!(target instanceof Element)) return false;
            const spoiler = target.closest("span[data-spoiler]");
            if (!spoiler) return false;
            if (spoiler.classList.contains("is-revealed")) { return };
            spoiler.classList.toggle("is-revealed");
            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});
