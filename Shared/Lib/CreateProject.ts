import type { Project } from "@lockin/shared/Types/Project";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { BuildBlankDocument, NewDocumentId } from "./CreateDocument";

/** Creates a new Project plus its root document, persists both (via the
 * store's self-saving Upsert actions), and returns the project so the
 * caller can navigate to it. */
export function CreateNewProject(name = "Untitled", folder?: string | null): Project {
  const now = new Date().toISOString();
  const rootDocumentId = NewDocumentId(name, folder);
  // Ve vaultu se projekt při načtení pozná podle kořenového souboru
  // ("project:" + jeho ID) — stejné ID musí mít už od založení, jinak by
  // se po restartu jeho nastavení (priorita, stav…) nenašlo.
  const projectId = rootDocumentId.startsWith("md:") ? `project:${rootDocumentId}` : `proj-${crypto.randomUUID()}`;
  const { priorities, statuses } = UsePriorityStore.getState();

  const project: Project = {
    id: projectId,
    name,
    priority: priorities[0]?.id ?? "",
    status: statuses[0]?.id ?? "",
    progress: 0,
    deadline: null,
    deadlineTime: null,
    createdAt: now,
    lastEditedAt: now,
    rootDocumentId,
    documentIds: [],
    isFavorite: false,
    folderId: null,
    tagIds: [],
  };

  const rootDocument = { ...BuildBlankDocument(rootDocumentId, projectId), name };

  UseDataStore.getState().UpsertProject(project);
  UseDataStore.getState().UpsertDocument(rootDocument);

  return project;
}
