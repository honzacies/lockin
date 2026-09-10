import type { Project } from "@/Types/Project";
import { UseDataStore } from "@/Store/UseDataStore";
import { UsePriorityStore } from "@/Store/UsePriorityStore";
import { BuildBlankDocument } from "./CreateDocument";

/** Creates a new Project plus its root document, persists both (via the
 * store's self-saving Upsert actions), and returns the project so the
 * caller can navigate to it. */
export function CreateNewProject(): Project {
  const now = new Date().toISOString();
  const projectId = `proj-${Date.now()}`;
  const rootDocumentId = `doc-${Date.now()}-root`;
  const { priorities, statuses } = UsePriorityStore.getState();

  const project: Project = {
    id: projectId,
    name: "Untitled",
    tag: "",
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

  const rootDocument = BuildBlankDocument(rootDocumentId, projectId);

  UseDataStore.getState().UpsertProject(project);
  UseDataStore.getState().UpsertDocument(rootDocument);

  return project;
}
