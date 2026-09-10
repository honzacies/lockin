import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { SLASH_COMMAND_ITEMS, type SlashCommandItem } from "./SlashCommandItems";
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
        command: ({ editor, range, props }) => {
          (props as SlashCommandItem).command({ editor, range });
        },
        items: ({ query }: { query: string }) =>
          SLASH_COMMAND_ITEMS.filter((item) =>
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
