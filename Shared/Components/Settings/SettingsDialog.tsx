"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Checkbox as HCheckbox,
  Kbd,
  ListBox,
  Select as HSelect,
  Switch as HSwitch,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import {
  ArrowDown,
  ArrowUp,
  Blocks,
  Bot,
  Check,
  Copy,
  Eye,
  EyeOff,
  Info,
  Keyboard,
  ListX,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sun,
  Tags,
  Timer,
  Trash2,
  Type,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ResolvedTheme,
  UseSettingsStore,
  type SettingsSection,
  type StartPage,
  type ThemePreference,
} from "@lockin/shared/Store/UseSettingsStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { UseSidebarStore, type SidebarNavId, type SidebarSectionId } from "@lockin/shared/Store/UseSidebarStore";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { UseIgnoredListsStore } from "@lockin/shared/Store/UseIgnoredListsStore";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseTodoStore } from "@lockin/shared/Store/UseTodoStore";
import { ActiveWorkspace } from "@lockin/shared/Lib/Workspace";
import { FindLists } from "@lockin/shared/Lib/CollectTodoSources";
import { PlayChime } from "@lockin/shared/Lib/Chime";
import { ComboFromEvent, SHORTCUTS, ShortcutFor, type ShortcutId } from "@lockin/shared/Lib/Shortcuts";
import { TagColorPicker } from "@lockin/shared/Components/Shared/TagColorPicker";
import { IconPicker } from "@lockin/shared/Components/Shared/IconPicker";
import { LockInLogo } from "@lockin/shared/Components/Shared/LockInLogo";
import { NAV_META, SECTION_META } from "@lockin/shared/Components/AppShell/Sidebar";
import { WindowControls } from "@lockin/shared/Components/AppShell/WindowControls";
import { SLASH_COMMAND_ITEMS } from "@lockin/shared/Components/DocumentView/Editor/SlashCommand/SlashCommandItems";

// ── navigace ─────────────────────────────────────────────────────────────────

interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  description: string;
}

const GROUPS: { label: string; sections: SectionMeta[] }[] = [
  {
    label: "LockIn",
    sections: [
      { id: "general", label: "General", icon: Settings2, description: "Where LockIn opens and which workspace you're in." },
      { id: "appearance", label: "Appearance", icon: Sun, description: "Light, dark, or follow your system." },
      { id: "ai", label: "AI & MCP", icon: Bot, description: "Let AI agents read and change your workspace." },
      { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, description: "Change the app shortcuts to whatever your fingers prefer." },
    ],
  },
  {
    label: "Notes",
    sections: [
      { id: "editor", label: "Editor", icon: Type, description: "How documents look and behave while you write." },
      { id: "blocks", label: "Blocks", icon: Blocks, description: "Pick which blocks the / menu offers — hide whole groups you never use." },
      { id: "sidebar", label: "Sidebar", icon: PanelLeft, description: "Choose and order what the Notes sidebar shows." },
    ],
  },
  {
    label: "To-do",
    sections: [
      { id: "session", label: "Focus sessions", icon: Timer, description: "Timers, sounds and the pinned session window." },
      { id: "options", label: "Priorities & statuses", icon: Tags, description: "The labels and colors your projects use." },
      { id: "lists", label: "Ignored lists", icon: ListX, description: "Checklists that don't count as tasks." },
    ],
  },
];
const ABOUT: SectionMeta = { id: "about", label: "About", icon: Info, description: "LockIn, its license and where your data lives." };
const ALL_SECTIONS = [...GROUPS.flatMap((g) => g.sections), ABOUT];

