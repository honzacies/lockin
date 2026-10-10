"use client";

import { ProjectUpdatedAt } from "@lockin/shared/Lib/CreateProject";
import { UseFadeOnChange } from "@lockin/shared/Lib/UseMotion";
import { EmptyWorkspace, UseIsWorkspaceEmpty } from "@lockin/shared/Components/AppShell/EmptyWorkspace";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Library } from "@lockin/shared/Components/Shared/UiIcons";
import { LibraryFilters } from "@lockin/shared/Components/Library/LibraryFilters";
import { LibraryTable } from "@lockin/shared/Components/Library/LibraryTable";
import { LibraryTableSkeleton } from "@lockin/shared/Components/Library/LibraryTableSkeleton";
import { StandaloneDocumentEditor } from "@lockin/shared/Components/DocumentView/StandaloneDocumentEditor";
import { ProjectView } from "@lockin/shared/Components/ProjectView/ProjectView";
import { ResizableSidePanel } from "@lockin/shared/Components/Shared/ResizableSidePanel";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { CreateNewProject } from "@lockin/shared/Lib/CreateProject";
import { CreateNewDocument, BuildBlankDocument, NewDocumentId } from "@lockin/shared/Lib/CreateDocument";
import type { LibraryFilter } from "@lockin/shared/Types/LibraryFilter";
import type { LibraryRow, LibrarySource } from "@lockin/shared/Types/LibraryRow";
import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";

const RECENTS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function IsRecent(isoDate: string): boolean {
  return Date.now() - new Date(isoDate).getTime() <= RECENTS_WINDOW_MS;
}

