import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { TodoListConfig } from "@lockin/shared/Types/QuickNotes";
import { DEFAULT_TODO_LIST_STYLE } from "@lockin/shared/Types/QuickNotes";
import { TodoListNodeView } from "./TodoListNodeView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    richTodoList: {
      insertRichTodoList: () => ReturnType;
    };
  }
}

/** A fresh config for a newly-inserted document to-do list block. */
export function CreateEmptyTodoListConfig(): TodoListConfig {
  return {
    id: `doc-todo-${crypto.randomUUID()}`,
    title: "My To-Do List",
    deadline: null,
    deadlineTime: null,
    tasks: [],
    groups: [],
    style: DEFAULT_TODO_LIST_STYLE,
  };
}

/**
 * The rich to-do list block usable inside documents/projects — same visual
 * component as the Quick Notes to-do list (TodoListView), but its config
 * (title, tasks, style, deadline) lives entirely in this node's attrs so it
 * round-trips through the document's own Tiptap JSON.
 */
export const TodoListExtension = Node.create({
  name: "richTodoList",
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
            return JSON.parse(raw) as TodoListConfig;
          } catch {
            return null;
          }
        },
        renderHTML: (attributes: { config: TodoListConfig | null }) => {
          if (!attributes.config) return {};
          return { "data-config": JSON.stringify(attributes.config) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="rich-todo-list"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "rich-todo-list" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TodoListNodeView);
  },

  addCommands() {
    return {
      insertRichTodoList:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { config: CreateEmptyTodoListConfig() },
          }),
    };
  },
});
