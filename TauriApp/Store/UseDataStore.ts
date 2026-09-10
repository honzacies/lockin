import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DocumentRecord, DocumentTheme, Project, SketchStroke } from "@/Types/Project";
import { DEFAULT_TAG_COLOR, type LibraryFolder, type LibraryTag } from "@/Types/Library";
import type { NoteBlock } from "@/Types/QuickNotes";
import { SaveProject, SaveDocument, DeleteDocument, DeleteProject } from "@/Lib/Storage";
import { CreateTauriStorage } from "./TauriStorage";

interface DataState {
  /** Hydrated from disk on boot (Lib/Storage.ts manifest) — not part of the
   * persist middleware below, since each project/document is its own file. */
  projects: Record<string, Project>;
  documents: Record<string, DocumentRecord>;
  /** True once the initial disk load (Lib/Storage.ts) has completed — lets
   * pages tell "still loading" apart from "genuinely missing" data. */
  hydrated: boolean;
  /** Lightweight collections — persisted as one blob via the middleware. */
  folders: Record<string, LibraryFolder>;
  tags: Record<string, LibraryTag>;
  notes: NoteBlock[];
  quickNotesSketch: SketchStroke[];

  HydrateProjectsAndDocuments: (projects: Project[], documents: DocumentRecord[]) => void;
  UpsertProject: (project: Project) => void;
  UpsertDocument: (doc: DocumentRecord) => void;
  AddDocumentToProject: (projectId: string, doc: DocumentRecord) => void;
  RemoveProject: (projectId: string) => void;
  ToggleDocumentFavorite: (docId: string) => void;
  RemoveDocument: (docId: string) => void;
  RenameDocument: (docId: string, name: string) => void;
  SetDocumentIcon: (docId: string, icon: string | undefined) => void;
  SetDocumentFolder: (docId: string, folderId: string | null) => void;
  ToggleDocumentTag: (docId: string, tagId: string) => void;
  DuplicateDocument: (docId: string) => DocumentRecord | null;
  ToggleDocumentLocked: (docId: string) => void;
  ToggleDocumentSmallText: (docId: string) => void;
  ToggleDocumentTableOfContents: (docId: string) => void;
  SetDocumentTheme: (docId: string, theme: DocumentTheme | undefined) => void;
  RenameProject: (projectId: string, name: string) => void;
  SetProjectIcon: (projectId: string, icon: string | undefined) => void;
  ToggleProjectFavorite: (projectId: string) => void;
  SetProjectFolder: (projectId: string, folderId: string | null) => void;
  ToggleProjectTag: (projectId: string, tagId: string) => void;

  AddFolder: () => LibraryFolder;
  RenameFolder: (folderId: string, name: string) => void;
  RemoveFolder: (folderId: string) => void;
  ToggleFolderFavorite: (folderId: string) => void;
  SetFolderIcon: (folderId: string, icon: string | undefined) => void;

  AddTag: () => LibraryTag;
  RenameTag: (tagId: string, name: string) => void;
  RemoveTag: (tagId: string) => void;
  ToggleTagFavorite: (tagId: string) => void;
  SetTagIcon: (tagId: string, icon: string | undefined) => void;
  SetTagColor: (tagId: string, color: string) => void;

  AddNote: (heading?: string) => void;
  UpdateNoteHeading: (noteId: string, heading: string) => void;
  UpdateNoteBody: (noteId: string, body: string) => void;
  RemoveNote: (noteId: string) => void;
  UpdateQuickNotesSketch: (strokes: SketchStroke[]) => void;
}

