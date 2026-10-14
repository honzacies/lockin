"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Plus, RotateCcw, Trash2, Zap } from "@lockin/shared/Components/Shared/UiIcons";
import { NewFlashcard, type Flashcard, type FlashcardSetConfig } from "@lockin/shared/Types/Flashcards";
import { CreateFlashcardSet } from "./FlashcardsExtension";

const ROW_INPUT =
  "min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-[15px] outline-none hover:bg-black/[0.03] focus:bg-black/[0.03]";

/** Zkoušení: fronta zbývajících karet, „znovu" vrací kartu na konec kola. */
interface Round {
  queue: Flashcard[];
  flipped: boolean;
  total: number;
  firstTry: number;
}

export function FlashcardsNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const config: FlashcardSetConfig = node.attrs.config ?? CreateFlashcardSet();
  const cards = config.cards ?? [];
  const editable = editor.isEditable;
  const [round, setRound] = useState<Round | null>(null);

  const Patch = (patch: Partial<FlashcardSetConfig>) => updateAttributes({ config: { ...config, ...patch } });
  const SetCard = (id: string, patch: Partial<Flashcard>) =>
    Patch({ cards: cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  function Start() {
    const usable = cards.filter((c) => c.front.trim() || c.back.trim());
    if (!usable.length) return;
    setRound({ queue: usable, flipped: false, total: usable.length, firstTry: 0 });
  }

  /** `known` = uživatel ji uměl; jinak jde karta na konec fronty. */
  function Answer(known: boolean) {
    setRound((r) => {
      if (!r) return r;
      const [current, ...rest] = r.queue;
      return {
        ...r,
        flipped: false,
        queue: known ? rest : [...rest, current],
        firstTry: known && r.queue.length + r.firstTry === r.total ? r.firstTry + 1 : r.firstTry,
      };
    });
  }

  if (round) {
    const card = round.queue[0];
    const done = round.total - round.queue.length;
    return (
      <NodeViewWrapper className="my-2">
        <div className="rounded-xl border border-[var(--lk-line)] bg-[var(--lk-panel)] p-3" contentEditable={false}>
          <div className="mb-3 flex items-center gap-2">
            <p className="flex-1 truncate text-[15px] font-medium text-[var(--lk-ink)]">{config.title || "Flashcards"}</p>
            <span className="text-[13px] text-[var(--lk-muted)] tabular-nums">
              {done} / {round.total}
            </span>
            <button type="button" onClick={() => setRound(null)} className="rounded-md px-2 py-0.5 text-[13px] text-[var(--lk-text2)] hover:bg-black/[0.05]">
              Close
            </button>
          </div>

          {card ? (
            <>
              <button
                type="button"
                onClick={() => setRound((r) => (r ? { ...r, flipped: !r.flipped } : r))}
                className="flex min-h-[120px] w-full items-center justify-center rounded-lg border border-[var(--lk-line)] bg-[var(--lk-bg)] px-4 py-6 text-center text-[17px] text-[var(--lk-text)] hover:border-[#0088ff]/40"
              >
                {round.flipped ? card.back || "—" : card.front || "—"}
              </button>
              <p className="mt-1.5 text-center text-[12px] text-[var(--lk-faint)]">
                {round.flipped ? "Answer" : "Click the card to flip it"}
              </p>
              {round.flipped ? (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => Answer(false)}
                    className="flex-1 rounded-lg border border-[var(--lk-line)] py-1.5 text-[14px] text-[var(--lk-text2)] hover:bg-black/[0.04]"
                  >
                    Again
                  </button>
                  <button
                    type="button"
                    onClick={() => Answer(true)}
                    className="flex-1 rounded-lg bg-[#0088ff] py-1.5 text-[14px] font-medium text-white hover:bg-[#0077e0]"
                  >
                    Got it
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6">
              <Check size={28} className="text-[#30a46c]" />
              <p className="text-[15px] text-[var(--lk-ink)]">
                Done — {round.firstTry} of {round.total} on the first try.
              </p>
              <button type="button" onClick={Start} className="flex items-center gap-1.5 rounded-lg border border-[var(--lk-line)] px-2.5 py-1 text-[14px] text-[var(--lk-text2)] hover:bg-black/[0.04]">
                <RotateCcw size={14} /> Again
              </button>
            </div>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="my-2">
      <div className="rounded-xl border border-[var(--lk-line)] bg-[var(--lk-panel)] p-3" contentEditable={false}>
        <div className="mb-2 flex items-center gap-2">
          <input
            value={config.title}
            readOnly={!editable}
            onChange={(e) => Patch({ title: e.target.value })}
            placeholder="Flashcards"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[var(--lk-ink)] outline-none"
          />
          <span className="text-[13px] text-[var(--lk-muted)] tabular-nums">{cards.length}</span>
          <button
            type="button"
            onClick={Start}
            disabled={!cards.some((c) => c.front.trim() || c.back.trim())}
            className="flex items-center gap-1.5 rounded-lg bg-[#0088ff] px-2.5 py-1 text-[14px] font-medium text-white hover:bg-[#0077e0] disabled:opacity-40"
          >
            <Zap size={14} /> Practice
          </button>
        </div>

        <div className="flex flex-col">
          {cards.map((card) => (
            <div key={card.id} className="group/card flex items-center gap-1 border-t border-[var(--lk-line)] py-0.5 first:border-t-0">
              <input
                value={card.front}
                readOnly={!editable}
                onChange={(e) => SetCard(card.id, { front: e.target.value })}
                placeholder="Question"
                className={ROW_INPUT}
              />
              <span className="shrink-0 text-[var(--lk-faint)]">·</span>
              <input
                value={card.back}
                readOnly={!editable}
                onChange={(e) => SetCard(card.id, { back: e.target.value })}
                placeholder="Answer"
                className={`${ROW_INPUT} text-[var(--lk-text2)]`}
              />
              {editable ? (
                <button
                  type="button"
                  onClick={() => Patch({ cards: cards.filter((c) => c.id !== card.id) })}
                  className="shrink-0 rounded-md p-1 text-[var(--lk-faint)] opacity-0 hover:bg-[#e5484d]/[0.08] hover:text-[#e5484d] group-hover/card:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {editable ? (
          <button
            type="button"
            onClick={() => Patch({ cards: [...cards, NewFlashcard()] })}
            className="mt-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[14px] text-[var(--lk-muted)] hover:bg-black/[0.03]"
          >
            <Plus size={14} /> Add card
          </button>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
