"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { ImagePlus, Search, Upload } from "@lockin/shared/Components/Shared/UiIcons";
import { iconNames as LUCIDE_NAMES } from "lucide-react/dynamic";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { FileToIconDataUrl } from "@lockin/shared/Lib/Icon";
import { MaterialNames } from "@lockin/shared/Lib/Icons";
import { IconGlyph } from "./IconGlyph";
import { Popover } from "./Popover";

const EMOJIS = [
  "🚀", "📁", "✨", "🎯", "📝", "💡", "🔥", "🌱", "⚡", "🎨",
  "📚", "🧠", "💻", "🛠️", "📊", "📅", "✅", "📌", "🔒", "🏠",
  "🎵", "🎬", "📷", "🎮", "🏋️", "🍳", "✈️", "💰", "❤️", "⭐",
  "🧪", "🐛", "🔧", "📦", "🌍", "🗂️", "🧩", "🏆", "⏱️", "☕",
];
type Tab = "emoji" | "lucide" | "material" | "upload";
const TABS: { id: Tab; label: string }[] = [
  { id: "emoji", label: "Emoji" },
  { id: "lucide", label: "Lucide" },
  { id: "material", label: "Google" },
  { id: "upload", label: "Upload" },
];
/** Kolik ikon vykreslit naráz — zbytek se najde hledáním. */
const MAX_SHOWN = 240;

interface IconPickerProps {
  icon?: string | null;
  onChange: (icon: string | undefined) => void;
  size?: number;
  /** How much of the `size` box the glyph fills. */
  glyphScale?: number;
  /** When true and no icon is set, the "add icon" placeholder stays invisible
   * until this trigger is hovered (or the picker is open). */
  placeholderOnlyOnHover?: boolean;
  /** Trigger jako celý řádek s textem (kontextové menu) — klik kamkoli na řádek otevře výběr. */
  label?: ReactNode;
}

function IconGrid({ items, onPick, render }: { items: string[]; onPick: (value: string) => void; render: (value: string) => ReactNode }) {
  return (
    <div className="grid max-h-[248px] grid-cols-8 gap-0.5 overflow-y-auto pr-0.5">
      {items.slice(0, MAX_SHOWN).map((value) => (
        <button
          key={value}
          type="button"
          title={value.slice(value.indexOf(":") + 1).replace(/-outline$/, "").replace(/-/g, " ")}
          onClick={() => onPick(value)}
          className="flex size-9 items-center justify-center rounded-lg text-lg text-[var(--lk-text2)] hover:bg-black/[0.05] hover:text-[var(--lk-ink)]"
        >
          {render(value)}
        </button>
      ))}
    </div>
  );
}

