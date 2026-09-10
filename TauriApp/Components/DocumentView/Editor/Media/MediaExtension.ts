import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MediaNodeView } from "./MediaNodeView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    media: {
      insertMedia: () => ReturnType;
    };
  }
}

/**
 * Image/video block — starts empty (an upload prompt) until a file is
 * picked, at which point it's copied into the app's own Media directory
 * (see Lib/MediaStorage.ts) and only the *relative path* lands in this
 * node's attrs. Deliberately never base64 — that would mean re-serializing
 * the whole file into the document's JSON on every autosave.
 */
export const MediaExtension = Node.create({
  name: "media",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      path: { default: null },
      mimeType: { default: null },
      alt: { default: "" },
      /** "left" | "center" | "right" | "block" (full container width). */
      align: { default: "center" },
      /** Percent of the container width — ignored while align is "block". */
      width: { default: 100 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="media"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "media" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaNodeView);
  },

  addCommands() {
    return {
      insertMedia:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { path: null, mimeType: null, alt: "" },
          }),
    };
  },
});
