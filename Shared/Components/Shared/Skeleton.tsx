import type { CSSProperties } from "react";

/** Base pulsing placeholder block — every skeleton in the app (Sidebar rows,
 * Library/Projects table rows, document headers, ...) is built out of these,
 * sized/arranged to loosely echo the real content's shape so the layout
 * doesn't visibly jump once the real data replaces it. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse rounded-md bg-black/[0.06] ${className ?? ""}`} style={style} />;
}
