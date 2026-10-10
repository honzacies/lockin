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
  EyeOff,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
  Notebook,
  ListTodo,
  Waypoints,
  Shapes,
} from "lucide-react";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseCanvasStore } from "@lockin/shared/Store/UseCanvasStore";
import { DEFAULT_TAG_COLOR } from "@lockin/shared/Types/Library";
import {
  UseSidebarStore,
  type SidebarNavId,
  type SidebarSectionId,
} from "@lockin/shared/Store/UseSidebarStore";
import { ProjectIcon } from "@lockin/shared/Components/Shared/ProjectIcon";
import { Skeleton } from "@lockin/shared/Components/Shared/Skeleton";
import { ContextMenu, ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { SidebarItemMenu, type SidebarItemKind } from "./SidebarItemMenu";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { CreateMenuItems } from "./CreateMenu";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { LockInLogo } from "@lockin/shared/Components/Shared/LockInLogo";
import { UseSettingsStore } from "@lockin/shared/Store/UseSettingsStore";
import { ShortcutFor } from "@lockin/shared/Lib/Shortcuts";
import { TodoSourcesSidebar } from "@lockin/shared/Components/Focus/TodoSourcesSidebar";
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
  /** Folder rows only — podsložky a dokumenty, rozbalují se přímo v sidebaru. */
  children?: SidebarRowData[];
}

export const NAV_META: Record<SidebarNavId, { href: string; icon: LucideIcon; label: string }> = {
  "quick-notes": { href: "/QuickNotes", icon: Zap, label: "Quick Notes" },
  library: { href: "/Library", icon: Library, label: "Library" },
  "your-projects": { href: "/YourProjects", icon: Rocket, label: "Your Projects" },
  graph: { href: "/Graph", icon: Waypoints, label: "Graph" },
  canvas: { href: "/Canvas", icon: Shapes, label: "Canvas" },
};

