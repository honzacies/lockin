"use client";

import { useState, type ReactNode } from "react";
import { Button, Input } from "@heroui/react";
import {
  Calendar,
  CheckSquare,
  ExternalLink,
  Flag,
  Gauge,
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
} from "lucide-react";
import type { Project } from "@lockin/shared/Types/Project";
import { BUILTIN_FIELDS, FIELD_TYPE_LABEL, type FieldDefinition, type FieldType, type FieldValue } from "@lockin/shared/Types/ProjectFields";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem } from "@lockin/shared/Components/Shared/ContextMenu";
import { AppCheckbox } from "@lockin/shared/Components/Shared/AppCheckbox";
import { OptionIcon, OptionPill, PickerHeader, PILL_CLASS } from "@lockin/shared/Components/Shared/PriorityStatusPicker";
import { UseFieldStore } from "@lockin/shared/Store/UseFieldStore";
import { GetPlatform } from "@lockin/shared/Platform/Platform";
import { HideField, SetFieldValue, ShowField, VisibleFields } from "@lockin/shared/Lib/ProjectFields";

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

/** Pilulka vlastního pole v hlavičce projektu — podle typu pole. */
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
  const SetValue = (next: FieldValue) => onUpdate({ fields: SetFieldValue(project, field.id, next).fields });
  const Icon = TYPE_ICON[field.type];

  if (field.type === "checkbox") {
    return (
      <div className={`inline-flex items-center ${NEUTRAL_PILL}`}>
        <AppCheckbox checked={value === true} onChange={(checked) => SetValue(checked)} size={14} label={field.name} />
      </div>
    );
  }

  if (field.type === "select" || field.type === "multiSelect") {
    return <SelectFieldPill field={field} value={value} onChange={SetValue} />;
  }

  const shown = value === null || value === "" ? null : field.type === "date" ? FormatDate(String(value)) : String(value);
  return (
    <span className="inline-flex items-center gap-0.5">
      <Popover
        panelClassName="w-64 p-2"
        trigger={() => (
          <Button variant="ghost" aria-label={`Edit ${field.name}`} className={NEUTRAL_PILL}>
            <Icon size={13} strokeWidth={1.75} />
            <span className="text-[var(--lk-muted)]">{field.name}</span>
            {shown ? <span className="max-w-[220px] truncate text-[var(--lk-ink)]">{shown}</span> : null}
          </Button>
        )}
      >
        {(close) => <ValueEditor field={field} value={value} onChange={SetValue} close={close} />}
      </Popover>
      {field.type === "url" && shown ? (
        <Button
          variant="ghost"
          isIconOnly
          aria-label={`Open ${field.name}`}
          onPress={() => GetPlatform().window.OpenUrl(String(value))}
          className="h-6 w-6 min-w-0 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.05] hover:text-[var(--lk-ink)]"
        >
          <ExternalLink size={13} />
        </Button>
      ) : null}
    </span>
  );
}

function FormatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Úprava textu, čísla, data a odkazu — jedno pole, Enter uloží. */
function ValueEditor({ field, value, onChange, close }: { field: FieldDefinition; value: FieldValue; onChange: (v: FieldValue) => void; close: () => void }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  function Commit() {
    const trimmed = draft.trim();
    if (field.type === "number") onChange(trimmed === "" || Number.isNaN(Number(trimmed)) ? null : Number(trimmed));
    else onChange(trimmed || null);
    close();
  }
  return (
    <div className="flex flex-col gap-2">
      <PickerHeader title={field.name} />
      <Input
        autoFocus
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") Commit();
        }}
        placeholder={field.type === "url" ? "https://…" : "Empty"}
        aria-label={field.name}
        className="h-8 rounded-md px-2 text-[13px]"
      />
      <div className="flex justify-between">
        <Button variant="ghost" onPress={() => { onChange(null); close(); }} className="h-7 rounded-md px-2 text-xs font-normal text-[var(--lk-muted)] hover:bg-black/[0.05]">
          Clear
        </Button>
        <Button variant="ghost" onPress={Commit} className="h-7 rounded-md bg-[#0088ff] px-3 text-xs font-medium text-[#fff] hover:bg-[#0077e0]">
          Save
        </Button>
      </div>
    </div>
  );
}

