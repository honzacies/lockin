import { Extension, Node } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { IsWikiHref, WikiInner, WikiTarget } from "@lockin/shared/Lib/WikiLink";

/**
 * Klik na `[[wiki odkaz]]` (link mark s href `wiki:…`) otevře cílový
 * dokument. Běží před Link extension, jinak by zkusila `wiki:` otevřít jako URL.
 */
export const WikiLinkExtension = Extension.create<{ onOpen: (target: string) => void }>({
  name: "wikiLink",
  priority: 1001,

  addOptions() {
    return { onOpen: () => {} };
  },

  addProseMirrorPlugins() {
    const { onOpen } = this.options;
    return [
      new Plugin({
        props: {
          handleClick(view, pos) {
            const mark = view.state.doc
              .resolve(pos)
              .marks()
              .find((m) => m.type.name === "link" && IsWikiHref(m.attrs.href));
            if (!mark) return false;
            onOpen(WikiTarget(WikiInner(mark.attrs.href)));
            return true;
          },
        },
      }),
    ];
  },
});

/** Doslovný kus .md souboru, který se v editoru neukazuje (`<!-- komentář -->`,
 * značka `{lockin.project}`) — při uložení se zapíše zpět beze změny. */
export const HtmlCommentExtension = Node.create({
  name: "hiddenRaw",
  group: "block",
  atom: true,
  selectable: false,

  addAttributes() {
    return { raw: { default: "" } };
  },

  parseHTML() {
    return [{ tag: "div[data-hidden-raw]", getAttrs: (el) => ({ raw: (el as HTMLElement).dataset.raw ?? "" }) }];
  },

  renderHTML({ node }) {
    return ["div", { "data-hidden-raw": "", "data-raw": node.attrs.raw, hidden: "" }];
  },
});
