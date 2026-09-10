"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@heroui/react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderCog,
  Hash,
  FileText,
  Library,
  Rocket,
  Star,
  Clock,
  Settings,
  Search,
  Zap,
  Plus,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
  Notebook,
} from "lucide-react";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { DEFAULT_TAG_COLOR } from "@lockin/shared/Types/Library";
import {
  UseSidebarStore,
  type SidebarNavId,
  type SidebarSectionId,
} from "@lockin/shared/Store/UseSidebarStore";
import { ProjectIcon } from "@lockin/shared/Components/Shared/ProjectIcon";
import { Skeleton } from "@lockin/shared/Components/Shared/Skeleton";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenu, ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { SidebarItemMenu, type SidebarItemKind } from "./SidebarItemMenu";
import { CreateNewProject } from "@lockin/shared/Lib/CreateProject";
import { CreateNewDocument } from "@lockin/shared/Lib/CreateDocument";
import { RenameByKind } from "@lockin/shared/Lib/LibraryItemActions";

interface SidebarRowData {
  id: string;
  kind: SidebarItemKind;
  /** What's shown in the sidebar — may be "<project> - <document>" for a
   * project's sub-documents. Display-only. */
  label: string;
  /** The item's actual own name — used when editing (rename), so committing
   * never writes the sidebar's "<project> - <document>" prefix back as the
   * real name. Defaults to `label` for items that don't get prefixed. */
  rawLabel?: string;
  href: string;
  icon?: ReactNode;
  /** Whether this row represents whatever's currently on screen — kept in
   * sync with the URL (see Sidebar()'s currentProjectId/currentDocId), not
   * with which document was last clicked, so navigating any other way
   * (tabs, Library, browser back/forward) still highlights correctly. */
  active?: boolean;
  /** Tag rows only — LibraryTag.color, applied to the fallback Hash icon. */
  color?: string;
}

const NAV_META: Record<SidebarNavId, { href: string; icon: LucideIcon; label: string }> = {
  "quick-notes": { href: "/QuickNotes", icon: Zap, label: "Quick Notes" },
  library: { href: "/Library", icon: Library, label: "Library" },
  "your-projects": { href: "/YourProjects", icon: Rocket, label: "Your Projects" },
};

const SECTION_META: Record<SidebarSectionId, { icon: ReactNode; label: string }> = {
  recents: { icon: <Clock size={16} strokeWidth={1.5} />, label: "Recents" },
  favorites: { icon: <Star size={16} strokeWidth={1.5} />, label: "Favorites" },
  folders: { icon: <Folder size={16} strokeWidth={1.5} />, label: "Folders" },
  tags: { icon: <Hash size={16} strokeWidth={1.5} />, label: "Tags" },
};

/** Order+visibility-aware reorder menu, shared by nav links and sections. */
function OrderMenuItems({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onHide,
  close,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHide: () => void;
  close: () => void;
}) {
  return (
    <>
      <ContextMenuLabel first>Organize</ContextMenuLabel>
      <ContextMenuItem
        icon={<ArrowUp size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
        disabled={!canMoveUp}
        onClick={() => {
          onMoveUp();
          close();
        }}
      >
        Move up
      </ContextMenuItem>
      <ContextMenuItem
        icon={<ArrowDown size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
        disabled={!canMoveDown}
        onClick={() => {
          onMoveDown();
          close();
        }}
      >
        Move down
      </ContextMenuItem>
      <ContextMenuItem
        icon={<EyeOff size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
        onClick={() => {
          onHide();
          close();
        }}
      >
        Hide
      </ContextMenuItem>
    </>
  );
}

function NavRow({
  id,
  active,
  canMoveUp,
  canMoveDown,
}: {
  id: SidebarNavId;
  active: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const meta = NAV_META[id];
  const MoveNav = UseSidebarStore((s) => s.MoveNav);
  const ToggleNavHidden = UseSidebarStore((s) => s.ToggleNavHidden);

  return (
    <ContextMenu
      menu={(close) => (
        <OrderMenuItems
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={() => MoveNav(id, "up")}
          onMoveDown={() => MoveNav(id, "down")}
          onHide={() => ToggleNavHidden(id)}
          close={close}
        />
      )}
    >
      <Link
        href={meta.href}
        className={`flex w-full items-center gap-[5px] rounded-lg px-[5px] py-[3px] text-left text-[16px] ${active ? "bg-[#F1F0EF] text-[#0f0f0f]" : "text-[#5f5e59] hover:bg-black/[0.03]"
          }`}
      >
        <meta.icon size={20} strokeWidth={1.5} />
        {meta.label}
      </Link>
    </ContextMenu>
  );
}

function SidebarRow({ item }: { item: SidebarRowData }) {
  const ownName = item.rawLabel ?? item.label;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ownName);

  function Commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === ownName) {
      setDraft(ownName);
      return;
    }
    RenameByKind(item.kind, item.id, trimmed);
  }

  const DefaultIcon: LucideIcon =
    item.kind === "folder" ? Folder : item.kind === "tag" ? Hash : item.kind === "project" ? Rocket : FileText;

  return (
    <ContextMenu
      menu={(close) => (
        <SidebarItemMenu
          kind={item.kind}
          id={item.id}
          close={close}
          onRenameStart={() => {
            setDraft(ownName);
            setEditing(true);
          }}
        />
      )}
    >
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={Commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(ownName);
              setEditing(false);
            }
          }}
          className="w-full rounded-lg border border-[#d9d9d9] bg-white px-1.5 py-0.5 text-[16px] text-[#2c2c2b] outline-none focus:border-[#0485f7]"
        />
      ) : (
        <Link
          href={item.href}
          className={`flex items-center gap-1.5 truncate rounded-lg px-1.5 py-0.5 text-[16px] ${
            item.active ? "bg-[#F1F0EF] text-[#0f0f0f]" : "text-[#5f5e59] hover:bg-black/[0.03]"
          }`}
        >
          {item.icon ?? (
            <DefaultIcon
              size={18}
              strokeWidth={1.5}
              style={item.kind === "tag" ? { color: item.color } : undefined}
            />
          )}
          <span className="truncate">{item.label}</span>
        </Link>
      )}
    </ContextMenu>
  );
}