// ── stavební kameny ──────────────────────────────────────────────────────────

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <HSwitch isSelected={checked} onChange={onChange} aria-label={label} size="sm" className="shrink-0">
      <HSwitch.Content>
        <HSwitch.Control>
          <HSwitch.Thumb />
        </HSwitch.Control>
      </HSwitch.Content>
    </HSwitch>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set([value])}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next !== undefined) onChange(String(next) as T);
      }}
      size="sm"
      className="shrink-0"
    >
      {options.map((option) => (
        <ToggleButton key={option.value} id={option.value}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <HSelect
      aria-label={label}
      selectedKey={value}
      onSelectionChange={(key) => key !== null && onChange(String(key) as T)}
      className="w-[190px] shrink-0"
    >
      <HSelect.Trigger>
        <HSelect.Value />
        <HSelect.Indicator />
      </HSelect.Trigger>
      <HSelect.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </HSelect.Popover>
    </HSelect>
  );
}

function SmallButton({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <Button size="sm" variant={danger ? "danger-soft" : "secondary"} onPress={onClick} className="shrink-0">
      {children}
    </Button>
  );
}

/** Karta s řádky nastavení — mezi řádky tenká čára. */
function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title ? <h3 className="px-1 text-[11px] font-semibold tracking-wider text-[var(--lk-subtle)] uppercase">{title}</h3> : null}
      <div className="-mx-4 flex flex-col">{children}</div>
    </section>
  );
}