/** Přepínač režimu (Notes / To-do) nad navigací — režim se odvozuje z URL. */
function ModeChip({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-[20px] px-2.5 py-[3px] text-sm ${
        active ? "bg-black/[0.03] text-[var(--lk-ink)]" : "text-[var(--lk-muted)] hover:bg-black/[0.03] hover:text-[var(--lk-text2)]"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

export const SECTION_META: Record<SidebarSectionId, { icon: ReactNode; label: string }> = {
  recents: { icon: <Clock size={16} strokeWidth={1.5} />, label: "Recents" },
  favorites: { icon: <Star size={16} strokeWidth={1.5} />, label: "Favorites" },
  folders: { icon: <Folder size={16} strokeWidth={1.5} />, label: "Folders" },
  tags: { icon: <Hash size={16} strokeWidth={1.5} />, label: "Tags" },
  canvases: { icon: <Shapes size={16} strokeWidth={1.5} />, label: "Canvases" },
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
        icon={<ArrowUp size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />}
        disabled={!canMoveUp}
        onClick={() => {
          onMoveUp();
          close();
        }}
      >
        Move up
      </ContextMenuItem>
      <ContextMenuItem
        icon={<ArrowDown size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />}
        disabled={!canMoveDown}
        onClick={() => {
          onMoveDown();
          close();
        }}
      >
        Move down
      </ContextMenuItem>
      <ContextMenuItem
        icon={<EyeOff size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />}
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
        className={`flex w-full items-center gap-[5px] rounded-lg px-[5px] py-[3px] text-left text-[16px] ${active ? "bg-[var(--lk-pill)] text-[var(--lk-fg)]" : "text-[var(--lk-text2)] hover:bg-black/[0.03]"
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
    item.kind === "folder" ? Folder : item.kind === "tag" ? Hash : item.kind === "project" ? Rocket : item.kind === "canvas" ? Shapes : FileText;
  const expanded = UseSidebarStore((s) => s.expandedFolders.includes(item.id));
  const ToggleFolderExpanded = UseSidebarStore((s) => s.ToggleFolderExpanded);

  const row = (
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
          className="w-full rounded-lg border border-[var(--lk-gray)] bg-white px-1.5 py-0.5 text-[16px] text-[var(--lk-ink)] outline-none focus:border-[#0485f7]"
        />
      ) : (
        <Link
          href={item.href}
          onClick={(e) => {
            // Složka se rozbaluje na místě, do Library vede "Manage folders".
            if (!item.children) return;
            e.preventDefault();
            ToggleFolderExpanded(item.id);
          }}
          className={`flex items-center gap-1.5 truncate rounded-lg px-1.5 py-0.5 text-[16px] ${
            item.active ? "bg-[var(--lk-pill)] text-[var(--lk-fg)]" : "text-[var(--lk-text2)] hover:bg-black/[0.03]"
          }`}
        >
          {item.children ? (
            <ChevronDown size={14} className={`shrink-0 text-[var(--lk-muted)] transition-transform ${expanded ? "" : "-rotate-90"}`} />
          ) : null}
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

  if (!item.children) return row;
  return (
    <div className="flex flex-col gap-2">
      {row}
      {expanded ? (
        <div className="ml-[13px] flex flex-col gap-2 border-l border-[var(--lk-line)] pl-2">
          {item.children.length === 0 ? (
            <p className="px-1.5 text-[13px] text-[var(--lk-faint)]">Empty</p>
          ) : (
            item.children.map((child) => <SidebarRow key={`${child.kind}-${child.id}`} item={child} />)
          )}
        </div>
      ) : null}
    </div>
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
                icon={<FolderCog size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />}
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
        <div className="flex w-full items-center justify-between text-[var(--lk-muted)] select-none">
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
                className="h-4 w-4 rounded opacity-0 text-[var(--lk-muted)] hover:text-[var(--lk-text2)] hover:bg-transparent group-focus-within/section:opacity-100 group-hover/section:opacity-100"
              >
                <Plus size={14} strokeWidth={1.75} />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              isIconOnly
              onPress={() => setExpanded((prev) => !prev)}
              aria-label={expanded ? "Collapse" : "Expand"}
              className="rounded p-0 h-4 w-4 text-[var(--lk-muted)] hover:text-[var(--lk-text2)] hover:bg-transparent"
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
          <p className="px-1.5 text-[13px] text-[var(--lk-faint)]">Nothing yet</p>
        ) : (
          items.map((item) => <SidebarRow key={`${item.kind}-${item.id}`} item={item} />)
        ))}
    </div>
  );
}

export function Sidebar({ footer }: { footer?: ReactNode }) {
  const pathname = usePathname();
  const todoMode = pathname?.startsWith("/Todo") ?? false;
  const searchParams = useSearchParams();
  const router = useRouter();
  const projects = UseDataStore((state) => state.projects);
  const documents = UseDataStore((state) => state.documents);
  const folders = UseDataStore((state) => state.folders);
  const tags = UseDataStore((state) => state.tags);
  const canvases = UseCanvasStore((state) => state.canvases);
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
  const urlCanvasId = pathname === "/Canvas" ? searchParams.get("id") : null;

  const navOrder = UseSidebarStore((s) => s.navOrder);
  const hiddenNav = UseSidebarStore((s) => s.hiddenNav);
  const sectionOrder = UseSidebarStore((s) => s.sectionOrder);
  const hiddenSections = UseSidebarStore((s) => s.hiddenSections);

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

  // Strom: "resources/heroui" je podsložka "resources" (tak chodí složky
  // z vaultu), v řádku se ukáže jen poslední část cesty.
  const folderList = Object.values(folders);
  const folderByName = new Map(folderList.map((folder) => [folder.name, folder]));
  const ParentName = (name: string) => (name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : null);
  const ByLabel = (a: SidebarRowData, b: SidebarRowData) => a.label.localeCompare(b.label);

  function ToFolderRow(folder: (typeof folderList)[number]): SidebarRowData {
    const subfolders = folderList.filter((f) => ParentName(f.name) === folder.name).map(ToFolderRow).sort(ByLabel);
    const docs = Object.values(documents).filter((doc) => doc.folderId === folder.id).map(ToRow).sort(ByLabel);
    return {
      id: folder.id,
      kind: "folder",
      label: folder.name.split("/").pop() || folder.name,
      rawLabel: folder.name,
      href: `/Library?folderId=${folder.id}`,
      icon: folder.icon ? <ProjectIcon icon={folder.icon} size={18} /> : undefined,
      active: urlFolderId === folder.id,
      children: [...subfolders, ...docs],
    };
  }

  const folderItems: SidebarRowData[] = folderList
    .filter((folder) => {
      const parent = ParentName(folder.name);
      return !parent || !folderByName.has(parent);
    })
    .map(ToFolderRow)
    .sort(ByLabel);

  const tagItems: SidebarRowData[] = Object.values(tags).map((tag) => ({
    id: tag.id,
    kind: "tag",
    label: tag.name,
    href: `/Library?tagId=${tag.id}`,
    active: urlTagId === tag.id,
    color: tag.color ?? DEFAULT_TAG_COLOR,
  }));

  // Uložené canvasy — v sidebaru se chovají jako soubory, odkaz nese jejich id.
  const canvasItems: SidebarRowData[] = canvases.map((canvas) => ({
    id: canvas.id,
    kind: "canvas",
    label: canvas.name || "Untitled",
    href: `/Canvas?id=${canvas.id}`,
    active: urlCanvasId === canvas.id,
  }));

  const SECTION_ITEMS: Record<SidebarSectionId, SidebarRowData[]> = {
    recents: recentDocs,
    favorites: favoriteDocs,
    folders: folderItems,
    tags: tagItems,
    canvases: canvasItems,
  };

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

  const shortcuts = UseSettingsStore((s) => s.shortcuts);
  const visibleNav = navOrder.filter((id) => !hiddenNav.includes(id));
  const visibleSections = sectionOrder.filter((id) => !hiddenSections.includes(id));

  return (
    <ContextMenu
      menu={(close) => <CreateMenuItems close={close} />}
      className="flex h-full w-[300px] shrink-0 flex-col gap-[15px] border-r border-[var(--lk-line)] bg-[var(--lk-panel)] p-2.5"
    >
      <div className="flex h-[30px] items-center justify-between">
        <div className="flex items-center gap-[10px]">
          <LockInLogo />
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center gap-2.5 text-[var(--lk-muted)]">
          <Button
            variant="ghost"
            isIconOnly
            onPress={() => { history.back() }}
            aria-label={`Go back`}
            className="h-5 w-5 rounded text-[var(--lk-muted)] hover:bg-transparent hover:text-[var(--lk-text2)]"
          >
            <ChevronLeft size={20} />
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            onPress={() => { history.forward() }}
            aria-label={`Go forward`}
            className="h-5 w-5 rounded text-[var(--lk-muted)] hover:bg-transparent hover:text-[var(--lk-text2)]"
          >
            <ChevronRight size={20} />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ModeChip href="/QuickNotes" active={!todoMode} icon={<Notebook size={18} strokeWidth={1.5} />}>
            Notes
          </ModeChip>
          <ModeChip href="/Todo" active={todoMode} icon={<ListTodo size={18} strokeWidth={1.5} />}>
            To-do
          </ModeChip>
        </div>
        <div className="flex items-center gap-2 text-[var(--lk-muted)]">
          <Button
            variant="ghost"
            isIconOnly
            aria-label={`Settings (${ShortcutFor("settings", shortcuts)})`}
            onPress={() => UseSettingsStore.getState().Open(todoMode ? "session" : "editor")}
            className="size-7 min-w-0 rounded-md hover:bg-black/[0.04] hover:text-[var(--lk-ink)]"
          >
            <Settings size={18} />
          </Button>
          <Link
            href="/Search"
            aria-label={`Search (${ShortcutFor("search", shortcuts)})`}
            title={`Search (${ShortcutFor("search", shortcuts)})`}
            className={`flex size-7 items-center justify-center rounded-md hover:bg-black/[0.04] ${pathname === "/Search" ? "bg-black/[0.05] text-black" : ""}`}
          >
            <Search size={18} />
          </Link>
        </div>
      </div>

      {todoMode ? <TodoSourcesSidebar /> : <>
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
              id === "recents" ? HandleNewDocument : id === "folders" ? HandleNewFolder : id === "tags" ? HandleNewTag : id === "canvases" ? () => router.push("/Canvas") : undefined
            }
            addLabel={
              id === "recents" ? "New document" : id === "folders" ? "New folder" : id === "tags" ? "New tag" : id === "canvases" ? "New canvas" : undefined
            }
            canMoveUp={index > 0}
            canMoveDown={index < visibleSections.length - 1}
            manageHref={id === "folders" ? "/Library?filter=folder-all" : id === "tags" ? "/Library?filter=tag-all" : undefined}
            manageLabel={id === "folders" ? "Manage folders" : id === "tags" ? "Manage tags" : undefined}
            // `hydrated` je příznak dokumentů — canvasy mají vlastní store,
            // takže na ně čekat nemají proč.
            loading={id !== "canvases" && !hydrated}
          />
        ))}
      </div>

      <div className="px-[5px]">
        <Popover
          side="top"
          panelClassName="w-52 p-1"
          trigger={(open) => (
            <button
              type="button"
              className={`flex w-full items-center gap-[5px] rounded-lg px-[5px] py-[3px] text-left text-[16px] text-[var(--lk-text2)] ${open ? "bg-black/[0.04]" : "hover:bg-black/[0.03]"}`}
            >
              <Plus size={18} strokeWidth={1.5} />
              New
            </button>
          )}
        >
          {(close) => <CreateMenuItems close={close} />}
        </Popover>
      </div>
      </>}

      {footer}
    </ContextMenu>
  );
}