/** Výběr ikony: emoji, Lucide, Google Material Symbols nebo vlastní obrázek. */
export function IconPicker({ icon, onChange, size = 64, glyphScale = 0.5, placeholderOnlyOnHover, label }: IconPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recentIcons = UseUiStore((s) => s.recentIcons);
  const AddRecentIcon = UseUiStore((s) => s.AddRecentIcon);
  const [tab, setTab] = useState<Tab>("emoji");
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState<string[] | null>(null);

  // Material sada je velká — načte se, až když na ni uživatel klikne.
  useEffect(() => {
    if (tab === "material" && !material) MaterialNames().then(setMaterial);
  }, [tab, material]);

  const q = query.trim().toLowerCase().replace(/\s+/g, "-");
  const lucide = useMemo(() => (LUCIDE_NAMES as string[]).filter((n) => n.includes(q)).map((n) => `lucide:${n}`), [q]);
  const google = useMemo(() => (material ?? []).filter((n) => n.includes(q)).map((n) => `material:${n}`), [material, q]);

  function Pick(next: string, close: () => void) {
    onChange(next);
    AddRecentIcon(next);
    close();
  }

  async function HandleUpload(e: React.ChangeEvent<HTMLInputElement>, close: () => void) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    Pick(await FileToIconDataUrl(file), close);
  }

  return (
    <Popover
      trigger={(open) =>
        label ? (
          <button
            type="button"
            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1 text-[13px] font-medium text-[var(--lk-ink)] ${open ? "bg-black/[0.04]" : "hover:bg-black/[0.04]"}`}
          >
            {label}
            <span className="ml-auto flex size-[22px] items-center justify-center">
              {icon ? <IconGlyph icon={icon} size={18} /> : <ImagePlus size={15} strokeWidth={1.5} className="text-[var(--lk-faint)]" />}
            </span>
          </button>
        ) : (
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Change icon"
            className={`group/picker flex h-auto w-auto shrink-0 flex-row items-center justify-center rounded-2xl p-0 leading-none transition-colors ${
              open ? "bg-black/[0.04]" : "hover:bg-transparent"
            }`}
            style={{ width: size, height: size }}
          >
            {icon ? (
              <IconGlyph icon={icon} size={size * (icon.startsWith("data:") ? 1 : glyphScale * 1.15)} className={icon.startsWith("data:") ? "rounded-2xl" : ""} />
            ) : (
              <ImagePlus
                size={size * glyphScale * 0.7}
                strokeWidth={1.5}
                className={`text-[var(--lk-faint)] ${placeholderOnlyOnHover && !open ? "opacity-0 transition-opacity group-hover/picker:opacity-100" : ""}`}
              />
            )}
          </Button>
        )
      }
      panelClassName="w-[340px] p-2.5"
    >
      {(close) => (
        <div className="flex flex-col gap-2.5">
          <div role="tablist" className="flex gap-0.5 rounded-lg bg-black/[0.04] p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-md py-1 text-[12px] font-medium ${tab === t.id ? "bg-white text-[var(--lk-ink)] shadow-sm" : "text-[var(--lk-text2)]"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "lucide" || tab === "material" ? (
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--lk-muted)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${tab === "lucide" ? LUCIDE_NAMES.length : (material?.length ?? "…")} icons…`}
                className="h-8 w-full rounded-lg border border-[var(--lk-line)] bg-white pr-2 pl-8 text-[13px] text-[var(--lk-ink)] outline-none focus:border-[#0088ff]"
              />
            </div>
          ) : null}

          {tab === "emoji" ? (
            <>
              <IconGrid items={EMOJIS} onPick={(v) => Pick(v, close)} render={(v) => v} />
              <input
                maxLength={8}
                placeholder="…or type any emoji and press Enter"
                className="h-8 rounded-lg border border-[var(--lk-line)] bg-white px-2.5 text-[13px] text-[var(--lk-ink)] outline-none focus:border-[#0088ff]"
                onKeyDown={(e) => {
                  const value = e.currentTarget.value.trim();
                  if (e.key === "Enter" && value) Pick(value, close);
                }}
              />
            </>
          ) : tab === "lucide" ? (
            <IconGrid items={lucide} onPick={(v) => Pick(v, close)} render={(v) => <IconGlyph icon={v} size={18} />} />
          ) : tab === "material" ? (
            material ? (
              <IconGrid items={google} onPick={(v) => Pick(v, close)} render={(v) => <IconGlyph icon={v} size={20} />} />
            ) : (
              <p className="py-6 text-center text-[13px] text-[var(--lk-muted)]">Loading Google icons…</p>
            )
          ) : (
            <div className="flex flex-col gap-2 py-1">
              <p className="text-[13px] text-[var(--lk-text2)]">Use your own image — PNG, JPG, SVG or GIF. It's resized and stored with the item.</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 items-center justify-center gap-2 rounded-lg bg-black text-sm font-medium text-white hover:bg-black/85"
              >
                <Upload size={16} strokeWidth={1.75} />
                Choose image
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void HandleUpload(e, close)} />
            </div>
          )}

          {(tab === "lucide" ? lucide.length : tab === "material" ? google.length : 0) > MAX_SHOWN ? (
            <p className="text-[11px] text-[var(--lk-muted)]">Showing {MAX_SHOWN} — search to find the rest.</p>
          ) : null}

          {recentIcons.length > 0 ? (
            <div className="flex flex-col gap-1 border-t border-[var(--lk-line)] pt-2">
              <span className="text-[10px] font-semibold tracking-wider text-[var(--lk-subtle)] uppercase">Recently used</span>
              <div className="flex flex-wrap gap-0.5">
                {recentIcons.map((recent) => (
                  <button
                    key={recent}
                    type="button"
                    onClick={() => Pick(recent, close)}
                    className="flex size-8 items-center justify-center rounded-lg text-base text-[var(--lk-text2)] hover:bg-black/[0.05]"
                  >
                    <IconGlyph icon={recent} size={18} />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {icon ? (
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                close();
              }}
              className="self-start text-xs text-[var(--lk-muted)] underline underline-offset-2 hover:text-[var(--lk-text2)]"
            >
              Remove icon
            </button>
          ) : null}
        </div>
      )}
    </Popover>
  );
}
