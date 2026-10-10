"use client";

import { useState, type ReactNode } from "react";
import { Button, Input } from "@heroui/react";
import { ChevronDown, Plus, RotateCcw, Search, Settings2, Shuffle, Trash2, X } from "@lockin/shared/Components/Shared/UiIcons";
import { UseGraphStore, type GraphSettings } from "@lockin/shared/Store/UseGraphStore";
import { SETTINGS_SECTION_TITLE, VariantToggle, VisibilityToggleList } from "@lockin/shared/Components/Shared/SettingsPanelPrimitives";
import { TagColorPicker } from "@lockin/shared/Components/Shared/TagColorPicker";

// Začíná barvami, které složky nepoužívají, ať je nová skupina hned vidět.
/** Skleněný povrch plovoucích panelů nad grafem (legenda, nastavení). */
export const GLASS_SURFACE =
  "border border-white/70 bg-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-sm backdrop-saturate-150";

const NEW_GROUP_COLORS = ["#f76b15", "#12a594", "#e5484d", "#8e4ec6", "#f5a524", "#30a46c"];

/** Sbalovací sekce panelu (Filters / Groups / Display / Forces). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-2 border-t border-black/[0.06] pt-2.5 first:border-t-0 first:pt-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`flex items-center gap-1 text-left ${SETTINGS_SECTION_TITLE}`}>
        <ChevronDown size={12} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
        {title}
      </button>
      {open ? children : null}
    </div>
  );
}

/** Popisek + hodnota + posuvník, jeden řádek nastavení. */
function Slider({
  label,
  field,
  min,
  max,
  step,
}: {
  label: string;
  field: keyof Pick<GraphSettings, "textFadeThreshold" | "labelSize" | "nodeSize" | "linkThickness" | "centerForce" | "repelForce" | "linkForce" | "linkDistance">;
  min: number;
  max: number;
  step: number;
}) {
  const value = UseGraphStore((s) => s[field]);
  const set = UseGraphStore((s) => s.Set);
  return (
    <label className="flex flex-col gap-1 text-[13px] text-[var(--lk-ink)]">
      <span className="flex items-center justify-between">
        {label}
        <span className="tabular-nums text-[var(--lk-muted)]">{Number(value.toFixed(2))}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set({ [field]: Number(e.target.value) })}
        className="h-1 w-full cursor-pointer accent-[var(--lk-ink)]"
      />
    </label>
  );
}

/** Nastavení grafu jako v Obsidianu, ale ve stylu LockInu (bílý panel,
 * stejné checkboxy a sekce jako nastavení bloků). */
