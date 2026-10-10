import { Rocket } from "@lockin/shared/Components/Shared/UiIcons";
import { IconGlyph } from "./IconGlyph";

interface ProjectIconProps {
  icon?: string | null;
  size?: number;
  className?: string;
}

/** Ikona projektu/dokumentu (emoji, obrázek, Lucide, Google Material — viz
 * Lib/Icons.ts), bez nastavené ikony výchozí raketa. */
export function ProjectIcon({ icon, size = 20, className }: ProjectIconProps) {
  if (icon) return <IconGlyph icon={icon} size={size} className={className} />;
  return <Rocket size={size} strokeWidth={1.5} className={`shrink-0 text-[var(--lk-muted)] ${className ?? ""}`} />;
}
