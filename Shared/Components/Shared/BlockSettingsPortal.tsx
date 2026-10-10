"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";
import { X } from "@lockin/shared/Components/Shared/UiIcons";

/** The settings-panel header (title + close button), portaled into the
 * shared settings-panel slot — shared by ColorPaletteView, ScenarioView, and
 * TodoListView, which each render one of these for their own settings
 * panel and only differed in the title text. */
export function BlockSettingsPortal({
  open,
  portalNode,
  title,
  onClose,
  children,
}: {
  open: boolean;
  portalNode: Element | null;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open || !portalNode) return null;
  return createPortal(
    <div className="flex select-none flex-col gap-2">
      <div className="flex items-center justify-between border-b border-[var(--lk-line)] px-3 py-2.5">
        <span className="text-[13px] font-medium text-[var(--lk-ink)]">{title}</span>
        <Button
          variant="ghost"
          isIconOnly
          onPress={onClose}
          aria-label="Close settings"
          className="h-auto w-auto rounded p-1 text-[var(--lk-muted)] hover:bg-black/[0.05] hover:text-[var(--lk-ink)]"
        >
          <X size={14} strokeWidth={1.75} />
        </Button>
      </div>
      {children}
    </div>,
    portalNode,
  );
}