export function GraphSettingsPanel() {
  const [open, setOpen] = useState(false);
  const settings = UseGraphStore();
  const { Set, Reset, Shake } = settings;

  if (!open) {
    return (
      <Button
        variant="ghost"
        isIconOnly
        aria-label="Graph settings"
        onPress={() => setOpen(true)}
        className={`absolute right-4 top-4 h-10 w-10 rounded-xl text-[var(--lk-text2)] hover:bg-white/80 ${GLASS_SURFACE}`}
      >
        <Settings2 size={16} strokeWidth={1.75} />
      </Button>
    );
  }

  return (
    <div className={`absolute right-4 top-4 flex max-h-[calc(100%-32px)] w-64 select-none flex-col gap-2.5 overflow-y-auto rounded-2xl p-3 ${GLASS_SURFACE}`}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-[var(--lk-ink)]">Graph settings</p>
        <div className="flex items-center gap-0.5 text-[var(--lk-muted)]">
          <Button variant="ghost" isIconOnly aria-label="Reset to defaults" onPress={Reset} className="h-6 w-6 rounded hover:bg-black/[0.04] hover:text-[var(--lk-ink)]">
            <RotateCcw size={13} />
          </Button>
          <Button variant="ghost" isIconOnly aria-label="Close" onPress={() => setOpen(false)} className="h-6 w-6 rounded hover:bg-black/[0.04] hover:text-[var(--lk-ink)]">
            <X size={14} />
          </Button>
        </div>
      </div>

      <Section title="Filters">
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--lk-gray)] px-1.5 focus-within:border-[#0485f7]">
          <Search size={13} className="shrink-0 text-[var(--lk-muted)]" />
          <Input
            value={settings.search}
            onChange={(e) => Set({ search: e.target.value })}
            placeholder="Search files…"
            className="w-full bg-transparent py-0.5 text-[13px] text-[var(--lk-ink)] outline-none shadow-none ring-0"
          />
        </div>
        <VisibilityToggleList style={settings} items={[{ key: "showOrphans", label: "Orphans" }]} onChange={Set} />
      </Section>

      <Section title="Groups">
        {settings.groups.map((group) => (
          <div key={group.id} className="flex items-center gap-1.5">
            <TagColorPicker
              color={group.color}
              size={16}
              onChange={(color) => Set({ groups: settings.groups.map((g) => (g.id === group.id ? { ...g, color } : g)) })}
            />
            <Input
              value={group.query}
              placeholder="path or name, e.g. projects/"
              onChange={(e) =>
                Set({ groups: settings.groups.map((g) => (g.id === group.id ? { ...g, query: e.target.value } : g)) })
              }
              className="min-w-0 flex-1 rounded-lg border border-[var(--lk-gray)] bg-white px-1.5 py-0.5 text-[13px] text-[var(--lk-ink)] outline-none focus:border-[#0485f7]"
            />
            <Button
              variant="ghost"
              isIconOnly
              aria-label="Remove group"
              onPress={() => Set({ groups: settings.groups.filter((g) => g.id !== group.id) })}
              className="h-6 w-6 shrink-0 rounded text-[var(--lk-muted)] hover:bg-[#e5484d]/[0.08] hover:text-[#e5484d]"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          onPress={() =>
            Set({
              groups: [
                ...settings.groups,
                { id: `g-${crypto.randomUUID()}`, query: "", color: NEW_GROUP_COLORS[settings.groups.length % NEW_GROUP_COLORS.length] },
              ],
            })
          }
          className="h-auto w-full justify-center gap-1.5 rounded-lg border border-[var(--lk-line)] px-0 py-1.5 text-[13px] font-normal text-[var(--lk-text2)] hover:bg-black/[0.03]"
        >
          <Plus size={13} strokeWidth={1.75} />
          New group
        </Button>
      </Section>

      <Section title="Display">
        <VisibilityToggleList
          style={settings}
          items={[
            { key: "arrows", label: "Arrows" },
            { key: "ungrouped", label: "Ungroup (one color)" },
          ]}
          onChange={Set}
        />
        {settings.ungrouped ? (
          <div className="flex items-center gap-2 text-[13px] text-[var(--lk-ink)]">
            <TagColorPicker color={settings.nodeColor} size={16} onChange={(nodeColor) => Set({ nodeColor })} />
            Dot color
          </div>
        ) : null}
        <Slider label="Text fade threshold" field="textFadeThreshold" min={-3} max={3} step={0.1} />
        <Slider label="Node size" field="nodeSize" min={0.3} max={3} step={0.05} />
        <Slider label="Link thickness" field="linkThickness" min={0.2} max={4} step={0.1} />
        <Button
          variant="ghost"
          onPress={Shake}
          className="h-auto w-full justify-center gap-1.5 rounded-lg border border-[var(--lk-line)] px-0 py-1.5 text-[13px] font-normal text-[var(--lk-text2)] hover:bg-black/[0.03]"
        >
          <Shuffle size={13} strokeWidth={1.75} />
          Animate
        </Button>
      </Section>

      <Section title="Text">
        <Slider label="Text size" field="labelSize" min={8} max={20} step={0.5} />
        <div className="flex items-center gap-2 text-[13px] text-[var(--lk-ink)]">
          <TagColorPicker color={settings.labelColor} size={16} onChange={(labelColor) => Set({ labelColor })} />
          Text color
        </div>
        <VariantToggle options={["regular", "medium", "bold"]} value={settings.labelWeight} onChange={(labelWeight) => Set({ labelWeight })} />
        <VisibilityToggleList style={settings} items={[{ key: "labelHalo", label: "White outline behind text" }]} onChange={Set} />
      </Section>

      <Section title="Forces">
        <Slider label="Center force" field="centerForce" min={0} max={2} step={0.05} />
        <Slider label="Repel force" field="repelForce" min={0} max={30} step={0.5} />
        <Slider label="Link force" field="linkForce" min={0} max={3} step={0.05} />
        <Slider label="Link distance" field="linkDistance" min={20} max={250} step={5} />
      </Section>
    </div>
  );
}

