"use client";

import { useEffect, useState } from "react";
import { Tabs } from "@heroui/react";
import { Clock, Zap } from "lucide-react";
import { DocumentModeToolbar } from "@lockin/shared/Components/AppShell/DocumentModeToolbar";
import { DocumentCanvas } from "@lockin/shared/Components/DocumentView/DocumentCanvas";
import { TodoList } from "@lockin/shared/Components/QuickNotes/TodoList";
import { NotesList } from "@lockin/shared/Components/QuickNotes/NotesList";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseTodoStore } from "@lockin/shared/Store/UseTodoStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import type { DocumentMode } from "@lockin/shared/Types/Project";

const QUICK_NOTES_ID = "quick-notes";

export default function QuickNotesPage() {
  const mode = UseUiStore(
    (state) => state.documentModeByDocId[QUICK_NOTES_ID] ?? "text",
  );
  const setDocumentMode = UseUiStore((state) => state.SetDocumentMode);
  const isWide = UseUiStore((state) => state.isDocumentWide);
  const openTab = UseUiStore((state) => state.OpenTab);
  const sketchStrokes = UseDataStore((state) => state.quickNotesSketch);
  const sketchCanvas = UseDataStore((state) => state.quickNotesCanvas);
  const updateCanvas = UseDataStore((state) => state.UpdateQuickNotesCanvas);
  // Canvas Quick Notes je v persist storu — vykreslit až po jeho načtení, jinak by začal prázdný.
  const [persisted, setPersisted] = useState(() => UseDataStore.persist.hasHydrated());
  useEffect(() => UseDataStore.persist.onFinishHydration(() => setPersisted(true)), []);
  const todoLists = UseTodoStore((state) => state.lists);
  const RemoveTodoList = UseTodoStore((state) => state.RemoveList);

  useEffect(() => {
    openTab({ id: QUICK_NOTES_ID, title: "Quick Notes", href: "/QuickNotes" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tabs
      selectedKey={mode}
      onSelectionChange={(key) => setDocumentMode(QUICK_NOTES_ID, key as DocumentMode)}
      className="flex h-full flex-col"
    >
      <DocumentModeToolbar title="Quick Notes" />
      <div className={`min-h-0 flex-1 ${mode === "sketch" ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
        <Tabs.Panel id="text" className="flex flex-col items-center gap-8 px-[50px] pb-16 pt-8">
          <div className={`mx-auto flex w-full flex-col items-start gap-8 ${isWide ? "" : "max-w-[850px]"}`}>
            <div className="flex flex-col items-start gap-2.5">
              <div className="flex items-center gap-[5px] rounded-[60px] bg-[var(--lk-pill)] px-2.5 py-[5px]">
                <Clock size={20} strokeWidth={1.5} className="text-[var(--lk-text2)]" />
                <span className="text-sm text-[var(--lk-text2)]">Updated today</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Zap size={56} strokeWidth={1.5} className="text-black" />
                <p className="text-[40px] font-medium tracking-[-0.8px] select-none text-black">
                  Quick Notes
                </p>
              </div>
              <p className="text-[20px] leading-[32px] text-[var(--lk-text2)] select-none">
                A space to quickly dump your thoughts without creating a full
                document. Everything stays right here.
              </p>
            </div>

            {todoLists.length > 0 ? (
              <div className="flex w-full flex-col gap-4">
                {todoLists.map((list) => (
                  <TodoList
                    key={list.id}
                    listId={list.id}
                    onDelete={
                      todoLists.length > 1 ? () => RemoveTodoList(list.id) : undefined
                    }
                  />
                ))}
              </div>
            ) : null}
            <NotesList />
          </div>
        </Tabs.Panel>
        <Tabs.Panel id="sketch" className="flex min-h-0 flex-1 flex-col">
          {/* Stejný canvas jako v dokumentech; až po načtení, jinak by začal prázdný. */}
          {persisted ? (
            <DocumentCanvas sketch={{ strokes: sketchStrokes, canvas: sketchCanvas }} onChange={(sketch) => sketch.canvas && updateCanvas(sketch.canvas)} />
          ) : null}
        </Tabs.Panel>
      </div>
    </Tabs>
  );
}
