"use client";

import { Button } from "@heroui/react";
import { Star } from "lucide-react";

/** The star toggle used on every table/sidebar row (documents, projects,
 * folders, tags) — `stopPropagation` on click keeps it from also triggering
 * the row's own "open this" handler. */
export function FavoriteStarButton({
  isFavorite,
  onToggle,
}: {
  isFavorite: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      isIconOnly
      onClick={(e) => e.stopPropagation()}
      onPress={onToggle}
      aria-label={isFavorite ? "Unfavorite" : "Favorite"}
      // Pevná šířka a viditelná jen při najetí na řádek (`group/row`) — vedle
      // ikony projektu jinak splývala s ní. Oblíbená je vidět vždy, vyplněná.
      className={`flex size-6 min-w-0 shrink-0 items-center justify-center rounded-md p-0 text-[var(--lk-faint)] outline-none hover:bg-black/[0.06] hover:text-[#e5a000] focus-visible:opacity-100 ${
        isFavorite ? "" : "opacity-0 group-hover/row:opacity-100"
      }`}
    >
      <Star size={14} strokeWidth={1.5} className={isFavorite ? "fill-[#e5a000] text-[#e5a000]" : ""} />
    </Button>
  );
}
