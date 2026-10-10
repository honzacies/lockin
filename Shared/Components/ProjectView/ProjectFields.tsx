"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button, Input } from "@heroui/react";
import {
  Calendar,
  CheckSquare,
  ExternalLink,
  Flag,
  Gauge,
  GripVertical,
  Hash,
  Link2,
  List,
  ListChecks,
  Plus,
  Tag,
  Trash2,
  Type,
  Zap,
  type LucideIcon,
} from "@lockin/shared/Components/Shared/UiIcons";
import type { Project } from "@lockin/shared/Types/Project";
import { BUILTIN_FIELDS, FIELD_TYPE_LABEL, type FieldDefinition, type FieldType, type FieldValue } from "@lockin/shared/Types/ProjectFields";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem } from "@lockin/shared/Components/Shared/ContextMenu";
import { AppCheckbox } from "@lockin/shared/Components/Shared/AppCheckbox";
import { IconPicker } from "@lockin/shared/Components/Shared/IconPicker";
import { IconGlyph } from "@lockin/shared/Components/Shared/IconGlyph";
import { DateCalendar } from "@lockin/shared/Components/Shared/DeadlinePickerPanel";
import { OptionIcon, OptionPill, PickerHeader, PILL_CLASS } from "@lockin/shared/Components/Shared/PriorityStatusPicker";
import { UseFieldStore } from "@lockin/shared/Store/UseFieldStore";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { GetPlatform } from "@lockin/shared/Platform/Platform";
import { ConvertValue, HideField, ReorderFields, SetFieldValue, ShowField, VisibleFields } from "@lockin/shared/Lib/ProjectFields";

const BUILTIN_LABEL: Record<string, { label: string; icon: LucideIcon }> = {
  tags: { label: "Tags", icon: Tag },
  priority: { label: "Priority", icon: Flag },
  status: { label: "Status", icon: Zap },
  progress: { label: "Progress", icon: Gauge },
  deadline: { label: "Deadline", icon: Calendar },
};

const TYPE_ICON: Record<FieldType, LucideIcon> = {
  text: Type,
  number: Hash,
  date: Calendar,
  select: List,
  multiSelect: ListChecks,
  checkbox: CheckSquare,
  url: Link2,
};

const ICON = { size: 14, strokeWidth: 1.75, className: "text-[var(--lk-text2)]" } as const;
const NEUTRAL_PILL = `${PILL_CLASS} bg-black/[0.03] text-[var(--lk-text2)] hover:bg-black/[0.06]`;

/** Ikona pole: vlastní (FieldDefinition.icon), jinak ikona typu. */
function FieldIcon({ field, size = 13 }: { field: Pick<FieldDefinition, "icon" | "type">; size?: number }) {
  if (field.icon) return <IconGlyph icon={field.icon} size={size} />;
  const Icon = TYPE_ICON[field.type];
  return <Icon size={size} strokeWidth={1.75} />;
}

function FormatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Typové chipy (stejné v editoru pole i při zakládání nového). */
function TypeChips({ value, onChange }: { value: FieldType; onChange: (type: FieldType) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(FIELD_TYPE_LABEL) as FieldType[]).map((t) => {
        const Icon = TYPE_ICON[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            aria-pressed={value === t}
            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
              value === t ? "bg-[#0088ff]/10 text-[#0077e0]" : "text-[var(--lk-text2)] hover:bg-black/[0.04]"
            }`}
          >
            <Icon size={11} strokeWidth={1.75} />
            {FIELD_TYPE_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}

/** Výchozí ikona typu jako řetězec pro IconPicker (ukáže ji jako aktuální ikonu pole). */
const TYPE_ICON_NAME: Record<FieldType, string> = {
  text: "lucide:type",
  number: "lucide:hash",
  date: "lucide:calendar",
  select: "lucide:list",
  multiSelect: "lucide:list-checks",
  checkbox: "lucide:square-check",
  url: "lucide:link-2",
};

/**
 * Hodnota pole podle typu — výběr voleb, kalendář, pole pro text/číslo/odkaz
 * nebo zaškrtnutí. Sdílí ho rychlá úprava (levý klik) i nastavení pole.
 * `onCommit` = Enter v textovém poli.
 */
function ValueInput({
  fieldId,
  name,
  type,
  value,
  onChange,
  onCommit,
}: {
  fieldId: string;
  name: string;
  type: FieldType;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  onCommit?: () => void;
}) {
  const [optionDraft, setOptionDraft] = useState("");
  // Selektor musí vracet stabilní referenci (ne nové `[]`), jinak se zustand zacyklí.
  const live = UseFieldStore((s) => s.definitions.find((d) => d.id === fieldId));
  const options = live?.options ?? [];
  const selectedIds = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];

  function ToggleOption(id: string) {
    if (type === "multiSelect") onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
    else onChange(selectedIds[0] === id ? null : id);
  }
  function AddOption() {
    if (!optionDraft.trim()) return;
    // Volba je sdílená — do pole se přidá hned.
    if (!live?.options) UseFieldStore.getState().UpdateField(fieldId, { options: [] });
    const option = UseFieldStore.getState().AddOption(fieldId, optionDraft);
    setOptionDraft("");
    if (option) onChange(type === "multiSelect" ? [...selectedIds, option.id] : option.id);
  }

  if (type === "select" || type === "multiSelect")
    return (
      <div className="flex flex-col gap-px">
        {options.map((option) => (
          <ContextMenuItem key={option.id} icon={<OptionIcon option={option} />} selected={selectedIds.includes(option.id)} onClick={() => ToggleOption(option.id)}>
            {option.label}
          </ContextMenuItem>
        ))}
        <div className="flex items-center gap-1 px-1 pt-1">
          <Input
            value={optionDraft}
            onChange={(e) => setOptionDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") AddOption();
            }}
            placeholder="New option…"
            aria-label="New option name"
            className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[13px] shadow-none"
          />
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Add option"
            isDisabled={!optionDraft.trim()}
            onPress={AddOption}
            className="h-7 w-7 min-w-0 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.06] hover:text-[var(--lk-ink)]"
          >
            <Plus size={14} strokeWidth={1.75} />
          </Button>
        </div>
      </div>
    );
  if (type === "checkbox")
    return (
      <div className="px-1">
        <AppCheckbox checked={value === true} onChange={onChange} label="Checked" className="text-[13px] text-[var(--lk-ink)]" />
      </div>
    );
  if (type === "date")
    return (
      <div className="flex justify-center">
        <DateCalendar label={name || "Date"} date={typeof value === "string" ? value : null} onChange={onChange} />
      </div>
    );
  return (
    <Input
      autoFocus
      type={type === "number" ? "number" : type === "url" ? "url" : "text"}
      value={value === null ? "" : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(type === "number" ? (raw === "" || Number.isNaN(Number(raw)) ? null : Number(raw)) : raw);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit?.();
      }}
      placeholder={type === "url" ? "https://…" : "Empty"}
      aria-label={`${name} value`}
      className="h-8 rounded-md px-2 text-[13px]"
    />
  );
}

/**
 * Pilulka vlastního pole v hlavičce projektu.
 * - Levý klik = hodnota: výběr voleb, kalendář, nebo pole pro text / číslo / odkaz.
 *   Ano/ne se přepne rovnou zaškrtnutím v pilulce.
 * - Pravý klik = nastavení pole (ikona, název, typ, hodnota, Delete / Clear / Save).
 */
export function CustomFieldPill({
  project,
  field,
  onUpdate,
}: {
  project: Project;
  field: FieldDefinition;
  onUpdate: (patch: Partial<Project>) => void;
}) {
  const value = project.fields?.[field.id] ?? null;
  const options = field.options ?? [];
  const SetValue = (next: FieldValue) => onUpdate({ fields: SetFieldValue(project, field.id, next).fields });

  let shown: ReactNode = null;
  if (field.type === "select" || field.type === "multiSelect") {
    const ids = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    const chosen = options.filter((o) => ids.includes(o.id));
    if (chosen.length)
      shown = (
        <span className="flex flex-wrap items-center gap-1">
          {chosen.map((o) => (
            <OptionPill key={o.id} option={o} />
          ))}
        </span>
      );
  } else if (field.type !== "checkbox" && value !== null && value !== "") {
    shown = <span className="max-w-[220px] truncate text-[var(--lk-ink)]">{field.type === "date" ? FormatDate(String(value)) : String(value)}</span>;
  }

  const isCheckbox = field.type === "checkbox";
  return (
    <span className="inline-flex items-center gap-0.5">
      <Popover
        openOnLeftClick={!isCheckbox}
        panelClassName={field.type === "date" ? "w-fit p-2" : "w-60 p-1.5"}
        contextPanelClassName="w-[300px] p-2"
        contextChildren={(close) => <FieldEditor project={project} field={field} onUpdate={onUpdate} close={close} />}
        trigger={() =>
          isCheckbox ? (
            <span data-tooltip="Right-click for property settings" className={`inline-flex items-center ${NEUTRAL_PILL}`}>
              <AppCheckbox checked={value === true} onChange={SetValue} size={14} label={field.name} />
            </span>
          ) : (
            <Button variant="ghost" aria-label={`Change ${field.name}`} data-tooltip="Right-click for property settings" className={NEUTRAL_PILL}>
              <FieldIcon field={field} />
              <span className={shown ? "text-[var(--lk-muted)]" : ""}>{field.name}</span>
              {shown}
            </Button>
          )
        }
      >
        {(close) => <QuickValue field={field} value={value} onChange={SetValue} close={close} />}
      </Popover>
      {field.type === "url" && typeof value === "string" && value ? (
        <Button
          variant="ghost"
          isIconOnly
          aria-label={`Open ${field.name}`}
          onPress={() => GetPlatform().window.OpenUrl(value)}
          className="h-6 w-6 min-w-0 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.05] hover:text-[var(--lk-ink)]"
        >
          <ExternalLink size={13} />
        </Button>
      ) : null}
    </span>
  );
}

/** Levý klik: jen hodnota. Výběr a datum se ukládají hned, text / číslo / odkaz Enterem nebo Save. */
function QuickValue({ field, value, onChange, close }: { field: FieldDefinition; value: FieldValue; onChange: (v: FieldValue) => void; close: () => void }) {
  const [draft, setDraft] = useState<FieldValue>(value);
  const immediate = field.type === "select" || field.type === "multiSelect" || field.type === "date";
  const header = field.type === "select" || field.type === "multiSelect" ? `Available ${field.name}` : field.name;

  if (immediate)
    return (
      <div className="flex flex-col gap-1">
        <PickerHeader title={header} />
        <ValueInput
          fieldId={field.id}
          name={field.name}
          type={field.type}
          value={value}
          onChange={(next) => {
            onChange(next);
            if (field.type !== "multiSelect") close();
          }}
        />
      </div>
    );

  function Commit() {
    onChange(draft);
    close();
  }
  return (
    <div className="flex flex-col gap-1.5">
      <PickerHeader title={header} />
      <ValueInput fieldId={field.id} name={field.name} type={field.type} value={draft} onChange={setDraft} onCommit={Commit} />
      <div className="flex justify-end gap-1">
        <Button variant="ghost" onPress={() => { onChange(null); close(); }} className="h-7 rounded-md px-2.5 text-xs font-medium text-[var(--lk-text2)] hover:bg-black/[0.05]">
          Clear
        </Button>
        <Button variant="ghost" onPress={Commit} className="h-7 rounded-md bg-[#0088ff] px-3 text-xs font-medium text-[#fff] hover:bg-[#0077e0]">
          Save
        </Button>
      </div>
    </div>
  );
}

/** Nastavení pole (pravý klik): všechno je koncept, uloží se až „Save" (název, ikona a typ platí pro všechny projekty). */
function FieldEditor({
  project,
  field,
  onUpdate,
  close,
}: {
  project: Project;
  field: FieldDefinition;
  onUpdate: (patch: Partial<Project>) => void;
  close: () => void;
}) {
  const [name, setName] = useState(field.name);
  const [icon, setIcon] = useState(field.icon);
  const [type, setType] = useState<FieldType>(field.type);
  const [value, setValue] = useState<FieldValue>(project.fields?.[field.id] ?? null);

  function ChangeType(next: FieldType) {
    setValue((v) => ConvertValue(v, type, next));
    setType(next);
  }

  function Save() {
    const store = UseFieldStore.getState();
    const typeChanged = type !== field.type;
    store.UpdateField(field.id, {
      name: name.trim() || field.name,
      icon,
      type,
      ...((type === "select" || type === "multiSelect") && !field.options ? { options: [] } : {}),
    });
    // Změna typu platí pro všechny projekty — jejich hodnoty se převedou taky.
    if (typeChanged) {
      const data = UseDataStore.getState();
      for (const other of Object.values(data.projects)) {
        if (other.id === project.id || !(field.id in (other.fields ?? {}))) continue;
        data.UpsertProject(SetFieldValue(other, field.id, ConvertValue(other.fields![field.id], field.type, type)));
      }
    }
    onUpdate({ fields: SetFieldValue(project, field.id, value).fields });
    close();
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        {/* Bez vlastní ikony ukáže ikonu typu — tu, kterou pole v hlavičce opravdu má. */}
        <IconPicker icon={icon ?? TYPE_ICON_NAME[type]} onChange={setIcon} size={30} glyphScale={0.55} />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") Save();
          }}
          aria-label="Property name"
          placeholder="Property name"
          className="h-8 min-w-0 flex-1 rounded-md px-2 text-[14px] font-medium"
        />
      </div>

      <div className="flex flex-col gap-1">
        <PickerHeader title="Type" />
        <div className="px-1">
          <TypeChips value={type} onChange={ChangeType} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <PickerHeader title={type === "select" || type === "multiSelect" ? `Available ${name.trim() || field.name}` : "Value"} />
        <ValueInput fieldId={field.id} name={name} type={type} value={value} onChange={setValue} onCommit={Save} />
      </div>

      <div className="flex items-center justify-between border-t border-[var(--lk-line)] pt-2">
        <Button
          variant="ghost"
          aria-label="Remove this property from the project"
          onPress={() => {
            const hidden = HideField(SetFieldValue(project, field.id, null), field.id);
            onUpdate({ fields: hidden.fields, hiddenFields: hidden.hiddenFields });
            close();
          }}
          className="h-7 gap-1 rounded-md px-2 text-xs font-medium text-[#e5484d] hover:bg-[#e5484d]/[0.08]"
        >
          <Trash2 size={13} />
          Delete
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" onPress={() => setValue(null)} className="h-7 rounded-md px-2.5 text-xs font-medium text-[var(--lk-text2)] hover:bg-black/[0.05]">
            Clear
          </Button>
          <Button variant="ghost" onPress={Save} className="h-7 rounded-md bg-[#0088ff] px-3 text-xs font-medium text-[#fff] hover:bg-[#0077e0]">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Panel polí (tlačítko na konci řádku polí): zaškrtnutím pole ukáže nebo skryje
 * (hodnota zůstává), viditelná pole jde přeřadit tažením za úchyt — jen tady,
 * v pilulkách v hlavičce se přeřadit omylem nedá. Dole se zakládá nové pole.
 */
export function FieldsMenu({ project, onUpdate, trigger }: { project: Project; onUpdate: (patch: Partial<Project>) => void; trigger: ReactNode }) {
  const definitions = UseFieldStore((s) => s.definitions);
  const visibleList = VisibleFields(project, definitions);
  const visible = new Set(visibleList);
  const all = [...visibleList, ...[...BUILTIN_FIELDS, ...definitions.map((d) => d.id)].filter((id) => !visible.has(id))];
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<{ id: string; index: number } | null>(null);

  function Toggle(id: string) {
    const next = visible.has(id) ? HideField(project, id) : ShowField(project, id);
    onUpdate({ hiddenFields: next.hiddenFields, fieldOrder: next.fieldOrder });
  }
  function Create() {
    if (!name.trim()) return;
    const field = UseFieldStore.getState().AddField(name, type);
    const next = ShowField(project, field.id);
    onUpdate({ hiddenFields: next.hiddenFields, fieldOrder: next.fieldOrder });
    setName("");
  }

  /** Tažení za úchyt mezi viditelnými poli; index = mezera mezi řádky. */
  function StartDrag(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    let index = visibleList.indexOf(id);
    setDrag({ id, index });
    const OnMove = (ev: PointerEvent) => {
      const rows = visibleList.map((v) => rowRefs.current.get(v)?.getBoundingClientRect());
      const hit = rows.findIndex((r) => r && ev.clientY < r.top + r.height / 2);
      index = hit === -1 ? visibleList.length : hit;
      setDrag({ id, index });
    };
    const End = (commit: boolean) => {
      handle.removeEventListener("pointermove", OnMove);
      handle.removeEventListener("pointerup", Up);
      handle.removeEventListener("pointercancel", Cancel);
      window.removeEventListener("blur", Cancel);
      setDrag(null);
      if (!commit) return;
      const rest = visibleList.filter((v) => v !== id);
      const from = visibleList.indexOf(id);
      rest.splice(index > from ? index - 1 : index, 0, id);
      onUpdate({ fieldOrder: ReorderFields(project, rest).fieldOrder });
    };
    const Up = () => End(true);
    const Cancel = () => End(false);
    handle.addEventListener("pointermove", OnMove);
    handle.addEventListener("pointerup", Up);
    handle.addEventListener("pointercancel", Cancel);
    window.addEventListener("blur", Cancel);
  }

  return (
    <Popover panelClassName="w-64 p-1" trigger={() => trigger}>
      {() => (
        <div className="flex flex-col gap-px">
          <PickerHeader title="Properties" />
          {all.map((id) => {
            const field = definitions.find((d) => d.id === id);
            const builtin = BUILTIN_LABEL[id];
            if (!field && !builtin) return null;
            const isVisible = visible.has(id);
            const i = visibleList.indexOf(id);
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) rowRefs.current.set(id, el);
                  else rowRefs.current.delete(id);
                }}
                className={`group/field flex items-center rounded-md ${drag?.id === id ? "opacity-40" : ""} ${
                  drag && isVisible && drag.index === i ? "shadow-[inset_0_2px_0_0_#0088ff]" : ""
                } ${drag && isVisible && drag.index === visibleList.length && i === visibleList.length - 1 ? "shadow-[inset_0_-2px_0_0_#0088ff]" : ""}`}
              >
                {isVisible ? (
                  <button
                    type="button"
                    aria-label={`Drag to reorder ${field?.name ?? builtin.label}`}
                    onPointerDown={(e) => StartDrag(e, id)}
                    className="flex h-7 w-4 shrink-0 cursor-grab items-center justify-center text-[var(--lk-faint)] opacity-0 group-hover/field:opacity-100 active:cursor-grabbing"
                  >
                    <GripVertical size={12} />
                  </button>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <ContextMenuItem
                    icon={
                      field ? (
                        <span className="text-[var(--lk-text2)]">
                          <FieldIcon field={field} size={14} />
                        </span>
                      ) : (
                        <builtin.icon {...ICON} />
                      )
                    }
                    selected={isVisible}
                    onClick={() => Toggle(id)}
                  >
                    {field?.name ?? builtin.label}
                  </ContextMenuItem>
                </div>
                {field ? (
                  confirmDelete === id ? (
                    <Button
                      variant="ghost"
                      onPress={() => {
                        UseFieldStore.getState().RemoveField(id);
                        setConfirmDelete(null);
                      }}
                      className="h-6 min-w-0 shrink-0 rounded-md bg-[#e5484d]/10 px-2 text-[11px] font-medium text-[#e5484d] hover:bg-[#e5484d]/20"
                    >
                      Delete everywhere
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      isIconOnly
                      aria-label={`Delete ${field.name} from all projects`}
                      onPress={() => setConfirmDelete(id)}
                      className="h-6 w-6 min-w-0 shrink-0 rounded-md text-[var(--lk-faint)] opacity-0 hover:bg-[#e5484d]/10 hover:text-[#e5484d] group-hover/field:opacity-100"
                    >
                      <Trash2 size={13} />
                    </Button>
                  )
                ) : null}
              </div>
            );
          })}
          <div className="mt-1 flex flex-col gap-1.5 border-t border-[var(--lk-line)] px-1 pt-1.5 pb-1">
            <PickerHeader title="New property" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") Create();
              }}
              placeholder="Name, e.g. Version"
              aria-label="New property name"
              className="h-7 rounded-md bg-transparent px-1.5 text-[13px] shadow-none"
            />
            <TypeChips value={type} onChange={setType} />
            <Button
              variant="ghost"
              isDisabled={!name.trim()}
              onPress={Create}
              className="h-7 gap-1 rounded-md bg-[#0088ff] text-xs font-medium text-[#fff] hover:bg-[#0077e0] disabled:bg-black/[0.05] disabled:text-[var(--lk-muted)]"
            >
              <Plus size={13} />
              Add property
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}
