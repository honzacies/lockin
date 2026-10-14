/** Sada kartiček v dokumentu — otázka na jedné straně, odpověď na druhé. */
export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardSetConfig {
  id: string;
  title: string;
  cards: Flashcard[];
}

export function NewFlashcard(): Flashcard {
  return { id: `card-${crypto.randomUUID()}`, front: "", back: "" };
}

export const DEFAULT_FLASHCARDS: Omit<FlashcardSetConfig, "id"> = {
  title: "Flashcards",
  cards: [],
};
