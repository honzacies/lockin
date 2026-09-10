"use client";

import { Button } from "@heroui/react";
import { FONT_OPTIONS } from "@lockin/shared/Fonts";
import { FontCategoryTiles } from "./FontCategoryTiles";

interface FontPickerProps {
  value?: string;
  onChange: (cssValue: string) => void;
}

export function FontPicker({ value, onChange }: FontPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <FontCategoryTiles value={value} onChange={onChange} variant="full" />

      {/* Full list */}
      <div className="max-h-56 overflow-y-auto rounded-lg border border-[#f0efed]">
        {FONT_OPTIONS.map((option) => {
          const active = value === option.cssValue;
          return (
            <Button
              key={option.id}
              variant="ghost"
              onPress={() => onChange(option.cssValue)}
              className={`h-auto w-full justify-between rounded-none px-3 py-1.5 text-left font-normal transition-colors ${
                active ? "bg-black/[0.04]" : "hover:bg-black/[0.02]"
              }`}
            >
              <span
                className="text-[14px] text-[#2c2c2b]"
                style={{ fontFamily: option.cssValue }}
              >
                {option.label}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#c9c8c4]">
                {option.category}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