function Row({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-6 px-4 py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium text-[var(--lk-ink)]">{title}</p>
        {description ? <p className="text-[13px] leading-snug text-[var(--lk-muted)]">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Klávesa jako text („Ctrl", „K") — symboly ⌃⌘ z Kbd.Abbr jsou macOS, LockIn cílí na Windows. */
function Keys({ combo }: { combo: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {combo.split("+").map((key, i) => (
        <Kbd key={`${key}-${i}`}>
          <Kbd.Content>{key}</Kbd.Content>
        </Kbd>
      ))}
    </span>
  );
}

// ── sekce ────────────────────────────────────────────────────────────────────

function GeneralSection() {
  const { startPage, Set } = UseSettingsStore();
  const workspace = ActiveWorkspace();
  return (
    <>
      <Card>
        <Row title="Open on start" description="The page LockIn shows when you launch it.">
          <Select<StartPage>
            label="Open on start"
            value={startPage}
            onChange={(value) => Set({ startPage: value })}
            options={[
              { value: "last", label: "Where I left off" },
              { value: "/YourProjects", label: "Your Projects" },
              { value: "/QuickNotes", label: "Quick Notes" },
              { value: "/Todo", label: "To-do Home" },
              { value: "/Library", label: "Library" },
            ]}
          />
        </Row>
      </Card>
      <Card title="Workspace">
        <Row
          title={workspace.name}
          description={
            workspace.path ? (
              <>
                Folder workspace — your notes are the <code className="font-mono text-[12px]">.md</code> files in{" "}
                <span className="font-mono text-[12px] text-[var(--lk-text2)]">{workspace.path}</span>
              </>
            ) : (
              "Stored in LockIn's own data folder on this computer."
            )
          }
        />
        <Row title="Switch or add a workspace" description="Use the workspace menu at the top of the sidebar — it can open any folder, like an Obsidian vault." />
      </Card>
    </>
  );
}

function ThemeCard({ value, label, icon: Icon }: { value: ThemePreference; label: string; icon: LucideIcon }) {
  const { theme, Set } = UseSettingsStore();
  const selected = theme === value;
  const dark = value === "dark";
  const half = value === "system";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => Set({ theme: value })}
      className={`flex flex-1 flex-col gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
        selected ? "border-[#0088ff] ring-3 ring-[#0088ff]/15" : "border-[var(--lk-line)] hover:border-[var(--lk-line2)]"
      }`}
    >
      {/* Miniatura okna — aby bylo vidět, co volba udělá. */}
      <div
        className="relative flex h-[92px] overflow-hidden rounded-lg border border-black/10"
        style={{ background: half ? "linear-gradient(90deg,#ffffff 50%,#191918 50%)" : dark ? "#191918" : "#ffffff" }}
      >
        <div className="w-1/3 border-r border-black/10" style={{ background: dark ? "#1f1f1e" : half ? "#f9f8f7" : "#f9f8f7" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="mx-2 mt-2 h-1.5 rounded-full" style={{ background: dark ? "#3a3a39" : "#e2e0dc", width: `${70 - i * 15}%` }} />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
          <div className="h-2 w-1/2 rounded-full" style={{ background: dark ? "#e6e5e3" : "#2c2c2b" }} />
          <div className="h-1.5 w-4/5 rounded-full" style={{ background: dark || half ? "#5f5e59" : "#d9d9d9" }} />
          <div className="h-1.5 w-3/5 rounded-full" style={{ background: dark || half ? "#5f5e59" : "#d9d9d9" }} />
          <div className="mt-auto h-3 w-8 rounded-full bg-[#0088ff]" />
        </div>
      </div>
      <span className="flex items-center gap-1.5 px-0.5 text-[13px] font-medium text-[var(--lk-ink)]">
        <Icon size={14} strokeWidth={1.75} />
        {label}
        {selected ? <Check size={14} className="ml-auto text-[#0088ff]" /> : null}
      </span>
    </button>
  );
}

function AppearanceSection() {
  const theme = UseSettingsStore((s) => s.theme);
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-[var(--lk-ink)]">Theme</p>
          <p className="text-[13px] text-[var(--lk-muted)]">
            {theme === "system" ? `Following your system — currently ${ResolvedTheme("system")}.` : "Applies to every window, including the session window."}
          </p>
        </div>
        <div role="radiogroup" aria-label="Theme" className="flex gap-3">
          <ThemeCard value="light" label="Light" icon={Sun} />
          <ThemeCard value="dark" label="Dark" icon={Moon} />
          <ThemeCard value="system" label="System" icon={Monitor} />
        </div>
      </div>
    </Card>
  );
}

function AiSection() {
  const { mcpWrites, Set } = UseSettingsStore();
  const [copied, setCopied] = useState(false);
  const command = "claude mcp add --scope user lockin -- bun <path-to-lockin>/Mcp/index.ts";
  return (
    <>
      <Card>
        <Row
          title="Allow AI agents to make changes"
          description="Ticking tasks, writing notes, planning the board. Turn off to let agents only read."
        >
          <Switch label="Allow AI agents to make changes" checked={mcpWrites} onChange={(value) => Set({ mcpWrites: value })} />
        </Row>
        <Row
          title="Status"
          description={`LockIn is listening for agents in “${ActiveWorkspace().name}”. Agents can only change the workspace that's open here.`}
        >
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#30a46c]/10 px-2.5 py-1 text-[12px] font-medium text-[#1f7a4d]">
            <span className="size-1.5 rounded-full bg-[#30a46c]" />
            Ready
          </span>
        </Row>
      </Card>
      <Card title="Connect an agent">
        <div className="flex flex-col gap-3 p-4">
          <p className="text-[13px] text-[var(--lk-text2)]">
            Run this once in a terminal (Claude Code). Cursor, Claude Desktop, VS Code and Codex use the same command —
            the README has a ready config for each.
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-[#1e1e1d] py-2 pr-2 pl-3 ring-1 ring-[#fff]/10">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#ececea]">{command}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(command).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="flex h-7 shrink-0 items-center gap-1 rounded-md bg-[#fff]/10 px-2 text-[12px] font-medium text-[#fff] hover:bg-[#fff]/20"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}

/** Zkratky editoru — patří Tiptapu, měnit nejdou. */
const FIXED_SHORTCUTS: { combo: string; label: string }[] = [
  { combo: "/", label: "Insert a block in the editor" },
  { combo: "Ctrl+B", label: "Bold" },
  { combo: "Ctrl+I", label: "Italic" },
  { combo: "Ctrl+Z", label: "Undo" },
  { combo: "Ctrl+Shift+Z", label: "Redo" },
  { combo: "Ctrl+S", label: "Save the canvas" },
  { combo: "Esc", label: "Close dialogs and menus" },
];

/** Řádek přemapovatelné zkratky: „Change" → stiskni novou kombinaci (Esc zruší). */
function ShortcutRow({ id, label, fallback }: { id: ShortcutId; label: string; fallback: string }) {
  const { shortcuts, Set: SetSettings } = UseSettingsStore();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = ShortcutFor(id, shortcuts);

  useEffect(() => {
    if (!recording) return;
    const OnKeyDown = (e: KeyboardEvent) => {
      // Zachytit dřív, než ji dostane aplikace (jinak by se třeba otevřelo hledání).
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") return setRecording(false);
      const combo = ComboFromEvent(e);
      if (!combo) return setError("Use Ctrl or Alt with a key (or an F-key).");
      const clash = SHORTCUTS.find((s) => s.id !== id && ShortcutFor(s.id, shortcuts) === combo);
      if (clash) return setError(`Already used by “${clash.label}”.`);
      SetSettings({ shortcuts: { ...shortcuts, [id]: combo } });
      setError(null);
      setRecording(false);
    };
    window.addEventListener("keydown", OnKeyDown, true);
    return () => window.removeEventListener("keydown", OnKeyDown, true);
  }, [recording, id, shortcuts, SetSettings]);

  return (
    <Row title={label} description={error ?? (recording ? "Press the new shortcut — Esc to cancel." : undefined)}>
      {recording ? (
        <span className="shrink-0 rounded-md bg-[#0088ff]/10 px-2 py-1 text-[12px] font-medium text-[#0077e0]">Recording…</span>
      ) : (
        <Keys combo={current} />
      )}
      <Button size="sm" variant="ghost" onPress={() => (setError(null), setRecording((r) => !r))} className="shrink-0">
        {recording ? "Cancel" : "Change"}
      </Button>
      {shortcuts[id] && !recording ? (
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={`Reset to ${fallback}`}
          onPress={() => {
            const { [id]: _removed, ...rest } = shortcuts;
            SetSettings({ shortcuts: rest });
          }}
          className="shrink-0"
        >
          <RotateCcw size={14} />
        </Button>
      ) : null}
    </Row>
  );
}

function ShortcutsSection() {
  return (
    <>
      <Card title="App">
        {SHORTCUTS.map((shortcut) => (
          <ShortcutRow key={shortcut.id} id={shortcut.id} label={shortcut.label} fallback={shortcut.default} />
        ))}
      </Card>
      <Card title="Editor">
        {FIXED_SHORTCUTS.map((shortcut) => (
          <Row key={shortcut.label} title={shortcut.label}>
            <Keys combo={shortcut.combo} />
          </Row>
        ))}
      </Card>
    </>
  );
}

function EditorSection() {
  const { spellcheck, newDocumentsSmallText, Set } = UseSettingsStore();
  const isDocumentWide = UseUiStore((s) => s.isDocumentWide);
  const toggleWide = UseUiStore((s) => s.ToggleDocumentWide);
  const hasDefaultStyle = UseUiStore((s) => Object.keys(s.defaultDocumentStyle ?? {}).length > 0);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <>
      <Card>
        <Row title="Full-width documents" description="Let text use the whole window instead of a comfortable reading column.">
          <Switch label="Full-width documents" checked={isDocumentWide} onChange={toggleWide} />
        </Row>
        <Row title="Small text in new documents" description="New documents start with the smaller text size. You can change it per document.">
          <Switch label="Small text in new documents" checked={newDocumentsSmallText} onChange={(value) => Set({ newDocumentsSmallText: value })} />
        </Row>
        <Row title="Spell check" description="Underline misspelled words. Applies to documents you open next.">
          <Switch label="Spell check" checked={spellcheck} onChange={(value) => Set({ spellcheck: value })} />
        </Row>
      </Card>
      <Card title="Default block styles">
        <Row
          title="Reset default styles"
          description={
            hasDefaultStyle
              ? "New documents use the fonts and colors you saved with “Apply to all future documents”. Existing documents keep theirs."
              : "You haven't saved any default styles — new documents use LockIn's defaults."
          }
        >
          {hasDefaultStyle ? (
            <SmallButton
              danger={confirmReset}
              onClick={() => {
                if (!confirmReset) return setConfirmReset(true);
                UseUiStore.setState({ defaultDocumentStyle: {} });
                setConfirmReset(false);
              }}
            >
              <RotateCcw size={14} />
              {confirmReset ? "Click again to reset" : "Reset"}
            </SmallButton>
          ) : null}
        </Row>
      </Card>
    </>
  );
}

function OrderList<T extends string>({
  ids,
  hidden,
  meta,
  onMove,
  onToggle,
}: {
  ids: T[];
  hidden: T[];
  meta: Record<T, { label: string }>;
  onMove: (id: T, direction: "up" | "down") => void;
  onToggle: (id: T) => void;
}) {
  return (
    <>
      {ids.map((id, index) => {
        const isHidden = hidden.includes(id);
        return (
          <div key={id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`flex-1 text-sm ${isHidden ? "text-[var(--lk-subtle)] line-through" : "text-[var(--lk-ink)]"}`}>{meta[id].label}</span>
            <IconAction label={`Move ${meta[id].label} up`} disabled={index === 0} onClick={() => onMove(id, "up")}>
              <ArrowUp size={15} />
            </IconAction>
            <IconAction label={`Move ${meta[id].label} down`} disabled={index === ids.length - 1} onClick={() => onMove(id, "down")}>
              <ArrowDown size={15} />
            </IconAction>
            <IconAction label={isHidden ? `Show ${meta[id].label}` : `Hide ${meta[id].label}`} onClick={() => onToggle(id)}>
              {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
            </IconAction>
          </div>
        );
      })}
    </>
  );
}

function IconAction({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-[var(--lk-text2)] hover:bg-black/[0.05] disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SidebarSection() {
  const sidebar = UseSidebarStore();
  return (
    <>
      <Card title="Pages">
        <OrderList<SidebarNavId>
          ids={sidebar.navOrder}
          hidden={sidebar.hiddenNav}
          meta={NAV_META}
          onMove={sidebar.MoveNav}
          onToggle={sidebar.ToggleNavHidden}
        />
      </Card>
      <Card title="Sections">
        <OrderList<SidebarSectionId>
          ids={sidebar.sectionOrder}
          hidden={sidebar.hiddenSections}
          meta={SECTION_META}
          onMove={sidebar.MoveSection}
          onToggle={sidebar.ToggleSectionHidden}
        />
      </Card>
    </>
  );
}

/** Checkbox s mezistavem (skupina, kde je zapnutá jen část bloků). */
function Checkbox({ checked, indeterminate, disabled, onChange, label }: { checked: boolean; indeterminate?: boolean; disabled?: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <HCheckbox aria-label={label} isSelected={checked} isIndeterminate={indeterminate} isDisabled={disabled} onChange={onChange} className="shrink-0">
      <HCheckbox.Content>
        <HCheckbox.Control>
          <HCheckbox.Indicator />
        </HCheckbox.Control>
      </HCheckbox.Content>
    </HCheckbox>
  );
}

const GROUP_LABEL: Record<string, string> = {
  TEXT: "Text",
  STYLING: "Styling",
  LIST: "Lists",
  MEDIA: "Media",
  "WEB DESIGN": "Web design",
  "MOVIE/VIDEO CREATING": "Movie & video",
};
/** Bez odstavce by nešlo psát — ten vypnout nejde. */
const ALWAYS_ON = new Set(["Paragraph"]);

function BlocksSection() {
  const { disabledBlocks, Set: SetSettings } = UseSettingsStore();
  const groups = useMemo(() => {
    const map = new Map<string, typeof SLASH_COMMAND_ITEMS>();
    for (const item of SLASH_COMMAND_ITEMS) map.set(item.group, [...(map.get(item.group) ?? []), item]);
    return [...map.entries()];
  }, []);
  const Toggle = (titles: string[], on: boolean) =>
    SetSettings({ disabledBlocks: on ? disabledBlocks.filter((t) => !titles.includes(t)) : [...new Set([...disabledBlocks, ...titles])] });

  return (
    <>
      {groups.map(([group, items]) => {
        const toggleable = items.filter((i) => !ALWAYS_ON.has(i.title)).map((i) => i.title);
        const off = toggleable.filter((t) => disabledBlocks.includes(t)).length;
        return (
          <section key={group} className="flex flex-col gap-1">
            <label className="flex cursor-pointer items-center gap-3 px-1 py-1.5">
              <Checkbox
                label={`All ${GROUP_LABEL[group] ?? group} blocks`}
                checked={off === 0}
                indeterminate={off > 0 && off < toggleable.length}
                disabled={!toggleable.length}
                onChange={(on) => Toggle(toggleable, on)}
              />
              <span className="text-[11px] font-semibold tracking-wider text-[var(--lk-subtle)] uppercase">{GROUP_LABEL[group] ?? group}</span>
            </label>
            {items.map((item) => {
              const locked = ALWAYS_ON.has(item.title);
              const Icon = typeof item.icon === "string" ? null : item.icon;
              return (
                <label key={item.title} className={`flex items-center gap-3 rounded-lg py-2 pr-1 pl-8 ${locked ? "" : "cursor-pointer hover:bg-black/[0.02]"}`}>
                  <Checkbox label={item.title} checked={!disabledBlocks.includes(item.title)} disabled={locked} onChange={(on) => Toggle([item.title], on)} />
                  {Icon ? <Icon size={16} strokeWidth={1.75} className="shrink-0 text-[var(--lk-text2)]" /> : <span className="size-4 shrink-0" />}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-[var(--lk-ink)]">{item.title}</span>
                    <span className="truncate text-[12.5px] text-[var(--lk-muted)]">{locked ? "Always available" : item.description}</span>
                  </span>
                </label>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

const ESTIMATES = ["none", "15", "25", "30", "45", "60", "90"] as const;

function SessionSection() {
  const { defaultEstimateMin, timeUpSound, continueAfterDone, sessionMonitor, Set } = UseSettingsStore();
  return (
    <>
      <Card title="Timer">
        <Row title="Default time estimate" description="New board tasks count down from this. “No estimate” runs a stopwatch instead.">
          <Select<(typeof ESTIMATES)[number]>
            label="Default time estimate"
            value={defaultEstimateMin === null ? "none" : (String(defaultEstimateMin) as (typeof ESTIMATES)[number])}
            onChange={(value) => Set({ defaultEstimateMin: value === "none" ? null : Number(value) })}
            options={ESTIMATES.map((value) => ({ value, label: value === "none" ? "No estimate" : `${value} minutes` }))}
          />
        </Row>
        <Row title="Sound when time is up" description="A short chime once a task's estimate runs out.">
          <span className="flex items-center gap-2">
            <IconAction label="Play the sound" onClick={PlayChime}>
              <Volume2 size={15} />
            </IconAction>
            <Switch label="Sound when time is up" checked={timeUpSound} onChange={(value) => Set({ timeUpSound: value })} />
          </span>
        </Row>
        <Row
          title="Keep going after Done"
          description="When you finish a task, the timer moves straight on to the next one. Off: the session pauses until you continue."
        >
          <Switch label="Keep going after Done" checked={continueAfterDone} onChange={(value) => Set({ continueAfterDone: value })} />
        </Row>
      </Card>
      <Card title="Session window">
        <Row title="Open the session window on" description="With more than one monitor, LockIn can ask each time or always use your main one.">
          <Segmented
            label="Open the session window on"
            value={sessionMonitor}
            onChange={(value) => Set({ sessionMonitor: value })}
            options={[
              { value: "ask", label: "Ask me" },
              { value: "primary", label: "Main monitor" },
            ]}
          />
        </Row>
      </Card>
    </>
  );
}

function OptionsCard({ kind }: { kind: "priority" | "status" }) {
  const store = UsePriorityStore();
  const options = kind === "priority" ? store.priorities : store.statuses;
  const Update = kind === "priority" ? store.UpdatePriority : store.UpdateStatus;
  const Remove = kind === "priority" ? store.RemovePriority : store.RemoveStatus;
  const Add = kind === "priority" ? store.AddPriority : store.AddStatus;
  return (
    <Card title={kind === "priority" ? "Priorities" : "Statuses"}>
      {options.map((option) => (
        <div key={option.id} className="flex items-center gap-3 px-4 py-2">
          <TagColorPicker color={option.color} onChange={(color) => Update(option.id, { color })} size={20} />
          <IconPicker icon={option.icon} onChange={(icon) => Update(option.id, { icon })} size={26} glyphScale={0.6} />
          <input
            value={option.label}
            onChange={(e) => Update(option.id, { label: e.target.value })}
            aria-label={`${kind === "priority" ? "Priority" : "Status"} name`}
            className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm text-[var(--lk-ink)] outline-none hover:border-[var(--lk-line2)] focus:border-[#0088ff] focus:bg-white"
          />
          <IconAction label={`Delete ${option.label}`} disabled={options.length <= 1} onClick={() => Remove(option.id)}>
            <Trash2 size={15} />
          </IconAction>
        </div>
      ))}
      <button
        type="button"
        onClick={Add}
        className="flex items-center gap-2 px-4 py-2.5 text-left text-[13px] font-medium text-[var(--lk-text2)] hover:bg-black/[0.02]"
      >
        <Plus size={15} />
        Add {kind === "priority" ? "priority" : "status"}
      </button>
    </Card>
  );
}

function IgnoredListsSection() {
  const ids = UseIgnoredListsStore((s) => s.ids);
  const setIgnored = UseIgnoredListsStore((s) => s.SetIgnored);
  const documents = UseDataStore((s) => s.documents);
  const quickLists = UseTodoStore((s) => s.lists);
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of quickLists) map.set(list.id, `${list.title || "To-do"} · Quick Notes`);
    for (const doc of Object.values(documents)) {
      for (const list of FindLists(doc.id, doc.text?.json)) map.set(list.id, `${list.title || "To-do"} · ${doc.name || "Untitled"}`);
    }
    return map;
  }, [documents, quickLists]);
  return (
    <Card>
      {ids.length === 0 ? (
        <Row
          title="No ignored lists"
          description="Ignore a reusable checklist from its menu on To-do Home — it stops counting as tasks for you and for AI agents."
        />
      ) : (
        ids.map((id) => (
          <Row key={id} title={names.get(id)?.split(" · ")[0] ?? "Removed list"} description={names.get(id)?.split(" · ")[1] ?? "This list no longer exists."}>
            <SmallButton onClick={() => setIgnored(id, false)}>
              <RotateCcw size={14} />
              Count again
            </SmallButton>
          </Row>
        ))
      )}
    </Card>
  );
}

function AboutSection() {
  return (
    <>
      <div className="flex items-center gap-4 py-2">
        <LockInLogo size={56} />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold text-[var(--lk-ink)]">LockIn</p>
          <p className="text-[13px] text-[var(--lk-muted)]">Notes, to-dos and focus sessions in one app. Beta.</p>
        </div>
      </div>
      <Card>
        <Row title="License" description="Open source under the Apache License 2.0. The name and logo are not part of the license." />
        <Row title="Source code" description="github.com/honzacies/lockin">
          <a
            href="https://github.com/honzacies/lockin"
            target="_blank"
            rel="noreferrer"
            className="flex h-8 shrink-0 items-center rounded-lg border border-[var(--lk-line2)] bg-white px-3 text-[13px] font-medium text-[var(--lk-ink)] hover:bg-black/[0.03]"
          >
            Open on GitHub
          </a>
        </Row>
        <Row
          title="Your data"
          description={
            ActiveWorkspace().path
              ? `Notes live in your folder (${ActiveWorkspace().path}). Icons, favorites and the board live in LockIn's app data folder.`
              : "Everything lives in LockIn's app data folder on this computer — no account, no cloud."
          }
        />
      </Card>
    </>
  );
}

const SECTION_VIEW: Record<SettingsSection, () => ReactNode> = {
  general: GeneralSection,
  appearance: AppearanceSection,
  ai: AiSection,
  shortcuts: ShortcutsSection,
  editor: EditorSection,
  blocks: BlocksSection,
  sidebar: SidebarSection,
  session: SessionSection,
  options: () => (
    <>
      <OptionsCard kind="priority" />
      <OptionsCard kind="status" />
    </>
  ),
  lists: IgnoredListsSection,
  about: AboutSection,
};

// ── dialog ───────────────────────────────────────────────────────────────────

/** Nastavení přes celou obrazovku — Ctrl+, nebo ozubené kolečko v sidebaru. */
export function SettingsDialog() {
  const open = UseSettingsStore((s) => s.open);
  const Open = UseSettingsStore((s) => s.Open);
  const Close = UseSettingsStore((s) => s.Close);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const OnKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") Close();
    };
    // Pod dialogem se nic nescrolluje — kolečko mimo panel se zahodí
    // (uvnitř panelu scrollují jen jeho vlastní sloupce, overscroll-contain).
    const OnScrollIntent = (e: Event) => {
      // Rozbalený seznam (Select) je v portálu mimo panel — ten scrollovat smí.
      const target = e.target as Element;
      if (!panelRef.current?.contains(target) && !target.closest?.('[role="listbox"]')) e.preventDefault();
    };
    const blocking = { passive: false, capture: true } as const;
    window.addEventListener("keydown", OnKeyDown);
    window.addEventListener("wheel", OnScrollIntent, blocking);
    window.addEventListener("touchmove", OnScrollIntent, blocking);
    return () => {
      window.removeEventListener("keydown", OnKeyDown);
      window.removeEventListener("wheel", OnScrollIntent, blocking);
      window.removeEventListener("touchmove", OnScrollIntent, blocking);
    };
  }, [open, Close]);

  if (!open) return null;
  const section = ALL_SECTIONS.find((s) => s.id === open) ?? ALL_SECTIONS[0];
  const View = SECTION_VIEW[section.id];

  function NavItem({ meta }: { meta: SectionMeta }) {
    const Icon = meta.icon;
    const active = meta.id === section.id;
    return (
      <button
        type="button"
        onClick={() => Open(meta.id)}
        aria-current={active ? "page" : undefined}
        // Stejný vzhled jako řádky v sidebaru (aktivní = pill pozadí).
        className={`flex w-full items-center gap-[5px] rounded-lg px-[5px] py-[3px] text-left text-[15px] ${
          active ? "bg-[var(--lk-pill)] text-[var(--lk-fg)]" : "text-[var(--lk-text2)] hover:bg-black/[0.03]"
        }`}
      >
        <Icon size={18} strokeWidth={1.5} />
        {meta.label}
      </button>
    );
  }

  return (
    <div
      className="lockin-fade-in fixed inset-0 z-[200] flex items-center justify-center bg-[#000]/50 px-6 pt-[60px] pb-6 backdrop-blur-md"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) Close();
      }}
    >
      {/* Titlebar zůstává použitelný i nad rozmazaným pozadím: tažení okna a minimalizace/maximalizace/zavření. */}
      <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-[52px]" />
      <div className="absolute top-0 right-0 h-[52px]">
        <WindowControls />
      </div>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="lockin-pop-in flex h-[min(720px,100%)] w-[min(1080px,100%)] overflow-hidden rounded-2xl bg-white shadow-[0_30px_90px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
      >
        <nav aria-label="Settings sections" className="flex w-[250px] shrink-0 flex-col gap-5 overflow-y-auto overscroll-contain border-r border-[var(--lk-line)] bg-[var(--lk-panel)] p-2.5">
          <div className="flex items-center gap-2 px-2 pt-1.5">
            <SlidersHorizontal size={16} className="text-[var(--lk-muted)]" />
            <p className="text-[13px] font-semibold text-[var(--lk-ink)]">Settings</p>
          </div>
          {GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-[var(--lk-subtle)] uppercase">{group.label}</p>
              {group.sections.map((meta) => (
                <NavItem key={meta.id} meta={meta} />
              ))}
            </div>
          ))}
          <div className="mt-auto flex flex-col gap-0.5">
            <NavItem meta={ABOUT} />
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-start gap-4 px-8 pt-7 pb-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="text-[22px] font-semibold tracking-[-0.4px] text-[var(--lk-ink)]">{section.label}</h2>
              <p className="text-sm text-[var(--lk-muted)]">{section.description}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={Close}
              aria-label="Close settings (Esc)"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--lk-muted)] hover:bg-black/[0.05] hover:text-[var(--lk-ink)]"
            >
              <X size={18} />
            </button>
          </header>
          <div key={section.id} className="lockin-fade-in flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-8 py-6">
            <View />
          </div>
        </div>
      </div>
    </div>
  );
}
