"use client";

import { Button } from "@heroui/react";
import type { ColorFormat, ColorPaletteStyle, ColorPaletteVariant } from "@/Types/ColorPalette";
import {
  SETTINGS_SECTION_TITLE,
  SettingsDeleteButton,
  VariantToggle,
  VisibilityToggleList,
} from "@/Components/Shared/SettingsPanelPrimitives";

interface ColorPaletteSettingsPanelProps {
  style: ColorPaletteStyle;
  onChange: (patch: Partial<ColorPaletteStyle>) => void;
  /** Omit to hide the "Delete palette" action. */
  onDeletePalette?: () => void;
}

const VISIBILITY_TOGGLES: { key: keyof ColorPaletteStyle & string; label: string }[] = [
  { key: "showTitle", label: "Title" },
  { key: "showIcon", label: "Icon" },
  { key: "showDescription", label: "Description" },
];

const COLOR_FORMATS: ColorFormat[] = ["hex", "rgb", "rgba", "hsl"];

export function ColorPaletteSettingsPanel({
  style,
  onChange,
  onDeletePalette,
}: ColorPaletteSettingsPanelProps) {
  return (
    <div className="flex w-56 flex-col gap-4 p-3">
      <div className="flex flex-col gap-1.5">
        <span className={SETTINGS_SECTION_TITLE}>Appearance</span>
        <VariantToggle<ColorPaletteVariant>
          options={["solid", "transparent"]}
          value={style.variant}
          onChange={(variant) => onChange({ variant })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={SETTINGS_SECTION_TITLE}>Show</span>
        <VisibilityToggleList style={style} items={VISIBILITY_TOGGLES} onChange={onChange} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={SETTINGS_SECTION_TITLE}>Color format</span>
        <div className="grid grid-cols-2 gap-1.5">
          {COLOR_FORMATS.map((format) => (
            <Button
              key={format}
              variant="ghost"
              onPress={() => onChange({ colorFormat: format })}
              className={`h-auto rounded-lg border px-2.5 py-1.5 text-[13px] font-normal uppercase transition-colors ${
                style.colorFormat === format
                  ? "border-[#2c2c2b] bg-black/[0.03] text-[#2c2c2b]"
                  : "border-[#f0efed] text-[#5f5e59] hover:border-[#c9c8c4]"
              }`}
            >
              {format}
            </Button>
          ))}
        </div>
      </div>

      {onDeletePalette ? (
        <SettingsDeleteButton label="Delete palette" onPress={onDeletePalette} />
      ) : null}
    </div>
  );
}
