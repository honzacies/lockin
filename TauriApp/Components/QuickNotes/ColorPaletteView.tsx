"use client";

import { useState } from "react";
import { Button, Input } from "@heroui/react";
import { Check, FolderPlus, Palette, Pencil, Plus, Settings, X } from "lucide-react";
import type {
  ColorFormat,
  ColorPaletteConfig,
  ColorPaletteStyle,
  ColorSwatch,
} from "@/Types/ColorPalette";
import { FormatColor } from "@/Lib/Color";
import { Popover } from "@/Components/Shared/Popover";
import { IconPicker } from "@/Components/Shared/IconPicker";
import { ColorPicker } from "@/Components/DocumentView/StyleEditor/ColorPicker";
import { BlockSettingsPortal } from "@/Components/Shared/BlockSettingsPortal";
import { InlineEditable } from "@/Components/Shared/InlineEditable";
import { ColorPaletteSettingsPanel } from "./ColorPaletteSettingsPanel";
import { UseUiStore } from "@/Store/UseUiStore";
import { useBlockSettingsPortalNode } from "@/Components/AppShell/TodoSettingsPanelSlot";

export interface ColorPaletteViewProps {
  config: ColorPaletteConfig;
  onChangeTitle: (title: string) => void;
  onChangeIcon: (icon: string | undefined) => void;
  onChangeDescription: (description: string) => void;
  onChangeStyle: (patch: Partial<ColorPaletteStyle>) => void;
  onAddGroup: () => void;
  onRemoveGroup: (groupId: string) => void;
  onChangeGroupTitle: (groupId: string, title: string) => void;
  onAddSwatch: (groupId: string) => void;
  onRemoveSwatch: (groupId: string, swatchId: string) => void;
  onChangeSwatch: (groupId: string, swatchId: string, patch: Partial<Pick<ColorSwatch, "color" | "label">>) => void;
  /** Omit to hide the "Delete palette" action in settings. */
  onDeletePalette?: () => void;
}

function CopyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    // Clipboard access can fail (no Tauri bridge, permissions, ...) — the
    // "Copied" feedback just won't show; not worth surfacing an error for.
  });
}

/** One color tile — click the swatch or its label to copy the currently
 * displayed representation; a hover-revealed pencil opens the real editor
 * (color + label), since the primary click is reserved for copying. */
function SwatchTile({
  swatch,
  format,
  onChange,
  onRemove,
}: {
  swatch: ColorSwatch;
  format: ColorFormat;
  onChange: (patch: Partial<Pick<ColorSwatch, "color" | "label">>) => void;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const displayValue = FormatColor(swatch.color, format);

  function HandleCopy() {
    CopyToClipboard(displayValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="group/swatch flex w-[104px] shrink-0 flex-col gap-1.5">
      {/* A plain div, not a Button — the hover-revealed edit/remove controls
       * below are their own real buttons, and nesting a button inside a
       * button is invalid HTML (and silently breaks click handling in most
       * browsers) — same class of bug already hit and fixed elsewhere in
       * this app (see TabStrip.tsx's tab-select/close split). */}
      <div
        role="button"
        tabIndex={0}
        onClick={HandleCopy}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") HandleCopy();
        }}
        // Not a real <button> (can't be, it contains real ones — see
        // above), so BlockSelectionExtension.ts's interactive-element
        // exclusion selector wouldn't otherwise recognize it, letting a
        // plain copy-click get hijacked into "grab the selected block to
        // move it" whenever the palette happens to be marquee-selected.
        data-block-drag-ignore="true"
        aria-label={`Copy ${displayValue}`}
        className="relative h-[100px] w-[100px] cursor-pointer rounded-2xl"
        style={{ backgroundColor: swatch.color }}
      >
        {copied ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-xs font-medium text-white">
            <Check size={13} strokeWidth={2.5} className="mr-1" />
            Copied
          </span>
        ) : null}

        <div
          className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/swatch:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Popover
            trigger={() => (
              <Button
                variant="ghost"
                isIconOnly
                aria-label="Edit color"
                className="h-6 w-6 rounded-md bg-black/30 text-white hover:bg-black/50"
              >
                <Pencil size={12} strokeWidth={1.75} />
              </Button>
            )}
          >
            {() => (
              <div className="flex flex-col gap-2 p-3">
                <ColorPicker value={swatch.color} onChange={(color) => onChange({ color })} />
                <Input
                  value={swatch.label}
                  onChange={(e) => onChange({ label: e.target.value })}
                  placeholder="Label"
                  className="rounded-lg border border-[#f0efed] px-2 py-1 text-sm outline-none focus:border-[#c9c8c4]"
                />
              </div>
            )}
          </Popover>
          <Button
            variant="ghost"
            isIconOnly
            onPress={onRemove}
            aria-label="Remove color"
            className="h-6 w-6 rounded-md bg-black/30 text-white hover:bg-[#e5484d]"
          >
            <X size={12} strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <div
        onClick={HandleCopy}
        className="h-auto flex flex-col items-center p-0 w-full font-normal text-center"
        aria-label={`Copy ${displayValue}`}
      >
        <span className="text-[13px] w-full font-semibold text-[#2c2c2b]">{displayValue}</span>
        <span className="truncate w-full text-[11px] leading-none text-[#91918e]">{swatch.label}</span>
      </div>
    </div>
  );
}

