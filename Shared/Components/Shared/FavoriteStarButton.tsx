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
      className="h-auto w-auto shrink-0 rounded p-0.5 text-[#c9c8c4] hover:bg-black/[0.06] hover:text-[#e5a000]"
    >
      <Star size={14} strokeWidth={1.5} className={isFavorite ? "fill-[#e5a000] text-[#e5a000]" : ""} />
    </Button>
  );
}