function LibraryPageContent() {
  const searchParams = useSearchParams();
  const openTab = UseUiStore((state) => state.OpenTab);
  const workspaceEmpty = UseIsWorkspaceEmpty();
  const documents = UseDataStore((state) => state.documents);
  const projects = UseDataStore((state) => state.projects);
  const folders = UseDataStore((state) => state.folders);
  const tags = UseDataStore((state) => state.tags);
  const hydrated = UseDataStore((state) => state.hydrated);
  const [filter, setFilter] = useState<LibraryFilter | null>(() => {
    const folderId = searchParams.get("folderId");
    const tagId = searchParams.get("tagId");
    const quickFilter = searchParams.get("filter");
    if (folderId) return { kind: "folder", id: folderId };
    if (tagId) return { kind: "tag", id: tagId };
    if (quickFilter === "folder-all") return { kind: "folder-all" };
    if (quickFilter === "tag-all") return { kind: "tag-all" };
    return null;
  });
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  UseFadeOnChange(tableRef, [JSON.stringify(filter)]);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [projectActiveDocumentId, setProjectActiveDocumentId] = useState<string | null>(null);
  const upsertProject = UseDataStore((state) => state.UpsertProject);
  const upsertDocument = UseDataStore((state) => state.UpsertDocument);
  const addDocumentToProject = UseDataStore((state) => state.AddDocumentToProject);

  useEffect(() => {
    openTab({ id: "library", title: "Library", href: "/Library" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const allDocuments = Object.values(documents);
    const allProjects = Object.values(projects);
    const allFolders = Object.values(folders);
    const allTags = Object.values(tags);

    // Filtr projektů ukazuje projekty, ne jejich dokumenty.
    const showDocuments = filter === null || (!filter.kind.endsWith("-all") && filter.kind !== "project");
    const documentRows: LibraryRow[] = showDocuments
      ? allDocuments
          .filter((doc) => {
            // A project's root document IS the project — it's already
            // represented by the project row below, so listing it again as
            // a bare "Untitled" document row would just be a duplicate.
            if (doc.projectId && projects[doc.projectId]?.rootDocumentId === doc.id) return false;
            if (filter === null) return true;
            if (filter.kind === "recents") return IsRecent(doc.updatedAt);
            if (filter.kind === "favorites") return doc.isFavorite;
            if (filter.kind === "folder") return doc.folderId === filter.id;
            if (filter.kind === "tag") return doc.tagIds.includes(filter.id);
            return true;
          })
          .map((doc) => {
            const sources: LibrarySource[] = [];
            if (doc.folderId && folders[doc.folderId]) {
              sources.push({ kind: "folder", label: folders[doc.folderId].name });
            }
            for (const tagId of doc.tagIds) {
              if (tags[tagId]) {
                sources.push({ kind: "tag", label: tags[tagId].name, color: tags[tagId].color });
              }
            }
            if (doc.projectId && projects[doc.projectId]) {
              sources.push({ kind: "project", label: projects[doc.projectId].name });
            }
            return {
              kind: "document" as const,
              id: doc.id,
              name: doc.name,
              description: doc.description,
              sources,
              sizeLabel: FormatBytes(new Blob([JSON.stringify(doc.text.json), JSON.stringify(doc.sketch)]).size),
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt,
              isFavorite: doc.isFavorite,
              icon: doc.icon,
            };
          })
      : [];

    const showFolders =
      filter === null || filter.kind === "recents" || filter.kind === "favorites" || filter.kind === "folder-all";
    const folderRows: LibraryRow[] = showFolders
      ? allFolders
          .filter((folder) => {
            if (filter?.kind === "favorites") return folder.isFavorite;
            if (filter?.kind === "recents") return IsRecent(folder.updatedAt);
            return true;
          })
          .map((folder) => ({
            kind: "folder" as const,
            id: folder.id,
            name: folder.name,
            description: folder.description,
            sources: [],
            sizeLabel: `${
              allDocuments.filter((doc) => doc.folderId === folder.id).length +
              allProjects.filter((project) => project.folderId === folder.id).length
            } items`,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
            isFavorite: folder.isFavorite,
            icon: folder.icon,
          }))
      : [];

    const showTags =
      filter === null || filter.kind === "recents" || filter.kind === "favorites" || filter.kind === "tag-all";
    const tagRows: LibraryRow[] = showTags
      ? allTags
          .filter((tag) => {
            if (filter?.kind === "favorites") return tag.isFavorite;
            if (filter?.kind === "recents") return IsRecent(tag.updatedAt);
            return true;
          })
          .map((tag) => ({
            kind: "tag" as const,
            id: tag.id,
            name: tag.name,
            description: tag.description,
            sources: [],
            sizeLabel: `${
              allDocuments.filter((doc) => doc.tagIds.includes(tag.id)).length +
              allProjects.filter((project) => project.tagIds.includes(tag.id)).length
            } items`,
            createdAt: tag.createdAt,
            updatedAt: tag.updatedAt,
            isFavorite: tag.isFavorite,
            icon: tag.icon,
            color: tag.color,
          }))
      : [];

    const showProjects =
      filter === null ||
      filter.kind === "recents" ||
      filter.kind === "favorites" ||
      filter.kind === "project-all" ||
      filter.kind === "project" ||
      filter.kind === "folder" ||
      filter.kind === "tag";
    const projectRows: LibraryRow[] = showProjects
      ? allProjects
          .filter((project) => {
            if (filter?.kind === "recents") return IsRecent(ProjectUpdatedAt(project, documents));
            if (filter?.kind === "favorites") return project.isFavorite;
            if (filter?.kind === "folder") return project.folderId === filter.id;
            if (filter?.kind === "tag") return project.tagIds.includes(filter.id);
            if (filter?.kind === "project") {
              return filter.status ? project.status === filter.status : project.priority === filter.priority;
            }
            return true;
          })
          .map((project) => {
            const sources: LibrarySource[] = [];
            if (project.folderId && folders[project.folderId]) {
              sources.push({ kind: "folder", label: folders[project.folderId].name });
            }
            for (const tagId of project.tagIds) {
              if (tags[tagId]) {
                sources.push({ kind: "tag", label: tags[tagId].name, color: tags[tagId].color });
              }
            }
            return {
              kind: "project" as const,
              id: project.id,
              name: project.name,
              description: allDocuments.find((doc) => doc.id === project.rootDocumentId)?.description ?? "",
              sources,
              sizeLabel: `${project.documentIds.length + 1} items`,
              createdAt: project.createdAt,
              updatedAt: ProjectUpdatedAt(project, documents),
              isFavorite: project.isFavorite,
              icon: project.icon,
            };
          })
      : [];

    return [...documentRows, ...folderRows, ...tagRows, ...projectRows].sort((a, b) =>
      a.updatedAt < b.updatedAt ? 1 : -1,
    );
  }, [documents, projects, folders, tags, filter]);

  function HandleOpenRow(row: LibraryRow) {
    if (row.kind === "document") {
      setOpenDocumentId(row.id);
      setOpenProjectId(null);
      return;
    }
    if (row.kind === "project") {
      setOpenProjectId(row.id);
      setProjectActiveDocumentId(null);
      setOpenDocumentId(null);
      return;
    }
    if (row.kind === "folder") {
      setFilter({ kind: "folder", id: row.id });
      return;
    }
    setFilter({ kind: "tag", id: row.id });
  }

  function HandleCreateProject() {
    const project = CreateNewProject();
    setOpenProjectId(project.id);
    setProjectActiveDocumentId(null);
    setOpenDocumentId(null);
  }

  function HandleCreateDocument() {
    const doc = CreateNewDocument();
    setOpenDocumentId(doc.id);
    setOpenProjectId(null);
  }

  const openDocument = openDocumentId ? documents[openDocumentId] : undefined;

  const openProject = openProjectId ? projects[openProjectId] : undefined;
  const openProjectActiveDocument = openProject
    ? (documents[projectActiveDocumentId ?? openProject.rootDocumentId] ??
      documents[openProject.rootDocumentId])
    : undefined;
  const openProjectSubDocuments = openProject
    ? openProject.documentIds
        .map((id) => documents[id])
        .filter((doc): doc is DocumentRecord => Boolean(doc))
    : [];

  function HandleUpdateOpenProject(patch: Partial<Project>) {
    if (!openProject) return;
    const next: Project = { ...openProject, ...patch, lastEditedAt: new Date().toISOString() };
    upsertProject(next);
    // The root document IS the project — keep its name in sync (see
    // app/YourProjects/Project/page.tsx's HandleUpdateProject for why).
    if (patch.name !== undefined) {
      const rootDocument = documents[next.rootDocumentId];
      if (rootDocument) upsertDocument({ ...rootDocument, name: patch.name });
    }
  }

  function HandleAddDocumentToOpenProject() {
    if (!openProject) return;
    const doc = BuildBlankDocument(NewDocumentId("Untitled"), openProject.id);
    addDocumentToProject(openProject.id, doc);
    setProjectActiveDocumentId(doc.id);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-[50px] pt-6 pb-6">
        <div className="flex items-center gap-2.5">
          <Library size={56} strokeWidth={1.5} className="text-black" />
          <p className="text-[40px] font-medium tracking-[-0.8px] text-black">
            Library
          </p>
        </div>
        <LibraryFilters
          filter={filter}
          onFilterChange={setFilter}
          folders={Object.values(folders)}
          tags={Object.values(tags)}
          onCreateDocument={HandleCreateDocument}
          onCreateProject={HandleCreateProject}
        />
        <div ref={tableRef} className="flex flex-col">
          {!hydrated ? <LibraryTableSkeleton /> : workspaceEmpty ? <EmptyWorkspace /> : <LibraryTable rows={rows} onOpenRow={HandleOpenRow} />}
        </div>
      </div>

      {openDocument ? (
        <ResizableSidePanel>
          <StandaloneDocumentEditor
            key={openDocument.id}
            document={openDocument}
            compact
            onClose={() => setOpenDocumentId(null)}
          />
        </ResizableSidePanel>
      ) : null}

      {openProject && openProjectActiveDocument ? (
        <ResizableSidePanel>
          <ProjectView
            key={openProject.id}
            project={openProject}
            activeDocument={openProjectActiveDocument}
            subDocuments={openProjectSubDocuments}
            activeDocumentId={projectActiveDocumentId}
            onUpdateProject={HandleUpdateOpenProject}
            onOpenDocument={setProjectActiveDocumentId}
            onAddDocument={HandleAddDocumentToOpenProject}
            onDocumentSaved={upsertDocument}
            compact
            onClose={() => setOpenProjectId(null)}
          />
        </ResizableSidePanel>
      ) : null}
    </div>
  );
}

/** Skutečná velikost obsahu dokumentu (text + kresba) — dřív tu byl natvrdo „20 KB". */
function FormatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPageContent />
    </Suspense>
  );
}
