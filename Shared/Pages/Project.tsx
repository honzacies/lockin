"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";
import { ProjectView } from "@lockin/shared/Components/ProjectView/ProjectView";
import { DocumentSkeleton } from "@lockin/shared/Components/DocumentView/DocumentSkeleton";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { BuildBlankDocument } from "@lockin/shared/Lib/CreateDocument";
import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";

function ProjectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id");
  const docParam = searchParams.get("doc");

  const project = UseDataStore((state) =>
    projectId ? state.projects[projectId] : undefined,
  );
  const documents = UseDataStore((state) => state.documents);
  const hydrated = UseDataStore((state) => state.hydrated);
  const upsertProject = UseDataStore((state) => state.UpsertProject);
  const upsertDocument = UseDataStore((state) => state.UpsertDocument);
  const addDocumentToProject = UseDataStore((state) => state.AddDocumentToProject);
  const removeProject = UseDataStore((state) => state.RemoveProject);

  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(docParam);
  const openTab = UseUiStore((state) => state.OpenTab);

  // `useState(docParam)` only ever reads the URL once, at mount — the App
  // Router keeps this same page instance alive across a same-route
  // navigation (e.g. the Sidebar's plain <Link> to another document in this
  // project), so a `doc` param change from anywhere other than
  // HandleOpenDocument's own `router.replace` below never reached this
  // state at all, and clicking a sub-document in the Sidebar silently did
  // nothing. Comparing against a ref (not `docParam` directly) keeps this
  // a no-op for HandleOpenDocument's own updates once the URL catches up
  // to the state it already set, instead of fighting it.
  const docParamRef = useRef(docParam);
  useEffect(() => {
    if (docParamRef.current === docParam) return;
    docParamRef.current = docParam;
    setActiveDocumentId(docParam);
  }, [docParam]);

  const activeDocumentForTab = project
    ? (documents[activeDocumentId ?? project.rootDocumentId] ??
      documents[project.rootDocumentId])
    : undefined;

  useEffect(() => {
    if (!project || !activeDocumentForTab) return;
    const isRoot = activeDocumentForTab.id === project.rootDocumentId;
    openTab({
      id: activeDocumentForTab.id,
      title: isRoot ? project.name : activeDocumentForTab.name,
      href: `/YourProjects/Project?id=${project.id}${isRoot ? "" : `&doc=${activeDocumentForTab.id}`}`,
      isProject: true,
      icon: project.icon,
    });
    // Only re-run when the resolved document (or its project's icon) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocumentForTab?.id, activeDocumentForTab?.name, project?.id, project?.name, project?.icon]);

  if (!project) {
    if (!hydrated) return <DocumentSkeleton />;
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#91918e]">
        Project not found.
      </div>
    );
  }

  if (!activeDocumentForTab) {
    if (!hydrated) return <DocumentSkeleton />;
    // Hydration is done and the root document genuinely doesn't exist on
    // disk — a past write failure, not a loading state. Offer a way out
    // instead of hanging on a spinner forever.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-[#91918e]">
        <p>This project&apos;s document is missing and can&apos;t be recovered.</p>
        <Button
          variant="ghost"
          onPress={() => {
            removeProject(project.id);
            router.push("/YourProjects");
          }}
          className="h-auto rounded-lg border border-[#f0d4d4] bg-[#fdf4f4] px-3 py-1.5 text-sm font-medium text-[#e5484d] hover:bg-[#fbe9e9]"
        >
          Delete this broken project
        </Button>
      </div>
    );
  }

  const activeDocument = activeDocumentForTab;
  const subDocuments = project.documentIds
    .map((id) => documents[id])
    .filter((doc): doc is DocumentRecord => Boolean(doc));

  function HandleUpdateProject(patch: Partial<Project>) {
    const next: Project = {
      ...project!,
      ...patch,
      lastEditedAt: new Date().toISOString(),
    };
    // UpsertProject self-persists (Store/UseDataStore.ts) — no separate save here.
    upsertProject(next);

    // The root document IS the project — its name (shown in tabs, the mode
    // toolbar, and the sidebar) needs to track the project's name, since
    // nothing else ever renames that document directly.
    if (patch.name !== undefined) {
      const rootDocument = documents[next.rootDocumentId];
      if (rootDocument) upsertDocument({ ...rootDocument, name: patch.name });
    }
  }

  // Switching documents via the Contents rail's pills used to only update
  // local state — the URL's `doc` param never moved, so anything deriving
  // "what's active" from the URL (the Sidebar's highlight) stayed stuck on
  // whatever document the page was first loaded with. replace (not push)
  // keeps every pill click off the back/forward stack, same as before.
  function HandleOpenDocument(id: string) {
    setActiveDocumentId(id);
    const isRoot = id === project!.rootDocumentId;
    router.replace(`/YourProjects/Project?id=${project!.id}${isRoot ? "" : `&doc=${id}`}`);
  }

  function HandleAddDocument() {
    const doc = BuildBlankDocument(`doc-${Date.now()}`, project!.id);
    addDocumentToProject(project!.id, doc);
    HandleOpenDocument(doc.id);
  }

  return (
    <ProjectView
      project={project}
      activeDocument={activeDocument}
      subDocuments={subDocuments}
      activeDocumentId={activeDocumentId}
      onUpdateProject={HandleUpdateProject}
      onOpenDocument={HandleOpenDocument}
      onAddDocument={HandleAddDocument}
      onDocumentSaved={upsertDocument}
    />
  );
}

export default function ProjectPage() {
  return (
    <Suspense fallback={null}>
      <ProjectPageContent />
    </Suspense>
  );
}
