"use client";

import { Button } from "@heroui/react";
import { DEFAULT_TAG_COLOR } from "@lockin/shared/Types/Library";
import { ColorPicker } from "@lockin/shared/Components/DocumentView/StyleEditor/ColorPicker";
import { Popover } from "./Popover";

interface TagColorPickerProps {
  color?: string;
  onChange: (color: string) => void;
  size?: number;
}

/** A colored-dot trigger opening the shared `ColorPicker` (same hue/sat area
 * + presets used by the block style editor) — the single place a tag's color
 * is changed from, reused by both the Sidebar and Library table via
 * SidebarItemMenu. */
export function TagColorPicker({ color, onChange, size = 20 }: TagColorPickerProps) {
  const value = color ?? DEFAULT_TAG_COLOR;

  return (
    <Popover
      trigger={(open) => (
        <Button
          variant="ghost"
          isIconOnly
          aria-label="Change tag color"
          className={`h-auto w-auto shrink-0 rounded-full p-0.5 ${open ? "bg-black/[0.04]" : "hover:bg-black/[0.04]"}`}
        >
          <span
            className="block rounded-full border border-black/10"
            style={{ width: size, height: size, background: value }}
          />
        </Button>
      )}
      panelClassName="w-64 p-3"
    >
      {() => <ColorPicker value={value} onChange={onChange} />}
    </Popover>
  );
}
