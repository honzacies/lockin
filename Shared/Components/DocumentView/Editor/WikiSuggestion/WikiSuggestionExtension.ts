import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { CreateNewDocument } from "@lockin/shared/Lib/CreateDocument";
import { WikiHref } from "@lockin/shared/Lib/WikiLink";
import { WikiSuggestionMenu, type WikiSuggestionItem, type WikiSuggestionMenuHandle } from "./WikiSuggestionMenu";

const LIMIT = 7;

/** Vlastní klíč — bez něj by se srazil s pluginem slash menu, které má
 * stejný výchozí (`suggestion$`), a editor by se vůbec nevytvořil. */
const WIKI_SUGGESTION_KEY = new PluginKey("wikiSuggestion");

/**
 * Nabídka po napsání `[[`. Bez ní musí uživatel trefit přesný název
 * dokumentu poslepu — a hlavně: samotný text `[[Něco]]` v editoru odkaz
 * nevytvoří, zpětné odkazy ("Linked from") počítají jen link marky
 * s `wiki:` href. Vybráním z nabídky vznikne rovnou ten správný mark,
 * který se do Markdownu uloží zpátky jako `[[Něco]]`.
 */
export const WikiSuggestionExtension = Extension.create({
  name: "wikiSuggestion",

  addOptions() {
    return {
      suggestion: {
        pluginKey: WIKI_SUGGESTION_KEY,
        char: "[[",
        startOfLine: false,
        allowedPrefixes: null,
        // Názvy dokumentů mají mezery, jinak by nabídka zmizela po prvním slovu.
        allowSpaces: true,
        items: ({ query, editor }): WikiSuggestionItem[] => {
          const text = query.trim();
          const documents = Object.values(UseDataStore.getState().documents);
          const found = documents
            .filter((doc) => !text || doc.name.toLowerCase().includes(text.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, LIMIT)
            .map((doc): WikiSuggestionItem => ({ kind: "document", id: doc.id, name: doc.name || "Untitled", icon: doc.icon }));
          void editor;
          const exact = documents.some((doc) => doc.name.toLowerCase() === text.toLowerCase());
          return text && !exact ? [...found, { kind: "create", name: text }] : found;
        },
        command: ({ editor, range, props }) => {
          const item = props as WikiSuggestionItem;
          let name = item.name;
          if (item.kind === "create") {
            const doc = CreateNewDocument();
            UseDataStore.getState().RenameDocument(doc.id, name);
            name = name || "Untitled";
          }
          editor
            .chain()
            .focus()
            .deleteRange(range)
            // Odkaz je text s `link` markem a `wiki:` href — stejný tvar,
            // jaký vyrobí načtení `[[…]]` z Markdownu.
            .insertContent({ type: "text", text: name, marks: [{ type: "link", attrs: { href: WikiHref(name) } }] })
            // Bez tohohle by mark pokračoval i na dalším psaném písmenu.
            .unsetMark("link")
            .run();
        },
        render: () => {
          let component: ReactRenderer<WikiSuggestionMenuHandle>;
          let unmount: (() => void) | undefined;
          return {
            onStart: (props) => {
              component = new ReactRenderer(WikiSuggestionMenu, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              });
              unmount = props.mount(component.element as HTMLElement);
              (component.element as HTMLElement).style.zIndex = "250";
            },
            onUpdate: (props) => component.updateProps({ items: props.items, command: props.command }),
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                unmount?.();
                return true;
              }
              return component.ref?.onKeyDown({ event: props.event }) ?? false;
            },
            onExit: () => {
              unmount?.();
              component.destroy();
            },
          };
        },
      } satisfies Partial<SuggestionOptions<WikiSuggestionItem>>,
    };
  },

  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })];
  },
});