/** Výběr / více výběrů: pilulky zvolených voleb, panel „Available …" s možností přidat volbu. */
function SelectFieldPill({ field, value, onChange }: { field: FieldDefinition; value: FieldValue; onChange: (v: FieldValue) => void }) {
  const [draft, setDraft] = useState("");
  const options = field.options ?? [];
  const selected = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const multi = field.type === "multiSelect";

  function Toggle(id: string, close: () => void) {
    if (multi) onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    else {
      onChange(selected[0] === id ? null : id);
      close();
    }
  }
  function AddOption() {
    const option = UseFieldStore.getState().AddOption(field.id, draft);
    setDraft("");
    if (option) onChange(multi ? [...selected, option.id] : option.id);
  }

  const chosen = options.filter((o) => selected.includes(o.id));
  return (
    <Popover
      panelClassName="w-56 p-1"
      trigger={() => (
        <Button variant="ghost" aria-label={`Change ${field.name}`} className={`h-auto min-w-0 rounded-xl p-0 ${chosen.length ? "" : NEUTRAL_PILL}`}>
          {chosen.length ? (
            <span className="flex flex-wrap items-center gap-1">
              {chosen.map((option) => (
                <OptionPill key={option.id} option={option} />
              ))}
            </span>
          ) : (
            <>
              <List size={13} strokeWidth={1.75} />
              <span className="text-[var(--lk-muted)]">{field.name}</span>
            </>
          )}
        </Button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-px">
          <PickerHeader title={`Available ${field.name}`} />
          {options.map((option) => (
            <ContextMenuItem key={option.id} icon={<OptionIcon option={option} />} selected={selected.includes(option.id)} onClick={() => Toggle(option.id, close)}>
              {option.label}
            </ContextMenuItem>
          ))}
          <div className="mt-1 flex items-center gap-1 border-t border-[var(--lk-line)] px-1 pt-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) AddOption();
              }}
              placeholder="New option…"
              aria-label="New option name"
              className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[13px] shadow-none"
            />
            <Button
              variant="ghost"
              isIconOnly
              aria-label="Add option"
              isDisabled={!draft.trim()}
              onPress={AddOption}
              className="h-7 w-7 min-w-0 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.06] hover:text-[var(--lk-ink)]"
            >
              <Plus size={14} strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}

/**
 * Panel „Properties" (tlačítko na konci řádku polí): zaškrtnutím pole ukáže
 * nebo skryje (hodnota zůstává), dole se zakládá nové vlastní pole.
 * Smazání vlastního pole všude je za ikonou koše s potvrzením.
 */
export function FieldsMenu({ project, onUpdate, trigger }: { project: Project; onUpdate: (patch: Partial<Project>) => void; trigger: ReactNode }) {
  const definitions = UseFieldStore((s) => s.definitions);
  const visible = new Set(VisibleFields(project, definitions));
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  return (
    <Popover panelClassName="w-64 p-1" trigger={() => trigger}>
      {() => (
        <div className="flex flex-col gap-px">
          <PickerHeader title="Properties" />
          {BUILTIN_FIELDS.map((id) => {
            const meta = BUILTIN_LABEL[id];
            return (
              <ContextMenuItem key={id} icon={<meta.icon {...ICON} />} selected={visible.has(id)} onClick={() => Toggle(id)}>
                {meta.label}
              </ContextMenuItem>
            );
          })}
          {definitions.map((field) => {
            const Icon = TYPE_ICON[field.type];
            return (
              <div key={field.id} className="group/field flex items-center">
                <div className="min-w-0 flex-1">
                  <ContextMenuItem icon={<Icon {...ICON} />} selected={visible.has(field.id)} onClick={() => Toggle(field.id)}>
                    {field.name}
                  </ContextMenuItem>
                </div>
                {confirmDelete === field.id ? (
                  <Button
                    variant="ghost"
                    onPress={() => {
                      UseFieldStore.getState().RemoveField(field.id);
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
                    onPress={() => setConfirmDelete(field.id)}
                    className="h-6 w-6 min-w-0 shrink-0 rounded-md text-[var(--lk-faint)] opacity-0 hover:bg-[#e5484d]/10 hover:text-[#e5484d] group-hover/field:opacity-100"
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
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
            <div className="flex flex-wrap gap-1">
              {(Object.keys(FIELD_TYPE_LABEL) as FieldType[]).map((t) => {
                const Icon = TYPE_ICON[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    aria-pressed={type === t}
                    className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      type === t ? "bg-[#0088ff]/10 text-[#0077e0]" : "text-[var(--lk-text2)] hover:bg-black/[0.04]"
                    }`}
                  >
                    <Icon size={11} strokeWidth={1.75} />
                    {FIELD_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
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
