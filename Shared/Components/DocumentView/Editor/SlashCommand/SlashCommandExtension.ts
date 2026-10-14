import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { SLASH_COMMAND_ITEMS, type SlashCommandItem } from "./SlashCommandItems";
import { UseSettingsStore } from "@lockin/shared/Store/UseSettingsStore";
import {
  SlashCommandMenu,
  type SlashCommandMenuHandle,
} from "./SlashCommandMenu";

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        // Výchozí `[" "]` by menu otevřelo jen po mezeře nebo na začátku
        // řádku — napsat `/` hned za slovo by pak tiše nedělalo nic.
        allowedPrefixes: null,
        command: ({ editor, range, props }) => {
          // Text za kurzorem odštípneme do vlastního odstavce. Bez toho ho
          // obalující bloky (citace, callout) spolknou celý a vkládané uzly
          // ho nechají slepený za sebou.
          const $end = editor.state.doc.resolve(range.to);
          const rest = $end.parent.isTextblock
            ? $end.parent.textBetween($end.parentOffset, $end.parent.content.size)
            : "";
          // `splitBlock` nechá kurzor v nově odštípnutém odstavci, takže ho
          // vracíme zpátky — jinak by se blok vytvořil z toho zbytku.
          if (rest.trim()) editor.chain().setTextSelection(range.to).splitBlock().setTextSelection(range.from).run();
          (props as SlashCommandItem).command({ editor, range });
        },
        items: ({ query }: { query: string }) =>
          SLASH_COMMAND_ITEMS.filter(
            (item) =>
              // Bloky vypnuté v Settings → Blocks se nenabízejí.
              !UseSettingsStore.getState().disabledBlocks.includes(item.title) &&
              item.title.toLowerCase().includes(query.toLowerCase()),
          ),
        render: () => {
          let component: ReactRenderer<SlashCommandMenuHandle>;
          let unmount: (() => void) | undefined;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              });
              unmount = props.mount(component.element as HTMLElement);
              // Plovoucí panel visí na <body> bez z-indexu, takže by ho
              // přebila každá lepkavá hlavička v dokumentu (to-do list má
              // z-20). Stejná vrstva jako Popover.
              (component.element as HTMLElement).style.zIndex = "250";
            },
            onUpdate: (props) => {
              component.updateProps({ items: props.items, command: props.command });
            },
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
      } satisfies Partial<SuggestionOptions<SlashCommandItem>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