/** One row's worth of skeleton — icon-sized dot + a text-width bar,
 * matching SidebarRow's own layout closely enough that real rows don't
 * visibly jump into a different position once they replace these. */
function SidebarRowSkeleton() {
  return (
    <div className="flex items-center gap-1.5 px-1.5 py-0.5">
      <Skeleton className="size-[18px] shrink-0 rounded-full" />
      <Skeleton className="h-3.5 w-24" />
    </div>
  );
}

interface SidebarSectionProps {
  sectionId: SidebarSectionId;
  items: SidebarRowData[];
  onAdd?: () => void;
  addLabel?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  manageHref?: string;
  manageLabel?: string;
  /** UseDataStore hasn't hydrated from disk yet — show skeleton rows
   * instead of a real (necessarily empty, since nothing's loaded) list. */
  loading?: boolean;
}

function RenderSidebarSection({
  sectionId,
  items,
  onAdd,
  addLabel,
  canMoveUp,
  canMoveDown,
  manageHref,
  manageLabel,
  loading,
}: SidebarSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const meta = SECTION_META[sectionId];
  const router = useRouter();
  const MoveSection = UseSidebarStore((s) => s.MoveSection);
  const ToggleSectionHidden = UseSidebarStore((s) => s.ToggleSectionHidden);

  return (
    <div className="group/section flex w-full flex-col gap-2 px-2.5 py-1.5">
      <ContextMenu menu={(close) => (
        <>
          <OrderMenuItems
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => MoveSection(sectionId, "up")}
            onMoveDown={() => MoveSection(sectionId, "down")}
            onHide={() => ToggleSectionHidden(sectionId)}
            close={close}
          />
          {manageHref ? (
            <>
              <ContextMenuLabel>Manage</ContextMenuLabel>
              <ContextMenuItem
                icon={<FolderCog size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
                onClick={() => {
                  router.push(manageHref);
                  close();
                }}
              >
                {manageLabel}
              </ContextMenuItem>
            </>
          ) : null}
        </>
      )}
      >
        <div className="flex w-full items-center justify-between text-[#91918e] select-none">
          <div
            className="h-auto w-auto flex flex-row items-center justify-start gap-[5px] rounded-lg p-0 py-0.5 text-[14px] font-normal"
          >
            {meta.icon}
            {meta.label}
          </div>
          <div className="flex items-center gap-0.5">
            {onAdd ? (
              <Button
                variant="ghost"
                isIconOnly
                onPress={onAdd}
                aria-label={addLabel ?? `Add to ${meta.label}`}
                className="h-4 w-4 rounded opacity-0 text-[#91918E] hover:text-[#5F5E59] hover:bg-transparent group-focus-within/section:opacity-100 group-hover/section:opacity-100"
              >
                <Plus size={14} strokeWidth={1.75} />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              isIconOnly
              onPress={() => setExpanded((prev) => !prev)}
              aria-label={expanded ? "Collapse" : "Expand"}
              className="rounded p-0 h-4 w-4 text-[#91918E] hover:text-[#5F5E59] hover:bg-transparent"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
              />
            </Button>
          </div>
        </div>
      </ContextMenu>
      {expanded &&
        (loading ? (
          <>
            <SidebarRowSkeleton />
            <SidebarRowSkeleton />
            <SidebarRowSkeleton />
          </>
        ) : items.length === 0 ? (
          <p className="px-1.5 text-[13px] text-[#c9c8c4]">Nothing yet</p>
        ) : (
          items.map((item) => <SidebarRow key={`${item.kind}-${item.id}`} item={item} />)
        ))}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projects = UseDataStore((state) => state.projects);
  const documents = UseDataStore((state) => state.documents);
  const folders = UseDataStore((state) => state.folders);
  const tags = UseDataStore((state) => state.tags);
  const hydrated = UseDataStore((state) => state.hydrated);

  // What's actually on screen right now, derived straight from the URL —
  // the single source of truth for "which row should be highlighted."
  // Previously nothing kept individual rows (as opposed to the top-level
  // NavRow items) in sync with navigation at all.
  const urlProjectId = pathname === "/YourProjects/Project" ? searchParams.get("id") : null;
  const urlDocParam = pathname === "/YourProjects/Project" ? searchParams.get("doc") : null;
  const urlStandaloneDocId = pathname === "/Document" ? searchParams.get("id") : null;
  const urlFolderId = pathname === "/Library" ? searchParams.get("folderId") : null;
  const urlTagId = pathname === "/Library" ? searchParams.get("tagId") : null;

  const navOrder = UseSidebarStore((s) => s.navOrder);
  const hiddenNav = UseSidebarStore((s) => s.hiddenNav);
  const sectionOrder = UseSidebarStore((s) => s.sectionOrder);
  const hiddenSections = UseSidebarStore((s) => s.hiddenSections);
  const ToggleNavHidden = UseSidebarStore((s) => s.ToggleNavHidden);
  const ToggleSectionHidden = UseSidebarStore((s) => s.ToggleSectionHidden);

  function DocHref(doc: { id: string; projectId: string | null }) {
    if (!doc.projectId) return `/Document?id=${doc.id}`;
    const project = projects[doc.projectId];
    const isRoot = project?.rootDocumentId === doc.id;
    return `/YourProjects/Project?id=${doc.projectId}${isRoot ? "" : `&doc=${doc.id}`}`;
  }

  function ToRow(doc: (typeof documents)[string]): SidebarRowData {
    const project = doc.projectId ? projects[doc.projectId] : undefined;
    const isRoot = Boolean(project && project.rootDocumentId === doc.id);
    if (isRoot && project) {
      const viewingProject = urlProjectId === project.id;
      return {
        id: project.id,
        kind: "project",
        label: project.name || "Untitled",
        href: DocHref(doc),
        icon: <ProjectIcon icon={project.icon} size={18} />,
        active: viewingProject && (!urlDocParam || urlDocParam === project.rootDocumentId),
      };
    }
    const docName = doc.name || "Untitled";
    return {
      id: doc.id,
      kind: "document",
      // Sidebar-only label — shows which project a sub-document belongs to
      // without renaming the document itself (Tabs, Library, etc. still show
      // just the document's own name).
      label: project ? `${project.name || "Untitled"} - ${docName}` : docName,
      rawLabel: docName,
      href: DocHref(doc),
      icon: doc.icon ? <ProjectIcon icon={doc.icon} size={18} /> : undefined,
      active: project
        ? urlProjectId === project.id && urlDocParam === doc.id
        : urlStandaloneDocId === doc.id,
    };
  }

  const recentDocs = Object.values(documents)
    .slice()
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 8)
    .map(ToRow);

  const favoriteDocs = Object.values(documents).filter((doc) => doc.isFavorite).map(ToRow);

  const folderItems: SidebarRowData[] = Object.values(folders).map((folder) => ({
    id: folder.id,
    kind: "folder",
    label: folder.name,
    href: `/Library?folderId=${folder.id}`,
    active: urlFolderId === folder.id,
  }));

  const tagItems: SidebarRowData[] = Object.values(tags).map((tag) => ({
    id: tag.id,
    kind: "tag",
    label: tag.name,
    href: `/Library?tagId=${tag.id}`,
    active: urlTagId === tag.id,
    color: tag.color ?? DEFAULT_TAG_COLOR,
  }));

  const SECTION_ITEMS: Record<SidebarSectionId, SidebarRowData[]> = {
    recents: recentDocs,
    favorites: favoriteDocs,
    folders: folderItems,
    tags: tagItems,
  };

  function HandleNewProject() {
    const project = CreateNewProject();
    router.push(`/YourProjects/Project?id=${project.id}`);
  }

  function HandleNewDocument() {
    const doc = CreateNewDocument();
    router.push(`/Document?id=${doc.id}`);
  }

  function HandleNewFolder() {
    const folder = UseDataStore.getState().AddFolder();
    router.push(`/Library?folderId=${folder.id}`);
  }

  function HandleNewTag() {
    const tag = UseDataStore.getState().AddTag();
    router.push(`/Library?tagId=${tag.id}`);
  }

  const visibleNav = navOrder.filter((id) => !hiddenNav.includes(id));
  const visibleSections = sectionOrder.filter((id) => !hiddenSections.includes(id));
  const hasHidden = hiddenNav.length > 0 || hiddenSections.length > 0;

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col gap-[15px] border-r border-[#f0efed] bg-[#faf9f8] p-2.5">
      <div className="flex h-[30px] items-center justify-between">
        <div className="flex items-center gap-[10px]">
          <div className="size-[30px] rounded-md bg-[#d9d9d9]" />
          <div className="flex items-center gap-[5px] rounded-md px-[5px] py-1 hover:bg-black/[0.03]">
            <div className="flex size-[25px] items-center justify-center rounded-[4px] bg-[#0088ff] text-sm font-semibold text-white">
              H
            </div>
            <p className="text-[16px] font-semibold tracking-[-0.32px] text-black">
              Your Workspace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-[#91918e]">
          <Button
            variant="ghost"
            isIconOnly
            onPress={() => { history.back() }}
            aria-label={`Go back`}
            className="h-5 w-5 rounded text-[#91918E] hover:bg-transparent hover:text-[#5F5E59]"
          >
            <ChevronLeft size={20} />
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            onPress={() => { history.forward() }}
            aria-label={`Go forward`}
            className="h-5 w-5 rounded text-[#91918E] hover:bg-transparent hover:text-[#5F5E59]"
          >
            <ChevronRight size={20} />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-[20px] bg-black/[0.03] px-2.5 py-[3px] text-sm text-[#2c2c2b]">
            <Notebook size={18} strokeWidth={1.5} />
            Notes
          </div>
        </div>
        <div className="flex items-center gap-2 text-[#91918e]">
          <Popover
            align="right"
            trigger={() => (
              <Button
                variant="ghost"
                isIconOnly
                aria-label="Sidebar settings"
                className={`h-auto w-auto rounded p-0.5 hover:bg-black/[0.05] hover:text-[#2c2c2b] ${hasHidden ? "text-[#0088ff]" : ""}`}
              >
                <Settings size={18} />
              </Button>
            )}
            panelClassName="w-52 p-1"
          >
            {() => (
              <div className="flex flex-col gap-px">
                <ContextMenuLabel first>Hidden items</ContextMenuLabel>
                {!hasHidden ? (
                  <p className="px-2 py-1 text-[13px] text-[#91918e]">Nothing hidden</p>
                ) : (
                  <>
                    {hiddenNav.map((id) => (
                      <ContextMenuItem
                        key={id}
                        icon={<Eye size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
                        onClick={() => ToggleNavHidden(id)}
                      >
                        {NAV_META[id].label}
                      </ContextMenuItem>
                    ))}
                    {hiddenSections.map((id) => (
                      <ContextMenuItem
                        key={id}
                        icon={<Eye size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
                        onClick={() => ToggleSectionHidden(id)}
                      >
                        {SECTION_META[id].label}
                      </ContextMenuItem>
                    ))}
                  </>
                )}
              </div>
            )}
          </Popover>
          <Search size={18} />
        </div>
      </div>

      <nav className="flex w-full flex-col gap-2 px-[5px]">
        {visibleNav.map((id, index) => (
          <NavRow
            key={id}
            id={id}
            active={
              id === "your-projects"
                ? (pathname?.startsWith("/YourProjects") ?? false)
                : pathname === NAV_META[id].href
            }
            canMoveUp={index > 0}
            canMoveDown={index < visibleNav.length - 1}
          />
        ))}
      </nav>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {visibleSections.map((id, index) => (
          <RenderSidebarSection
            key={id}
            sectionId={id}
            items={SECTION_ITEMS[id]}
            onAdd={
              id === "recents" ? HandleNewDocument : id === "folders" ? HandleNewFolder : id === "tags" ? HandleNewTag : undefined
            }
            addLabel={
              id === "recents" ? "New document" : id === "folders" ? "New folder" : id === "tags" ? "New tag" : undefined
            }
            canMoveUp={index > 0}
            canMoveDown={index < visibleSections.length - 1}
            manageHref={id === "folders" ? "/Library?filter=folder-all" : id === "tags" ? "/Library?filter=tag-all" : undefined}
            manageLabel={id === "folders" ? "Manage folders" : id === "tags" ? "Manage tags" : undefined}
            loading={!hydrated}
          />
        ))}
      </div>

      <Button
        variant="ghost"
        onPress={HandleNewProject}
        className="h-auto justify-center gap-1.5 rounded-lg border border-[#f0efed] bg-[#f9f8f7] px-0 py-1.5 text-sm font-normal text-[#5f5e59] hover:bg-black/[0.03]"
      >
        <Plus size={16} />
        New
      </Button>
    </div>
  );
}
