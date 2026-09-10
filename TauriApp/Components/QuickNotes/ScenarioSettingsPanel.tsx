"use client";

import type { ScenarioStyle } from "@/Types/Scenario";
import {
  SETTINGS_SECTION_TITLE,
  SettingsDeleteButton,
  VisibilityToggleList,
} from "@/Components/Shared/SettingsPanelPrimitives";

interface ScenarioSettingsPanelProps {
  style: ScenarioStyle;
  onChange: (patch: Partial<ScenarioStyle>) => void;
  /** Omit to hide the "Delete scenario" action. */
  onDeleteScenario?: () => void;
}

const VISIBILITY_TOGGLES: { key: keyof ScenarioStyle & string; label: string }[] = [
  { key: "showName", label: "Name" },
  { key: "showDescription", label: "Description" },
  { key: "showWordCount", label: "Word count" },
  { key: "showDividers", label: "Divider between beats" },
];

export function ScenarioSettingsPanel({
  style,
  onChange,
  onDeleteScenario,
}: ScenarioSettingsPanelProps) {
  return (
    <div className="flex w-56 flex-col gap-4 p-3">
      <div className="flex flex-col gap-1.5">
        <span className={SETTINGS_SECTION_TITLE}>Show</span>
        <VisibilityToggleList style={style} items={VISIBILITY_TOGGLES} onChange={onChange} />
      </div>

      {onDeleteScenario ? (
        <SettingsDeleteButton label="Delete scenario" onPress={onDeleteScenario} />
      ) : null}
    </div>
  );
}
