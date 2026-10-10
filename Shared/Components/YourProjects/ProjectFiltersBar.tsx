"use client";

import { Button } from "@heroui/react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, Hash, LayoutList, PieChart, Target } from "@lockin/shared/Components/Shared/UiIcons";
import { DEFAULT_TAG_COLOR } from "@lockin/shared/Types/Library";
import { ContextMenuItem } from "@lockin/shared/Components/Shared/ContextMenu";
import { FilterGroup, PILL_ACTIVE, PILL_BASE, PILL_INACTIVE } from "@lockin/shared/Components/Library/LibraryFilters";
import { ManageOptionsButton, OptionIcon, PickerHeader } from "@lockin/shared/Components/Shared/PriorityStatusPicker";
import { UsePriorityStore } from "@lockin/shared/Store/UsePriorityStore";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseFieldStore } from "@lockin/shared/Store/UseFieldStore";
import {
  IsFilterEmpty,
  type DeadlineBucket,
  type ProgressBucket,
  type ProjectFilter,
  type ProjectSort,
  type SortKey,
} from "@lockin/shared/Lib/ProjectFilters";

const PROGRESS: { id: ProgressBucket; label: string }[] = [
  { id: "notStarted", label: "Not started (0 %)" },
  { id: "inProgress", label: "In progress (1–99 %)" },
  { id: "done", label: "Done (100 %)" },
];
const DEADLINE: { id: DeadlineBucket; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "Next 7 days" },
  { id: "month", label: "Next 31 days" },
  { id: "later", label: "Later" },
  { id: "none", label: "No deadline" },
];

/**
 * Lišta filtrů Your Projects. Chip skupiny řadí (klik: řadit → obráceně →
 * vypnout), šipka vedle filtruje na jednu hodnotu. Filtry platí současně,
 * „All Projects" zruší filtry i řazení.
 */