function SwatchGroupView({
  group,
  format,
  onChangeTitle,
  onRemoveGroup,
  onAddSwatch,
  onChangeSwatch,
  onRemoveSwatch,
}: {
  group: ColorPaletteConfig["groups"][number];
  format: ColorFormat;
  onChangeTitle: (title: string) => void;
  onRemoveGroup: () => void;
  onAddSwatch: () => void;
  onChangeSwatch: (swatchId: string, patch: Partial<Pick<ColorSwatch, "color" | "label">>) => void;
  onRemoveSwatch: (swatchId: string) => void;
}) {
  return (
    <div className="group/group flex flex-col gap-1.5 cursor-default">
      <div className="flex items-center justify-between">
        <InlineEditable
          value={group.title}
          onCommit={(next) => onChangeTitle(next || "New group")}
          placeholder="New group"
          className="text-[10px] font-semibold uppercase tracking-wider hover:bg-transparent hover:cursor-text text-[#a5a49f]"
        />
        <Button
          variant="ghost"
          isIconOnly
          onPress={onRemoveGroup}
          aria-label="Remove group"
          className="h-auto w-auto rounded p-0.5 text-[#c9c8c4] opacity-0 hover:bg-black/[0.06] hover:text-[#e5484d] group-hover/group:opacity-100"
        >
          <X size={12} strokeWidth={1.75} />
        </Button>
      </div>
      <div className="group/row flex flex-wrap items-start gap-3">
        {group.swatches.map((swatch) => (
          <SwatchTile
            key={swatch.id}
            swatch={swatch}
            format={format}
            onChange={(patch) => onChangeSwatch(swatch.id, patch)}
            onRemove={() => onRemoveSwatch(swatch.id)}
          />
        ))}
        <Button
          variant="ghost"
          onPress={onAddSwatch}
          aria-label="Add color"
          className="flex h-[72px] w-[104px] shrink-0 items-center justify-center rounded-2xl border border-dashed border-[#e2e0dc] text-[#91918e] opacity-0 transition-opacity hover:border-[#0088ff]/40 hover:text-[#0088ff] group-hover/row:opacity-100"
        >
          <Plus size={18} strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  );
}

/**
 * Pure presentational color palette block — named groups of color swatches,
 * click-to-copy, with its own title/icon/description and a settings popover
 * (visibility toggles + display representation). Mirrors TodoListView.tsx's
 * shape: a single `config` object owned by whatever bridges it to storage.
 */
