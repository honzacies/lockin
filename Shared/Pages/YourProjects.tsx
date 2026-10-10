"use client";

import { EmptyWorkspace, UseIsWorkspaceEmpty } from "@lockin/shared/Components/AppShell/EmptyWorkspace";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Plus, Rocket } from "lucide-react";
import { ProjectsTable } from "@lockin/shared/Components/YourProjects/ProjectsTable";
import { ProjectsTableSkeleton } from "@lockin/shared/Components/YourProjects/ProjectsTableSkeleton";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { CreateNewProject } from "@lockin/shared/Lib/CreateProject";
import { NEW_BUTTON } from "@lockin/shared/Components/Library/LibraryFilters";

export default function YourProjectsPage() {
  const router = useRouter();
  const projectsById = UseDataStore((state) => state.projects);
  const projects = Object.values(projectsById);
  const hydrated = UseDataStore((state) => state.hydrated);
  const openTab = UseUiStore((state) => state.OpenTab);
  const workspaceEmpty = UseIsWorkspaceEmpty();

  useEffect(() => {
    openTab({ id: "your-projects", title: "Your Projects", href: "/YourProjects" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function HandleNewProject() {
    const project = CreateNewProject();
    router.push(`/YourProjects/Project?id=${project.id}`);
  }

  return (
    // Stejná hlavička a „New" jako Library.
    <div className="flex flex-col gap-4 px-[50px] pt-6 pb-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Rocket size={56} strokeWidth={1.5} className="text-black" />
          <p className="text-[40px] font-medium tracking-[-0.8px] text-black">Your Projects</p>
        </div>
        <Button variant="ghost" onPress={HandleNewProject} className={NEW_BUTTON}>
          <Plus size={15} strokeWidth={1.75} />
          New project
        </Button>
      </div>
      {!hydrated ? (
        <ProjectsTableSkeleton />
      ) : workspaceEmpty ? (
        <EmptyWorkspace />
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--lk-line2)] py-16 text-center">
          <p className="text-sm text-[var(--lk-muted)]">No projects yet.</p>
          <Button
            variant="ghost"
            onPress={HandleNewProject}
            className="h-auto p-0 text-sm font-medium text-[#0088ff] hover:underline"
          >
            Create your first project
          </Button>
        </div>
      ) : (
        <ProjectsTable projects={projects} />
      )}
    </div>
  );
}