export function ProjectFiltersBar({
  filter,
  onFilterChange,
  sort,
  onSortChange,
}: {
  filter: ProjectFilter;
  onFilterChange: (filter: ProjectFilter) => void;
  sort: ProjectSort | null;
  onSortChange: (sort: ProjectSort | null) => void;
}) {
  const statuses = UsePriorityStore((s) => s.statuses);
  const priorities = UsePriorityStore((s) => s.priorities);
  const tags = UseDataStore((s) => s.tags);
  const definitions = UseFieldStore((s) => s.definitions);
  const filterFields = definitions.filter((d) => d.type === "select" || d.type === "multiSelect" || d.type === "checkbox");
  const pristine = IsFilterEmpty(filter) && !sort;

  /** Řazení: vypnuto → výchozí směr → obrácený → vypnuto. */
  function CycleSort(key: SortKey) {
    if (sort?.key !== key) onSortChange({ key, reversed: false });
    else if (!sort.reversed) onSortChange({ key, reversed: true });
    else onSortChange(null);
  }
  /** Výběr hodnoty; znovu klik na vybranou ji zruší. */
  function Pick<K extends keyof ProjectFilter>(key: K, value: ProjectFilter[K], close: () => void) {
    onFilterChange({ ...filter, [key]: filter[key] === value ? undefined : value });
    close();
  }
  function PickField(fieldId: string, value: string, close: () => void) {
    const fields = { ...(filter.fields ?? {}) };
    if (fields[fieldId] === value) delete fields[fieldId];
    else fields[fieldId] = value;
    onFilterChange({ ...filter, fields });
    close();
  }

  const Label = (text: string, key: SortKey | string) => (
    <>
      {text}
      {sort?.key === key ? (sort.reversed ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : null}
    </>
  );
  /** Props skupiny: aktivní při filtru nebo řazení, chip řadí (vlastní pole jen filtrují). */
  const GroupProps = (sortKey: SortKey | null, filtered: boolean, label: string) => ({
    active: filtered || (sortKey !== null && sort?.key === sortKey),
    label: Label(label, sortKey ?? ""),
    onToggle: () => (sortKey ? CycleSort(sortKey) : undefined),
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        variant="ghost"
        onPress={() => {
          onFilterChange({});
          onSortChange(null);
        }}
        className={`${PILL_BASE} ${pristine ? PILL_ACTIVE : PILL_INACTIVE}`}
      >
        <LayoutList size={16} />
        All Projects
      </Button>

      <FilterGroup {...GroupProps("status", Boolean(filter.status), "By State")} icon={<Target size={16} />} menuLabel="Filter by state">
        {(close) => (
          <>
            <PickerHeader title="Available statuses" action={<ManageOptionsButton label="Manage statuses" onNavigate={close} />} />
            {statuses.map((s) => (
              <ContextMenuItem key={s.id} icon={<OptionIcon option={s} />} selected={filter.status === s.id} onClick={() => Pick("status", s.id, close)}>
                {s.label}
              </ContextMenuItem>
            ))}
          </>
        )}
      </FilterGroup>

      <FilterGroup {...GroupProps("progress", Boolean(filter.progress), "By Progress")} icon={<PieChart size={16} />} menuLabel="Filter by progress">
        {(close) => (
          <>
            <PickerHeader title="Progress" />
            {PROGRESS.map((p) => (
              <ContextMenuItem key={p.id} selected={filter.progress === p.id} onClick={() => Pick("progress", p.id, close)}>
                {p.label}
              </ContextMenuItem>
            ))}
          </>
        )}
      </FilterGroup>

      <FilterGroup {...GroupProps("priority", Boolean(filter.priority), "By Priority")} icon={<ArrowUpDown size={16} />} menuLabel="Filter by priority">
        {(close) => (
          <>
            <PickerHeader title="Available priorities" action={<ManageOptionsButton label="Manage priorities" onNavigate={close} />} />
            {priorities.map((p) => (
              <ContextMenuItem key={p.id} icon={<OptionIcon option={p} />} selected={filter.priority === p.id} onClick={() => Pick("priority", p.id, close)}>
                {p.label}
              </ContextMenuItem>
            ))}
          </>
        )}
      </FilterGroup>

      <FilterGroup {...GroupProps("deadline", Boolean(filter.deadline), "By Deadline")} icon={<CalendarClock size={16} />} menuLabel="Filter by deadline">
        {(close) => (
          <>
            <PickerHeader title="Deadline" />
            {DEADLINE.map((d) => (
              <ContextMenuItem key={d.id} selected={filter.deadline === d.id} onClick={() => Pick("deadline", d.id, close)}>
                {d.label}
              </ContextMenuItem>
            ))}
          </>
        )}
      </FilterGroup>

      <FilterGroup {...GroupProps("tag", Boolean(filter.tagId), "By Tag")} icon={<Hash size={16} />} menuLabel="Filter by tag">
        {(close) => (
          <>
            <PickerHeader title="Your tags" />
            {Object.values(tags).length === 0 ? <p className="px-2 py-1 text-[13px] text-[var(--lk-muted)]">No tags yet</p> : null}
            {Object.values(tags).map((tag) => (
              <ContextMenuItem
                key={tag.id}
                icon={<span className="size-2.5 shrink-0 rounded-full" style={{ background: tag.color ?? DEFAULT_TAG_COLOR }} />}
                selected={filter.tagId === tag.id}
                onClick={() => Pick("tagId", tag.id, close)}
              >
                {tag.name}
              </ContextMenuItem>
            ))}
          </>
        )}
      </FilterGroup>

      {/* Vlastní pole, podle kterých jde filtrovat (výběr, více výběrů, ano/ne). */}
      {filterFields.map((field) => (
        <FilterGroup
          key={field.id}
          {...GroupProps(null, Boolean(filter.fields?.[field.id]), `By ${field.name}`)}
          icon={<Hash size={16} />}
          menuLabel={`Filter by ${field.name}`}
        >
          {(close) => (
            <>
              <PickerHeader title={field.type === "checkbox" ? field.name : `Available ${field.name}`} />
              {field.type === "checkbox" ? (
                <ContextMenuItem selected={filter.fields?.[field.id] === "true"} onClick={() => PickField(field.id, "true", close)}>
                  Checked
                </ContextMenuItem>
              ) : (
                (field.options ?? []).map((o) => (
                  <ContextMenuItem key={o.id} icon={<OptionIcon option={o} />} selected={filter.fields?.[field.id] === o.id} onClick={() => PickField(field.id, o.id, close)}>
                    {o.label}
                  </ContextMenuItem>
                ))
              )}
            </>
          )}
        </FilterGroup>
      ))}
    </div>
  );
}
