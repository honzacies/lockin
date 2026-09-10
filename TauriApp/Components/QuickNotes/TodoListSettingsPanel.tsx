"use client";

import { Type } from "lucide-react";
import type { TodoListStyle, TodoListVariant, TodoTextStyle } from "@/Types/QuickNotes";
import { Popover } from "@/Components/Shared/Popover";
import { ToolButton, Swatch, Stepper } from "@/Components/Shared/StyleControls";
import { ColorPicker } from "@/Components/DocumentView/StyleEditor/ColorPicker";
import { FontPicker } from "@/Components/DocumentView/StyleEditor/FontPicker";
import {
  SETTINGS_SECTION_TITLE,
  SettingsDeleteButton,
  VariantToggle,
  VisibilityToggleList,
} from "@/Components/Shared/SettingsPanelPrimitives";

interface TodoListSettingsPanelProps {
  style: TodoListStyle;
  onChange: (patch: Partial<TodoListStyle>) => void;
  /** Omit to hide the "Delete list" action (e.g. when only one list exists). */
  onDeleteList?: () => void;
}

const VISIBILITY_TOGGLES: { key: keyof TodoListStyle & string; label: string }[] = [
  { key: "showTitle", label: "Title" },
  { key: "showIcon", label: "Icon" },
  { key: "showProgress", label: "Progress" },
  { key: "showDeadline", label: "Deadline" },
  { key: "showDescriptions", label: "Task descriptions" },
];

export function TodoListSettingsPanel({
  style,
  onChange,
  onDeleteList,
}: TodoListSettingsPanelProps) {
  function PatchText(
    field: "heading" | "taskTitle" | "taskDescription" | "groupTitle",
    patch: Partial<TodoTextStyle>,
  ) {
    onChange({ [field]: { ...style[field], ...patch } });
  }

  return (
    <div className="flex w-full flex-col gap-4 p-3">
      {/* Variant */}
      <div className="flex flex-col gap-1.5">
        <span className={SETTINGS_SECTION_TITLE}>Appearance</span>
        <VariantToggle<TodoListVariant>
          options={["solid", "transparent"]}
          value={style.variant}
          onChange={(variant) => onChange({ variant })}
        />
      </div>

      {/* Visibility */}
      <div className="flex flex-col gap-1.5">
        <span className={SETTINGS_SECTION_TITLE}>Show</span>
        <VisibilityToggleList style={style} items={VISIBILITY_TOGGLES} onChange={onChange} />
      </div>

      {/* Checkbox + icon colors */}
      <div className="flex flex-col gap-1.5">
        <span className={SETTINGS_SECTION_TITLE}>Colors</span>
        <div className="flex flex-wrap gap-1.5">
          <Popover
            trigger={(open) => (
              <ToolButton active={open}>
                <Swatch color={style.checkboxColor ?? "#0485f7"} />
                <span>Checkbox</span>
              </ToolButton>
            )}
          >
            {() => (
              <div className="p-3">
                <ColorPicker
                  value={style.checkboxColor}
                  onChange={(checkboxColor) => onChange({ checkboxColor })}
                />
              </div>
            )}
          </Popover>
          <Popover
            trigger={(open) => (
              <ToolButton active={open}>
                <Swatch color={style.iconColor ?? "#5f5e59"} />
                <span>Icon</span>
              </ToolButton>
            )}
          >
            {() => (
              <div className="p-3">
                <ColorPicker
                  value={style.iconColor}
                  onChange={(iconColor) => onChange({ iconColor })}
                />
              </div>
            )}
          </Popover>
        </div>
      </div>

      {/* Heading style */}
      <TextStyleSection
        title="List title style"
        value={style.heading}
        defaultColor="#000000"
        onChange={(patch) => PatchText("heading", patch)}
      />

      {/* Task title style */}
      <TextStyleSection
        title="Task title style"
        value={style.taskTitle}
        defaultColor="#18181b"
        onChange={(patch) => PatchText("taskTitle", patch)}
      />

      {/* Task description style */}
      <TextStyleSection
        title="Task description style"
        value={style.taskDescription}
        defaultColor="#71717a"
        onChange={(patch) => PatchText("taskDescription", patch)}
      />

      {/* Group title style — applies to every group header in this list */}
      <TextStyleSection
        title="Group title style"
        value={style.groupTitle ?? {}}
        defaultColor="#2c2c2b"
        onChange={(patch) => PatchText("groupTitle", patch)}
      />

      {onDeleteList ? (
        <SettingsDeleteButton label="Delete this list" onPress={onDeleteList} />
      ) : null}
    </div>
  );
}

function TextStyleSection({
  title,
  value,
  defaultColor,
  onChange,
}: {
  title: string;
  value: TodoTextStyle;
  defaultColor: string;
  onChange: (patch: Partial<TodoTextStyle>) => void;
}) {
  const size = value.fontSize ?? 14;

  return (
    <div className="flex flex-col gap-1.5">
      <span className={SETTINGS_SECTION_TITLE}>{title}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Popover
          trigger={(open) => (
            <ToolButton active={open}>
              <Type size={13} strokeWidth={1.75} />
              <span>Font</span>
            </ToolButton>
          )}
        >
          {() => (
            <div className="p-3">
              <FontPicker
                value={value.fontFamily}
                onChange={(fontFamily) => onChange({ fontFamily })}
              />
            </div>
          )}
        </Popover>
        <Popover
          trigger={(open) => (
            <ToolButton active={open}>
              <Swatch color={value.color ?? defaultColor} />
              <span>Color</span>
            </ToolButton>
          )}
        >
          {() => (
            <div className="p-3">
              <ColorPicker value={value.color} onChange={(color) => onChange({ color })} />
            </div>
          )}
        </Popover>
        <Stepper
          value={size}
          unit="px"
          onDec={() => onChange({ fontSize: Math.max(8, size - 1) })}
          onInc={() => onChange({ fontSize: Math.min(48, size + 1) })}
        />
      </div>
    </div>
  );
}
