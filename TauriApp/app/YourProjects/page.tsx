"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Plus, Rocket } from "lucide-react";
import { ProjectsTable } from "@/Components/YourProjects/ProjectsTable";
import { ProjectsTableSkeleton } from "@/Components/YourProjects/ProjectsTableSkeleton";
import { UseDataStore } from "@/Store/UseDataStore";
import { UseUiStore } from "@/Store/UseUiStore";
import { CreateNewProject } from "@/Lib/CreateProject";

export default function YourProjectsPage() {
  const router = useRouter();
  const projectsById = UseDataStore((state) => state.projects);
  const projects = Object.values(projectsById);
  const hydrated = UseDataStore((state) => state.hydrated);
  const openTab = UseUiStore((state) => state.OpenTab);

  useEffect(() => {
    openTab({ id: "your-projects", title: "Your Projects", href: "/YourProjects" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function HandleNewProject() {
    const project = CreateNewProject();
    router.push(`/YourProjects/Project?id=${project.id}`);
  }

  return (
    <div className="flex flex-col gap-6 px-[50px] pt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-black/[0.03]">
            <Rocket size={28} strokeWidth={1.5} className="text-[#5f5e59]" />
          </div>
          <p className="text-[40px] font-medium tracking-[-0.8px] text-black">
            Your Projects
          </p>
        </div>
        <Button
          variant="ghost"
          onPress={HandleNewProject}
          className="h-auto gap-1.5 rounded-lg border border-[#f0efed] bg-[#f9f8f7] px-3 py-2 text-sm font-normal text-[#5f5e59] hover:bg-black/[0.03]"
        >
          <Plus size={16} strokeWidth={1.5} />
          New Project
        </Button>
      </div>
      {!hydrated ? (
        <ProjectsTableSkeleton />
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#e2e0dc] py-16 text-center">
          <p className="text-sm text-[#91918e]">No projects yet.</p>
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