function ToRecord<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export const UseDataStore = create<DataState>()(
  persist(
    (set, get) => {
      // Every document/project mutation below follows the same shape: load
      // the current record, bail if it's gone, apply a patch, write it back
      // to both the store and disk. These two helpers are that shape once,
      // shared by every action that isn't a plain overwrite (Upsert*) or a
      // genuinely multi-entity change (RemoveProject's cascade, DuplicateDocument).
      function PatchDocument(
        docId: string,
        patch: (doc: DocumentRecord) => DocumentRecord,
      ): DocumentRecord | null {
        const doc = get().documents[docId];
        if (!doc) return null;
        const updated = patch(doc);
        set((state) => ({ documents: { ...state.documents, [docId]: updated } }));
        SaveDocument(updated).catch((error) => console.warn("SaveDocument failed", error));
        return updated;
      }

      function PatchProject(
        projectId: string,
        patch: (project: Project) => Project,
      ): Project | null {
        const project = get().projects[projectId];
        if (!project) return null;
        const updated = patch(project);
        set((state) => ({ projects: { ...state.projects, [projectId]: updated } }));
        SaveProject(updated).catch((error) => console.warn("SaveProject failed", error));
        return updated;
      }

      return {
        projects: {},
        documents: {},
        hydrated: false,
        folders: {},
        tags: {},
        notes: [],
        quickNotesSketch: [],

        HydrateProjectsAndDocuments: (projects, documents) =>
          set({ projects: ToRecord(projects), documents: ToRecord(documents), hydrated: true }),

        UpsertProject: (project) => {
          set((state) => ({ projects: { ...state.projects, [project.id]: project } }));
          SaveProject(project).catch((error) => console.warn("SaveProject failed", error));
        },
        UpsertDocument: (doc) => {
          set((state) => ({ documents: { ...state.documents, [doc.id]: doc } }));
          SaveDocument(doc).catch((error) => console.warn("SaveDocument failed", error));
        },
        AddDocumentToProject: (projectId, doc) => {
          if (!get().projects[projectId]) return;
          set((state) => ({ documents: { ...state.documents, [doc.id]: doc } }));
          SaveDocument(doc).catch((error) => console.warn("SaveDocument failed", error));
          PatchProject(projectId, (project) => ({
            ...project,
            documentIds: [...project.documentIds, doc.id],
          }));
        },
        // Deleting a project used to only remove the project record itself —
        // its root document (the project's actual "main content") and every
        // sub-document stayed behind, orphaned in both the store and on disk,
        // pointing at a projectId that no longer existed. A project delete
        // now cascades to all of that, matching "delete the whole project".
        RemoveProject: (projectId) => {
          const project = get().projects[projectId];
          const docIdsToRemove = project ? [project.rootDocumentId, ...project.documentIds] : [];
          set((state) => {
            const projects = { ...state.projects };
            delete projects[projectId];
            const documents = { ...state.documents };
            for (const docId of docIdsToRemove) delete documents[docId];
            return { projects, documents };
          });
          DeleteProject(projectId).catch((error) => console.warn("DeleteProject failed", error));
          for (const docId of docIdsToRemove) {
            DeleteDocument(docId).catch((error) => console.warn("DeleteDocument failed", error));
          }
        },
        ToggleDocumentFavorite: (docId) => {
          PatchDocument(docId, (doc) => ({ ...doc, isFavorite: !doc.isFavorite }));
        },
        RemoveDocument: (docId) => {
          set((state) => {
            const documents = { ...state.documents };
            delete documents[docId];
            return { documents };
          });
          DeleteDocument(docId).catch((error) => console.warn("DeleteDocument failed", error));
        },
        RenameDocument: (docId, name) => {
          PatchDocument(docId, (doc) => ({ ...doc, name, updatedAt: new Date().toISOString() }));
        },
        SetDocumentIcon: (docId, icon) => {
          PatchDocument(docId, (doc) => ({ ...doc, icon }));
        },
        SetDocumentFolder: (docId, folderId) => {
          PatchDocument(docId, (doc) => ({ ...doc, folderId }));
        },
        ToggleDocumentTag: (docId, tagId) => {
          PatchDocument(docId, (doc) => ({
            ...doc,
            tagIds: doc.tagIds.includes(tagId)
              ? doc.tagIds.filter((id) => id !== tagId)
              : [...doc.tagIds, tagId],
          }));
        },
        DuplicateDocument: (docId) => {
          const source = get().documents[docId];
          if (!source) return null;
          const now = new Date().toISOString();
          const copy: DocumentRecord = {
            ...source,
            id: `doc-${Date.now()}`,
            name: `${source.name || "Untitled"} - Copy`,
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            // A duplicate of a project's root document is still a plain
            // sub-document — the root slot itself is tracked separately via
            // Project.rootDocumentId and stays unique per project.
          };
          set((state) => ({ documents: { ...state.documents, [copy.id]: copy } }));
          SaveDocument(copy).catch((error) => console.warn("SaveDocument failed", error));
          if (copy.projectId) {
            PatchProject(copy.projectId, (project) => ({
              ...project,
              documentIds: [...project.documentIds, copy.id],
            }));
          }
          return copy;
        },
        ToggleDocumentLocked: (docId) => {
          PatchDocument(docId, (doc) => ({ ...doc, isLocked: !doc.isLocked }));
        },
        ToggleDocumentSmallText: (docId) => {
          PatchDocument(docId, (doc) => ({ ...doc, smallText: !doc.smallText }));
        },
        ToggleDocumentTableOfContents: (docId) => {
          PatchDocument(docId, (doc) => ({
            ...doc,
            showTableOfContents: !doc.showTableOfContents,
          }));
        },
        SetDocumentTheme: (docId, theme) => {
          PatchDocument(docId, (doc) => ({ ...doc, theme }));
        },
        RenameProject: (projectId, name) => {
          const project = PatchProject(projectId, (p) => ({
            ...p,
            name,
            lastEditedAt: new Date().toISOString(),
          }));
          if (!project) return;

          // The root document IS the project — keep its name in sync (see
          // app/YourProjects/Project/page.tsx's HandleUpdateProject for why).
          PatchDocument(project.rootDocumentId, (doc) => ({ ...doc, name }));
        },
        SetProjectIcon: (projectId, icon) => {
          PatchProject(projectId, (project) => ({ ...project, icon }));
        },
        ToggleProjectFavorite: (projectId) => {
          PatchProject(projectId, (project) => ({ ...project, isFavorite: !project.isFavorite }));
        },
        SetProjectFolder: (projectId, folderId) => {
          PatchProject(projectId, (project) => ({ ...project, folderId }));
        },
        ToggleProjectTag: (projectId, tagId) => {
          PatchProject(projectId, (project) => ({
            ...project,
            tagIds: project.tagIds.includes(tagId)
              ? project.tagIds.filter((id) => id !== tagId)
              : [...project.tagIds, tagId],
          }));
        },

        // Folders/tags/notes below persist via the middleware's `partialize`
        // at the bottom of this file (one blob file, written automatically on
        // every change) rather than the explicit Save*/manifest calls
        // projects and documents use above — intentional, not an oversight:
        // they're small collections where batched-blob storage is simpler and
        // sufficient, unlike per-file projects/documents which each need their
        // own file and a manifest to enumerate them.
        AddFolder: () => {
          const now = new Date().toISOString();
          const folder: LibraryFolder = {
            id: `folder-${Date.now()}`,
            name: "New folder",
            description: "",
            isFavorite: false,
            createdAt: now,
            updatedAt: now,
          };
          set((state) => ({ folders: { ...state.folders, [folder.id]: folder } }));
          return folder;
        },
        RenameFolder: (folderId, name) =>
          set((state) => {
            const folder = state.folders[folderId];
            if (!folder) return state;
            return {
              folders: {
                ...state.folders,
                [folderId]: { ...folder, name, updatedAt: new Date().toISOString() },
              },
            };
          }),
        RemoveFolder: (folderId) =>
          set((state) => {
            const folders = { ...state.folders };
            delete folders[folderId];
            return { folders };
          }),
        ToggleFolderFavorite: (folderId) =>
          set((state) => {
            const folder = state.folders[folderId];
            if (!folder) return state;
            return {
              folders: {
                ...state.folders,
                [folderId]: { ...folder, isFavorite: !folder.isFavorite },
              },
            };
          }),
        SetFolderIcon: (folderId, icon) =>
          set((state) => {
            const folder = state.folders[folderId];
            if (!folder) return state;
            return { folders: { ...state.folders, [folderId]: { ...folder, icon } } };
          }),

        AddTag: () => {
          const now = new Date().toISOString();
          const tag: LibraryTag = {
            id: `tag-${Date.now()}`,
            name: "New tag",
            description: "",
            isFavorite: false,
            createdAt: now,
            updatedAt: now,
            color: DEFAULT_TAG_COLOR,
          };
          set((state) => ({ tags: { ...state.tags, [tag.id]: tag } }));
          return tag;
        },
        RenameTag: (tagId, name) =>
          set((state) => {
            const tag = state.tags[tagId];
            if (!tag) return state;
            return {
              tags: {
                ...state.tags,
                [tagId]: { ...tag, name, updatedAt: new Date().toISOString() },
              },
            };
          }),
        RemoveTag: (tagId) =>
          set((state) => {
            const tags = { ...state.tags };
            delete tags[tagId];
            return { tags };
          }),
        ToggleTagFavorite: (tagId) =>
          set((state) => {
            const tag = state.tags[tagId];
            if (!tag) return state;
            return { tags: { ...state.tags, [tagId]: { ...tag, isFavorite: !tag.isFavorite } } };
          }),
        SetTagIcon: (tagId, icon) =>
          set((state) => {
            const tag = state.tags[tagId];
            if (!tag) return state;
            return { tags: { ...state.tags, [tagId]: { ...tag, icon } } };
          }),
        SetTagColor: (tagId, color) =>
          set((state) => {
            const tag = state.tags[tagId];
            if (!tag) return state;
            return { tags: { ...state.tags, [tagId]: { ...tag, color } } };
          }),

        AddNote: (heading) =>
          set((state) => ({
            notes: [
              ...state.notes,
              { id: `note-${Date.now()}`, group: "Today", heading: heading || "New note", body: "" },
            ],
          })),
        UpdateNoteHeading: (noteId, heading) =>
          set((state) => ({
            notes: state.notes.map((note) => (note.id === noteId ? { ...note, heading } : note)),
          })),
        UpdateNoteBody: (noteId, body) =>
          set((state) => ({
            notes: state.notes.map((note) => (note.id === noteId ? { ...note, body } : note)),
          })),
        RemoveNote: (noteId) =>
          set((state) => ({ notes: state.notes.filter((note) => note.id !== noteId) })),
        UpdateQuickNotesSketch: (strokes) => set({ quickNotesSketch: strokes }),
      };
    },
    {
      name: "lockin-library-quicknotes",
      storage: createJSONStorage(() => CreateTauriStorage("library-quicknotes.json")),
      skipHydration: true,
      partialize: (state) => ({
        folders: state.folders,
        tags: state.tags,
        notes: state.notes,
        quickNotesSketch: state.quickNotesSketch,
      }),
    },
  ),
);
