import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { YoutubeNodeView } from "./YoutubeNodeView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    youtubeEmbed: {
      insertYoutubeEmbed: () => ReturnType;
    };
  }
}

/** YouTube embed block — starts as a "paste a link" prompt; once a valid
 * video ID is parsed out of whatever URL shape was pasted, it renders a
 * responsive (16:9) `youtube-nocookie.com` iframe. */
export const YoutubeExtension = Node.create({
  name: "youtubeEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      videoId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="youtube-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "youtube-embed" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeNodeView);
  },

  addCommands() {
    return {
      insertYoutubeEmbed:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { videoId: null } }),
    };
  },
});
