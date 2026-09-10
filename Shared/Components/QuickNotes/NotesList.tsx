"use client";

import { useRef, useState } from "react";
import { Button, Input } from "@heroui/react";
import { X } from "lucide-react";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";

export function NotesList() {
  const notes = UseDataStore((state) => state.notes);
  const updateNoteBody = UseDataStore((state) => state.UpdateNoteBody);
  const updateNoteHeading = UseDataStore((state) => state.UpdateNoteHeading);
  const addNote = UseDataStore((state) => state.AddNote);
  const removeNote = UseDataStore((state) => state.RemoveNote);
  const [draft, setDraft] = useState("");

  const groups = Array.from(new Set(notes.map((note) => note.group)));

  function HandleSubmit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    addNote(trimmed);
    setDraft("");
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") HandleSubmit();
        }}
        placeholder="Write a note and press Enter…"
        className="w-full bg-transparent ring-0 rounded-none shadow-none p-0 text-sm text-black outline-none placeholder:text-[#91918e]"
      />

      {groups.map((group) => (
        <div key={group} className="flex flex-col gap-4">
          <span className="px-1.5 py-0.5 text-sm text-[#91918e]">{group}</span>
          {notes
            .filter((note) => note.group === group)
            .map((note) => (
              <EditableNote
                key={note.id}
                heading={note.heading}
                body={note.body}
                onHeadingChange={(heading) => updateNoteHeading(note.id, heading)}
                onBodyChange={(body) => updateNoteBody(note.id, body)}
                onRemove={() => removeNote(note.id)}
              />
            ))}
        </div>
      ))}
    </div>
  );
}

interface EditableNoteProps {
  heading: string;
  body: string;
  onHeadingChange: (heading: string) => void;
  onBodyChange: (body: string) => void;
  onRemove: () => void;
}

function EditableNote({
  heading,
  body,
  onHeadingChange,
  onBodyChange,
  onRemove,
}: EditableNoteProps) {
  const headingRef = useRef<HTMLParagraphElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  return (
    <div className="group flex flex-col gap-2.5 py-2.5">
      <div className="flex items-center justify-between">
        <p
          ref={headingRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={() => onHeadingChange(headingRef.current?.textContent ?? "")}
          className="text-2xl font-bold text-black outline-none"
        >
          {heading}
        </p>
        <Button
          variant="ghost"
          isIconOnly
          onPress={onRemove}
          aria-label="Remove note"
          className="h-auto w-auto shrink-0 rounded p-1 text-[#c9c8c4] opacity-0 hover:bg-black/[0.06] hover:text-[#e5484d] group-hover:opacity-100"
        >
          <X size={14} strokeWidth={1.75} />
        </Button>
      </div>
      <p
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={() => onBodyChange(bodyRef.current?.textContent ?? "")}
        className="text-[16px] leading-[24px] text-black outline-none"
      >
        {body}
      </p>
    </div>
  );
}
