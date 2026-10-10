"use client";

import Link from "next/link";
import { Button, Tabs } from "@heroui/react";
import { ExternalLink, FileText, Maximize2, Minimize2, PenTool, Settings, Star, X } from "lucide-react";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { DocumentSettingsMenu } from "@lockin/shared/Components/DocumentView/DocumentSettingsMenu";
import type { DocumentRecord } from "@lockin/shared/Types/Project";

const ICON_PILL =
  "flex shrink-0 items-center rounded-lg border border-[var(--lk-line)] bg-[var(--lk-panel)] !p-0";
const ICON_PILL_BUTTON = "flex items-center justify-center rounded-l-md rounded-r-md p-1 w-[32px] h-[32px] text-[var(--lk-text2)]";

interface DocumentModeToolbarProps {
  title: string;
  /** Custom title icon — pass a ProjectIcon for project documents. Falls
   * back to the generic FileText icon (e.g. for Quick Notes). */
  icon?: React.ReactNode;
  /** Omit to hide the favorite star (e.g. Quick Notes has no favorite concept). */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Library's 600px side panel vs the full page — the width-toggle and
   * settings buttons aren't meaningful at that width (toggling "wide" would
   * even leak into the full page's own state, since it's the same global
   * UseUiStore flag), so they're swapped for an "open full page" link and a
   * close button instead. Everything else renders identically, on purpose —
   * this is the one toolbar both StandaloneDocumentEditor.tsx and
   * ProjectView.tsx use in *both* modes, specifically so a compact panel
   * never drifts into looking like a different, smaller-built component. */
  compact?: boolean;
  /** compact only — href for the "open full page" link. */
  externalHref?: string;
  /** compact only — closes the panel. */
  onClose?: () => void;
  /** The document the gear button's settings menu edits — full mode only. */
  document?: DocumentRecord;
}

/** Must be rendered inside an ancestor `<Tabs>` root — it only supplies the
 * List/Tab pieces, the Tabs root (selectedKey/mode state) lives with whoever
 * owns the actual Text/Sketch content. */
export function DocumentModeToolbar({
  title,
  icon,
  isFavorite,
  onToggleFavorite,
  compact = false,
  externalHref,
  onClose,
  document,
}: DocumentModeToolbarProps) {
  const isWide = UseUiStore((state) => state.isDocumentWide);
  const toggleWide = UseUiStore((state) => state.ToggleDocumentWide);

  return (
    <div className="flex items-center justify-between gap-3 px-[15px] py-2">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[16px] font-medium tracking-[-0.32px] text-black">
          {icon ?? <FileText size={20} strokeWidth={1.5} className="shrink-0 text-[var(--lk-text2)]" />}
          <span className="truncate select-none">{title || "Untitled"}</span>
        </div>
        {/* Tabs.List must be the direct child of Tabs.ListContainer — HeroUI
            injects a chrome prop via cloneElement onto whatever child sits
            here, and only Tabs.List knows how to consume/strip it. Wrapping
            it in another div here leaks that prop onto a plain DOM node. */}
        <Tabs.ListContainer>
          <Tabs.List aria-label="Document mode" className={ICON_PILL}>
            <Tabs.Tab
              id="text"
              aria-label="Text mode"
              className={`${ICON_PILL_BUTTON} rounded-r-none! data-[selected]:bg-[var(--lk-gray)] data-[selected]:text-[var(--lk-ink)]`}
            >
              <FileText size={16} strokeWidth={1.5} />
              <Tabs.Indicator className="bg-[var(--lk-gray)] rounded-r-none! rounded-l-md" />
            </Tabs.Tab>
            <Tabs.Tab
              id="sketch"
              aria-label="Sketch mode"
              className={`${ICON_PILL_BUTTON} rounded-l-none! data-[selected]:bg-[var(--lk-gray)] data-[selected]:text-[var(--lk-ink)]`}
            >
              <PenTool size={16} strokeWidth={1.5} />
              <Tabs.Indicator className="bg-[var(--lk-gray)] rounded-l-none! rounded-r-md" />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </div>

      <div className={ICON_PILL}>
        {onToggleFavorite ? (
          <Button
            variant="ghost"
            isIconOnly
            onPress={onToggleFavorite}
            className={`${ICON_PILL_BUTTON} w-[32px] h-[32px] hover:bg-black/[0.04]`}
            aria-label={isFavorite ? "Unfavorite" : "Favorite"}
          >
            <Star
              size={16}
              strokeWidth={1.5}
              className={isFavorite ? "fill-[#e5a000] text-[#e5a000]" : ""}
            />
          </Button>
        ) : null}
        {compact ? (
          <>
            {externalHref ? (
              <Link
                href={externalHref}
                aria-label="Open full page"
                className={`${ICON_PILL_BUTTON} w-[32px] h-[32px] hover:bg-black/[0.04]`}
              >
                <ExternalLink size={16} strokeWidth={1.5} />
              </Link>
            ) : null}
            {onClose ? (
              <Button
                variant="ghost"
                isIconOnly
                onPress={onClose}
                className={`${ICON_PILL_BUTTON} w-[32px] h-[32px] hover:bg-black/[0.04]`}
                aria-label="Close"
              >
                <X size={16} strokeWidth={1.5} />
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              isIconOnly
              onPress={toggleWide}
              className={`${ICON_PILL_BUTTON} w-[32px] h-[32px] hover:bg-black/[0.04]`}
              aria-label={isWide ? "Use comfortable width" : "Stretch content to full width"}
            >
              {isWide ? (
                <Minimize2 size={16} strokeWidth={1.5} />
              ) : (
                <Maximize2 size={16} strokeWidth={1.5} />
              )}
            </Button>
            {document ? (
              <Popover
                align="right"
                trigger={() => (
                  <Button
                    variant="ghost"
                    isIconOnly
                    className={`${ICON_PILL_BUTTON} w-[32px] h-[32px] hover:bg-black/[0.04]`}
                    aria-label="Settings"
                  >
                    <Settings size={16} strokeWidth={1.5} />
                  </Button>
                )}
                panelClassName="p-1"
              >
                {(close) => <DocumentSettingsMenu document={document} close={close} />}
              </Popover>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