export function ColorPaletteView({
  config,
  onChangeTitle,
  onChangeIcon,
  onChangeDescription,
  onChangeStyle,
  onAddGroup,
  onRemoveGroup,
  onChangeGroupTitle,
  onAddSwatch,
  onRemoveSwatch,
  onChangeSwatch,
  onDeletePalette,
}: ColorPaletteViewProps) {
  const { title, description, groups, style } = config;
  const showHeader = style.showTitle || style.showIcon;
  const isSolid = style.variant === "solid";
  const openBlockSettings = UseUiStore((state) => state.openBlockSettings);
  const OpenBlockSettings = UseUiStore((state) => state.OpenBlockSettings);
  const CloseBlockSettings = UseUiStore((state) => state.CloseBlockSettings);
  const settingsPortalNode = useBlockSettingsPortalNode();
  const settingsOpen =
    openBlockSettings?.kind === "colorPalette" && openBlockSettings.id === config.id;

  return (
    <div className={`group flex w-full flex-col gap-4 ${isSolid ? "rounded-2xl bg-[#f9f8f7] p-4" : ""}`}>
      <div className="flex items-center justify-between">
        {showHeader ? (
          <div className="flex items-center gap-1.5">
            {style.showIcon ? (
              <IconPicker icon={config.icon} onChange={onChangeIcon} size={28} placeholderOnlyOnHover />
            ) : null}
            {style.showTitle ? (
              <InlineEditable
                value={title}
                onCommit={(next) => onChangeTitle(next || "Color Palette")}
                placeholder="Color Palette"
                className="text-[24px] font-medium"
              />
            ) : null}
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            isIconOnly
            onPress={onAddGroup}
            aria-label="Add group"
            className="h-7 w-7 rounded-md text-[#91918e] hover:bg-black/[0.05]"
          >
            <FolderPlus size={16} strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Color palette settings"
            onPress={() => (settingsOpen ? CloseBlockSettings() : OpenBlockSettings("colorPalette", config.id))}
            className={`h-7 w-7 rounded-md text-[#91918e] transition-colors ${
              settingsOpen ? "bg-black/[0.06] text-[#2c2c2b]" : "hover:bg-black/[0.05]"
            }`}
          >
            <Settings size={16} strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      <BlockSettingsPortal
        open={settingsOpen}
        portalNode={settingsPortalNode}
        title={`${title || "Color palette"} settings`}
        onClose={CloseBlockSettings}
      >
        <ColorPaletteSettingsPanel
          style={style}
          onChange={onChangeStyle}
          onDeletePalette={
            onDeletePalette
              ? () => {
                  CloseBlockSettings();
                  onDeletePalette();
                }
              : undefined
          }
        />
      </BlockSettingsPortal>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#e2e0dc] py-10 text-center">
          <Palette size={20} strokeWidth={1.5} className="text-[#c9c8c4]" />
          <p className="text-sm text-[#91918e]">No color groups yet.</p>
          <Button
            variant="ghost"
            onPress={onAddGroup}
            className="h-auto gap-1.5 rounded-lg border border-[#f0efed] px-3 py-1.5 text-sm font-normal text-[#5f5e59] hover:bg-black/[0.03]"
          >
            <Plus size={15} strokeWidth={1.75} />
            Add a group
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <SwatchGroupView
              key={group.id}
              group={group}
              format={style.colorFormat}
              onChangeTitle={(next) => onChangeGroupTitle(group.id, next)}
              onRemoveGroup={() => onRemoveGroup(group.id)}
              onAddSwatch={() => onAddSwatch(group.id)}
              onChangeSwatch={(swatchId, patch) => onChangeSwatch(group.id, swatchId, patch)}
              onRemoveSwatch={(swatchId) => onRemoveSwatch(group.id, swatchId)}
            />
          ))}
        </div>
      )}

      {style.showDescription ? (
        <InlineEditable
          value={description}
          onCommit={onChangeDescription}
          placeholder="Add a description…"
          className="text-sm text-[#71717a]"
          multiline
        />
      ) : null}
    </div>
  );
}
