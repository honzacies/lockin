"use client";

import { useRouter } from "next/navigation";
import { FileText, Folder, Hash, Rocket, Shapes, type LucideIcon } from "lucide-react";
import { ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { CreateNewDocument } from "@lockin/shared/Lib/CreateDocument";
import { CreateNewProject } from "@lockin/shared/Lib/CreateProject";

export interface CreateAction {
  id: "document" | "project" | "canvas" | "folder" | "tag";
  label: string;
  description: string;
  icon: LucideIcon;
  /** Vytvoří věc a vrátí, kam ji otevřít. */
  Create: () => string;
}

/** Všechno, co jde v LockInu vytvořit — sidebar „New", pravý klik do sidebaru, prázdný workspace. */
export const CREATE_ACTIONS: CreateAction[] = [
  {
    id: "document",
    label: "Document",
    description: "A page for notes, with any blocks you like.",
    icon: FileText,
    Create: () => `/Document?id=${encodeURIComponent(CreateNewDocument().id)}`,
  },
  {
    id: "project",
    label: "Project",
    description: "Status, priority, deadline and its own documents.",
    icon: Rocket,
    Create: () => `/YourProjects/Project?id=${encodeURIComponent(CreateNewProject().id)}`,
  },
  {
    id: "canvas",
    label: "Canvas",
    description: "An infinite board for cards, links and sketches.",
    icon: Shapes,
    Create: () => "/Canvas",
  },
  {
    id: "folder",
    label: "Folder",
    description: "Group documents and projects in the Library.",
    icon: Folder,
    Create: () => `/Library?folderId=${encodeURIComponent(UseDataStore.getState().AddFolder().id)}`,
  },
  {
    id: "tag",
    label: "Tag",
    description: "Label anything across folders.",
    icon: Hash,
    Create: () => `/Library?tagId=${encodeURIComponent(UseDataStore.getState().AddTag().id)}`,
  },
];

/** Položky menu „vytvořit…" pro Popover i ContextMenu. */
export function CreateMenuItems({ close }: { close: () => void }) {
  const router = useRouter();
  return (
    <>
      <ContextMenuLabel first>Create new</ContextMenuLabel>
      {CREATE_ACTIONS.map((action) => (
        <ContextMenuItem
          key={action.id}
          icon={<action.icon size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />}
          onClick={() => {
            close();
            router.push(action.Create());
          }}
        >
          {action.label}
        </ContextMenuItem>
      ))}
    </>
  );
}
