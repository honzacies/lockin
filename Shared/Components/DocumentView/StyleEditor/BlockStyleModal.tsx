"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { ChevronDown, Type, X } from "@lockin/shared/Components/Shared/UiIcons";
import type { BlockStyle, StyleableBlockType } from "@lockin/shared/Types/Project";
import { BLOCK_STYLE_FIELDS } from "@lockin/shared/Components/DocumentView/Editor/StyleVars";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { ToolButton, Swatch, Stepper } from "@lockin/shared/Components/Shared/StyleControls";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ColorPicker } from "./ColorPicker";
import { FontPicker } from "./FontPicker";
import { AppCheckbox } from "@lockin/shared/Components/Shared/AppCheckbox";

interface BlockStyleModalProps {
  blockType: StyleableBlockType;
  value: BlockStyle;
  onChange: (next: BlockStyle) => void;
  onClose: () => void;
}

const BLOCK_LABEL: Record<StyleableBlockType, string> = {
  paragraph: "Paragraph",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  link: "Link",
  quote: "Quote",
  codeBlock: "Code block",
  divider: "Divider",
  bulletList: "Bulleted list",
  dashedList: "Dashed list",
  numberedList: "Numbered list",
};

/** Default text size per block, used by the stepper and the live preview. */
const DEFAULT_SIZE: Record<StyleableBlockType, number> = {
  paragraph: 16,
  heading1: 30,
  heading2: 24,
  heading3: 20,
  link: 16,
  quote: 16,
  codeBlock: 14,
  divider: 16,
  bulletList: 16,
  dashedList: 16,
  numberedList: 16,
};

function Clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function BlockStyleModal({
  blockType,
  value,
  onChange,
  onClose,
}: BlockStyleModalProps) {
  const SetDefaultBlockStyle = UseUiStore((s) => s.SetDefaultBlockStyle);
  const [applyToFuture, setApplyToFuture] = useState(false);

  const fields = BLOCK_STYLE_FIELDS[blockType];
  const size = value.fontSize ?? DEFAULT_SIZE[blockType];

  useEffect(() => {
    function OnKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", OnKey);
    return () => window.removeEventListener("keydown", OnKey);
  }, [onClose]);

  function Patch(patch: Partial<BlockStyle>) {
    const next: BlockStyle = { ...value, ...patch };
    for (const key of Object.keys(patch) as (keyof BlockStyle)[]) {
      if (patch[key] === undefined) delete next[key];
    }
    onChange(next);
    if (applyToFuture) SetDefaultBlockStyle(blockType, next);
  }

  function ToggleFuture(checked: boolean) {
    setApplyToFuture(checked);
    if (checked) SetDefaultBlockStyle(blockType, value);
  }

  return (
    // Hand-rolled backdrop, not HeroUI's Modal — this needs `overflow-visible`
    // on the panel itself so the toolbar's own Popovers (Font/Color/Fill,
    // just below) can render outside the panel's bounds, which conflicts
    // with a generic dialog wrapper managing its own overlay/positioning.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000]/30 p-4"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[85vh] w-[440px] flex-col overflow-visible rounded-2xl border border-[var(--lk-line)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lk-subtle)]">
            {BLOCK_LABEL[blockType]} style
          </div>
          <Button
            variant="ghost"
            isIconOnly
            onPress={onClose}
            className="h-auto w-auto rounded-md p-1 text-[var(--lk-muted)] hover:bg-black/[0.04] hover:text-[var(--lk-ink)]"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.75} />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="relative z-10 flex flex-wrap items-center gap-1.5 overflow-visible px-4 py-2.5">
          {fields.includes("fontFamily") ? (
            <Popover
              trigger={(open) => (
                <ToolButton active={open}>
                  <Type size={14} strokeWidth={1.75} />
                  <span className="max-w-24 truncate">Font</span>
                  <ChevronDown size={13} className="text-[var(--lk-subtle)]" />
                </ToolButton>
              )}
              panelClassName="w-64 p-3"
            >
              {() => (
                <FontPicker
                  value={value.fontFamily}
                  onChange={(fontFamily) => Patch({ fontFamily })}
                />
              )}
            </Popover>
          ) : null}

          {fields.includes("color") ? (
            <Popover
              trigger={(open) => (
                <ToolButton active={open}>
                  <Swatch color={value.color ?? "#2c2c2b"} />
                  <span>{blockType === "divider" ? "Line" : "Color"}</span>
                </ToolButton>
              )}
              panelClassName="w-64 p-3"
            >
              {() => <ColorPicker value={value.color} onChange={(color) => Patch({ color })} />}
            </Popover>
          ) : null}

          {fields.includes("background") ? (
            <Popover
              trigger={(open) => (
                <ToolButton active={open}>
                  <Swatch color={value.background ?? "#f9f8f7"} />
                  <span>Fill</span>
                </ToolButton>
              )}
              panelClassName="w-64 p-3"
            >
              {() => (
                <ColorPicker
                  value={value.background}
                  onChange={(background) => Patch({ background })}
                />
              )}
            </Popover>
          ) : null}

          {fields.includes("fontSize") ? (
            <Stepper
              value={size}
              unit="px"
              onDec={() => Patch({ fontSize: Clamp(size - 1, 8, 96) })}
              onInc={() => Patch({ fontSize: Clamp(size + 1, 8, 96) })}
            />
          ) : null}

          {fields.includes("thickness") ? (
            <Stepper
              label="Weight"
              value={value.thickness ?? 1}
              unit="px"
              onDec={() => Patch({ thickness: Clamp((value.thickness ?? 1) - 1, 1, 12) })}
              onInc={() => Patch({ thickness: Clamp((value.thickness ?? 1) + 1, 1, 12) })}
            />
          ) : null}

          {fields.includes("width") ? (
            <Stepper
              label="Width"
              value={value.width ?? 100}
              unit="%"
              onDec={() => Patch({ width: Clamp((value.width ?? 100) - 5, 10, 100) })}
              onInc={() => Patch({ width: Clamp((value.width ?? 100) + 5, 10, 100) })}
            />
          ) : null}

          {fields.includes("markerGap") ? (
            <Stepper
              label="Gap"
              value={value.markerGap ?? (blockType === "dashedList" ? 18 : 24)}
              unit="px"
              onDec={() =>
                Patch({
                  markerGap: Clamp(
                    (value.markerGap ?? (blockType === "dashedList" ? 18 : 24)) - 2,
                    0,
                    48,
                  ),
                })
              }
              onInc={() =>
                Patch({
                  markerGap: Clamp(
                    (value.markerGap ?? (blockType === "dashedList" ? 18 : 24)) + 2,
                    0,
                    48,
                  ),
                })
              }
            />
          ) : null}
        </div>

        {/* Live example */}
        <div className="flex min-h-[120px] flex-1 items-center overflow-auto border-t border-[var(--lk-line)] bg-[var(--lk-panel)] px-5 py-6">
          <ExamplePreview blockType={blockType} value={value} size={size} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--lk-line)] px-4 py-3">
          <AppCheckbox
            checked={applyToFuture}
            onChange={ToggleFuture}
            label="Apply to all future documents"
            className="text-[13px] text-[var(--lk-text2)]"
          />
          <Button
            variant="ghost"
            onPress={onClose}
            className="h-auto rounded-lg bg-[var(--lk-ink)] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-black"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExamplePreview({
  blockType,
  value,
  size,
}: {
  blockType: StyleableBlockType;
  value: BlockStyle;
  size: number;
}) {
  const font = value.fontFamily;
  const color = value.color;

  if (blockType === "divider") {
    return (
      <div className="w-full">
        <hr
          style={{
            border: "none",
            borderTop: `${value.thickness ?? 1}px solid ${value.color ?? "#d5d4d1"}`,
            width: `${value.width ?? 100}%`,
            marginInline: "auto",
          }}
        />
      </div>
    );
  }

  if (blockType === "codeBlock") {
    return (
      <pre
        className="w-full overflow-auto rounded-lg p-3"
        style={{
          background: value.background ?? "#f9f8f7",
          color: color ?? "#2c2c2b",
          fontFamily: font ?? "monospace",
          fontSize: size,
        }}
      >
        <span style={{ color: value.color ? undefined : "#91918e" }}>const</span>{" "}
        answer = 42;
      </pre>
    );
  }

  if (blockType === "quote") {
    return (
      <blockquote
        className="border-l-[3px] pl-4 italic"
        style={{
          borderColor: "#e5e4e1",
          color: color ?? "#5f5e59",
          fontFamily: font,
          fontSize: size,
        }}
      >
        Design is not just what it looks like and feels like. Design is how it
        works.
      </blockquote>
    );
  }

  if (blockType === "link") {
    return (
      <p style={{ fontFamily: font, fontSize: size, color: "#2c2c2b" }}>
        Read the{" "}
        <span
          style={{
            color: color ?? "#3b7cff",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          documentation
        </span>{" "}
        for details.
      </p>
    );
  }

  if (
    blockType === "bulletList" ||
    blockType === "dashedList" ||
    blockType === "numberedList"
  ) {
    const gap = value.markerGap ?? (blockType === "dashedList" ? 18 : 24);
    const items = ["First item", "Second item"];
    const marker = (i: number) => {
      if (blockType === "numberedList") return `${i + 1}.`;
      if (blockType === "dashedList") return "–";
      return "•";
    };
    return (
      <ul
        className="w-full"
        style={{ color: color ?? "#2c2c2b", fontFamily: font, fontSize: size }}
      >
        {items.map((t, i) => (
          <li key={t} className="flex" style={{ marginBottom: 4 }}>
            <span
              className="text-[var(--lk-muted)]"
              style={{ minWidth: Math.max(gap, 8), display: "inline-block" }}
            >
              {marker(i)}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    );
  }

  // Paragraph + headings
  const isHeading = blockType.startsWith("heading");
  const text = isHeading
    ? "The quick brown fox"
    : "The quick brown fox jumps over the lazy dog.";
  return (
    <div
      style={{
        color: color ?? "#2c2c2b",
        fontFamily: font,
        fontSize: size,
        fontWeight: isHeading ? 600 : 400,
        lineHeight: 1.3,
      }}
    >
      {text}
    </div>
  );
}
