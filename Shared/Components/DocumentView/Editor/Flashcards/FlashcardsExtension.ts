import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DEFAULT_FLASHCARDS, NewFlashcard, type FlashcardSetConfig } from "@lockin/shared/Types/Flashcards";
import { FlashcardsNodeView } from "./FlashcardsNodeView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    flashcards: {
      insertFlashcards: () => ReturnType;
    };
  }
}

export function CreateFlashcardSet(): FlashcardSetConfig {
  return { id: `flashcards-${crypto.randomUUID()}`, ...DEFAULT_FLASHCARDS, cards: [NewFlashcard(), NewFlashcard()] };
}

/**
 * Kartičky na učení. Celá sada žije v atributech uzlu jako u to-do listu,
 * takže se veze s dokumentem (i do `.md` jako `{lockin.flashcards …}`).
 * Zkoušení je jen stav komponenty — co uživatel umí, se nikam neukládá,
 * každé spuštění začíná nanovo.
 */
export const FlashcardsExtension = Node.create({
  name: "flashcards",
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
            return JSON.parse(raw) as FlashcardSetConfig;
          } catch {
            return null;
          }
        },
        renderHTML: (attributes: { config: FlashcardSetConfig | null }) =>
          attributes.config ? { "data-config": JSON.stringify(attributes.config) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="flashcards"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "flashcards" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FlashcardsNodeView);
  },

  addCommands() {
    return {
      insertFlashcards:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { config: CreateFlashcardSet() } }),
    };
  },
});
