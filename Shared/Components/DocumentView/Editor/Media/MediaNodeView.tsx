"use client";

import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Crop,
  ImagePlus,
  Loader2,
  Rows3,
  Trash2,
  Upload,
} from "@lockin/shared/Components/Shared/UiIcons";
import { Button } from "@heroui/react";
import { DeleteMediaFile, ResolveMediaUrl, SaveMediaFile } from "@lockin/shared/Lib/MediaStorage";
import { InlineEditable } from "@lockin/shared/Components/Shared/InlineEditable";
import { Stepper } from "@lockin/shared/Components/Shared/StyleControls";
import { MediaCropModal } from "./MediaCropModal";

type MediaAlign = "left" | "center" | "right" | "block";

const ALIGN_OPTIONS: { value: MediaAlign; icon: typeof AlignLeft; label: string }[] = [
  { value: "left", icon: AlignLeft, label: "Align left" },
  { value: "center", icon: AlignCenter, label: "Align center" },
  { value: "right", icon: AlignRight, label: "Align right" },
  { value: "block", icon: Rows3, label: "Full width" },
];

const ALIGN_WRAPPER_CLASS: Record<MediaAlign, string> = {
  left: "mr-auto",
  center: "mx-auto",
  right: "ml-auto",
  block: "w-full",
};

const TOOLBAR_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--lk-text2)] hover:bg-black/[0.06]";

/** Bridges a `media` node's attrs to an upload prompt (empty) or the actual
 * `<img>`/`<video>` (once a file's been picked) — resolving the stored
 * relative path to a loadable URL happens here, freshly, each mount/path
 * change, since it depends on this machine's AppData location (see
 * Lib/MediaStorage.ts's ResolveMediaUrl). */
export function MediaNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { path, mimeType, alt, align, width } = node.attrs as {
    path: string | null;
    mimeType: string | null;
    alt: string;
    align: MediaAlign;
    width: number;
  };
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    ResolveMediaUrl(path).then((resolved) => {
      // Empty string means ResolveMediaUrl's own path-shape check rejected
      // it (see Lib/MediaStorage.ts) — treat that the same as "nothing to
      // show" rather than handing an empty src to <img>/<video>, which some
      // browsers resolve to the current page itself.
      if (!cancelled) setUrl(resolved || null);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  async function HandleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const relativePath = await SaveMediaFile(file);
      updateAttributes({ path: relativePath, mimeType: file.type });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Couldn't save that file.");
    } finally {
      setUploading(false);
    }
  }

  function HandleRemove() {
    if (path) DeleteMediaFile(path).catch(() => {});
    deleteNode();
  }

  async function HandleCropApply(blob: Blob) {
    const previousPath = path;
    const file = new File([blob], "cropped.png", { type: "image/png" });
    try {
      const relativePath = await SaveMediaFile(file);
      updateAttributes({ path: relativePath, mimeType: "image/png" });
      if (previousPath) DeleteMediaFile(previousPath).catch(() => {});
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Couldn't save the cropped image.");
    } finally {
      setCropping(false);
    }
  }

  const isVideo = mimeType?.startsWith("video/") ?? false;

  if (!path) {
    return (
      <NodeViewWrapper data-type="media" contentEditable={false} draggable={false}>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void HandleFile(file);
          }}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--lk-line2)] bg-[var(--lk-panel)] py-10 text-center"
        >
          {uploading ? (
            <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[var(--lk-muted)]" />
          ) : (
            <ImagePlus size={20} strokeWidth={1.5} className="text-[var(--lk-faint)]" />
          )}
          <p className="text-sm text-[var(--lk-muted)]">
            {uploading ? "Uploading…" : "Drag an image or video here, or"}
          </p>
          <Button
            variant="ghost"
            onPress={() => fileInputRef.current?.click()}
            isDisabled={uploading}
            className="h-auto gap-1.5 rounded-lg border border-[var(--lk-line)] bg-white px-3 py-1.5 text-sm font-normal text-[var(--lk-text2)] hover:bg-black/[0.03] disabled:opacity-50"
          >
            <Upload size={14} strokeWidth={1.75} />
            Choose file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void HandleFile(file);
            }}
          />
          {uploadError ? <p className="text-xs text-[#e5484d]">{uploadError}</p> : null}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      data-type="media"
      contentEditable={false}
      draggable={false}
      // Two group markers on the same element on purpose — the remove
      // button below keys off the named `group/media` (unaffected by
      // anything else on the page), while InlineEditable's own empty-field
      // hover-reveal (TodoListView.tsx) only ever responds to the plain
      // unnamed `group`, a separate selector entirely.
      className="group/media group relative my-1 flex flex-col gap-1.5"
    >
      {selected ? (
        <div
          data-marquee-ignore="true"
          className="mx-auto mb-1 flex w-fit items-center gap-0.5 rounded-xl border border-[var(--lk-line)] bg-white p-1 shadow-lg"
        >
          {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => (
            <Button
              key={value}
              variant="ghost"
              isIconOnly
              aria-label={label}
              onPress={() => updateAttributes({ align: value })}
              className={`${TOOLBAR_BUTTON} ${align === value ? "bg-black/[0.06] text-[var(--lk-ink)]" : ""}`}
            >
              <Icon size={15} strokeWidth={1.75} />
            </Button>
          ))}
          <div className="mx-0.5 h-4 w-px bg-[var(--lk-line)]" />
          <Stepper
            value={width}
            unit="%"
            onDec={() => updateAttributes({ width: Math.max(10, width - 5) })}
            onInc={() => updateAttributes({ width: Math.min(100, width + 5) })}
          />
          {!isVideo ? (
            <>
              <div className="mx-0.5 h-4 w-px bg-[var(--lk-line)]" />
              <Button
                variant="ghost"
                isIconOnly
                aria-label="Crop"
                onPress={() => setCropping(true)}
                className={TOOLBAR_BUTTON}
              >
                <Crop size={15} strokeWidth={1.75} />
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      <div className={ALIGN_WRAPPER_CLASS[align]} style={align === "block" ? undefined : { width: `${width}%` }}>
        <div className="relative">
          {isVideo ? (
            <video src={url ?? undefined} controls className="max-h-[480px] w-full rounded-2xl bg-[#000]" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a locally-stored file loaded via Tauri's asset protocol, not a next/image-eligible remote source
            <img
              src={url ?? undefined}
              alt={alt}
              className="max-h-[480px] w-full rounded-2xl object-contain"
            />
          )}
          <Button
            variant="ghost"
            isIconOnly
            onPress={HandleRemove}
            aria-label="Remove"
            className="absolute top-2 right-2 h-auto w-auto rounded-md bg-[#000]/50 p-1.5 text-[#fff] opacity-0 transition-opacity hover:bg-[#000]/70 group-hover/media:opacity-100"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </Button>
        </div>
        <InlineEditable
          value={alt}
          onCommit={(next) => updateAttributes({ alt: next })}
          placeholder="Add a caption…"
          className="text-center text-sm text-[var(--lk-muted)]"
          seamless
        />
      </div>
      {cropping && url && !isVideo ? (
        <MediaCropModal imageUrl={url} onApply={HandleCropApply} onClose={() => setCropping(false)} />
      ) : null}
    </NodeViewWrapper>
  );
}
