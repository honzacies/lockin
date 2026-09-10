"use client";

import { useRef } from "react";
import { Button, Input } from "@heroui/react";
import { ImagePlus, Upload } from "lucide-react";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { FileToIconDataUrl } from "@lockin/shared/Lib/Icon";
import { Popover } from "./Popover";

const PRESET_ICONS = ["🚀", "📁", "✨", "🎯", "📝", "💡", "🔥", "🌱", "⚡", "🎨"];

interface IconPickerProps {
  icon?: string | null;
  onChange: (icon: string | undefined) => void;
  size?: number;
  /** When true and no icon is set, the "add icon" placeholder stays invisible
   * until this trigger is hovered (or the picker is open) — for compact
   * contexts where an empty-icon hint would otherwise always be visible. */
  placeholderOnlyOnHover?: boolean;
}

/** A transparent, borderless icon trigger — chrome only appears on hover or
 * while the picker is open. The picker offers preset emojis, a custom emoji
 * input, recently-used icons, and image upload (stored as a small data URL). */
export function IconPicker({ icon, onChange, size = 64, placeholderOnlyOnHover }: IconPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recentIcons = UseUiStore((s) => s.recentIcons);
  const AddRecentIcon = UseUiStore((s) => s.AddRecentIcon);

  function Pick(next: string, close: () => void) {
    onChange(next);
    AddRecentIcon(next);
    close();
  }

  async function HandleUpload(e: React.ChangeEvent<HTMLInputElement>, close: () => void) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await FileToIconDataUrl(file);
    Pick(dataUrl, close);
  }

  return (
    <Popover
      trigger={(open) => (
        <Button
          variant="ghost"
          isIconOnly
          aria-label="Set project icon"
          className={`h-auto w-auto flex flex-row items-center justify-center group/picker shrink-0 rounded-2xl p-0 leading-none transition-colors ${open ? "bg-black/[0.04]" : "hover:bg-transparent"
            }`}
          style={{ width: size, height: size, fontSize: size * 0.5 }}
        >
          {icon?.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element -- small inline data-URL avatar
            <img
              src={icon}
              alt=""
              className="size-full rounded-2xl object-cover"
            />
          ) : icon ? (
            icon
          ) : (
            <ImagePlus
              size={size * 0.35}
              strokeWidth={1.5}
              className={`text-[#c9c8c4] ${placeholderOnlyOnHover && !open
                  ? "opacity-0 transition-opacity group-hover/picker:opacity-100"
                  : ""
                }`}
            />
          )}
        </Button>
      )}
      panelClassName="w-60 p-3"
    >
      {(close) => (
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">SUGGESTED EMOJIS</span>
          <div className="grid grid-cols-5 gap-1">
            {PRESET_ICONS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                isIconOnly
                onPress={() => Pick(emoji, close)}
                className="h-9 w-9 rounded-lg text-lg hover:bg-black/[0.04]"
              >
                {emoji}
              </Button>
            ))}
          </div>

          {recentIcons.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
                Recently used
              </span>
              <div className="flex flex-wrap gap-1">
                {recentIcons.map((recent) => (
                  <Button
                    key={recent}
                    variant="ghost"
                    isIconOnly
                    onPress={() => Pick(recent, close)}
                    className="h-9 w-9 rounded-lg text-lg hover:bg-black/[0.04]"
                  >
                    {recent.startsWith("data:") ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small inline data-URL avatar
                      <img src={recent} alt="" className="size-6 rounded-md object-cover" />
                    ) : (
                      recent
                    )}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">OR</span>
          <Input
            maxLength={4}
            placeholder="Type an emoji…"
            className="rounded-lg border border-[#f0efed] px-2 py-1 text-sm outline-none focus:border-[#c9c8c4]"
            onKeyDown={(e) => {
              const trimmed = e.currentTarget.value.trim();
              if (e.key === "Enter" && trimmed) Pick(trimmed, close);
            }}
          />

          <Button
            variant="primary"
            onPress={() => fileInputRef.current?.click()}
            className="h-auto bg-black justify-center gap-2 rounded-full w-full px-0 py-1.5 text-sm font-normal text-white"
          >
            <Upload size={16} strokeWidth={1.75} />
            Upload image
          </Button>
          {/* Native, hidden, programmatically triggered — no visible chrome to
           * restyle, and HeroUI has no file-input equivalent. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void HandleUpload(e, close)}
          />

          {icon ? (
            <Button
              variant="ghost"
              onPress={() => {
                onChange(undefined);
                close();
              }}
              className="h-auto justify-start rounded-none p-0 text-left text-xs font-normal text-[#91918e] underline underline-offset-2 hover:text-[#5f5e59]"
            >
              Remove icon
            </Button>
          ) : null}
        </div>
      )}
    </Popover>
  );
}
