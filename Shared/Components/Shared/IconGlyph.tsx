"use client";

import { useEffect, useState } from "react";
import { DynamicIcon, type IconName as LucideName } from "lucide-react/dynamic";
import { IconKindOf, IconName, MaterialBody, MaterialBodySync } from "@lockin/shared/Lib/Icons";

function MaterialIcon({ name, size, className }: { name: string; size: number; className?: string }) {
  const [body, setBody] = useState(() => MaterialBodySync(name));
  useEffect(() => {
    if (body) return;
    let alive = true;
    MaterialBody(name).then((b) => alive && setBody(b));
    return () => {
      alive = false;
    };
  }, [name, body]);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      // Inline rozměr — HeroUI Button jinak všem SVG uvnitř vnutí 16 px.
      style={{ width: size, height: size }}
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden
      // Tělo SVG je z balíčku @iconify-json/material-symbols, ne od uživatele.
      dangerouslySetInnerHTML={body ? { __html: body } : undefined}
    />
  );
}

/**
 * Vykreslí ikonu v libovolném formátu (emoji, obrázek, Lucide, Material — viz
 * Lib/Icons.ts). Prázdná ikona = nic; výchozí ikonu si řeší volající.
 */
export function IconGlyph({ icon, size = 20, className }: { icon?: string | null; size?: number; className?: string }) {
  if (!icon) return null;
  switch (IconKindOf(icon)) {
    case "image":
      // eslint-disable-next-line @next/next/no-img-element -- malý data-URL avatar
      return <img src={icon} alt="" className={`shrink-0 rounded-md object-cover ${className ?? ""}`} style={{ width: size, height: size }} />;
    case "lucide":
      return <DynamicIcon name={IconName(icon) as LucideName} size={size} strokeWidth={1.75} style={{ width: size, height: size }} className={`shrink-0 ${className ?? ""}`} />;
    case "material":
      return <MaterialIcon name={IconName(icon)} size={size} className={className} />;
    default:
      return (
        <span className={`shrink-0 leading-none ${className ?? ""}`} style={{ fontSize: size * 0.85 }}>
          {icon}
        </span>
      );
  }
}
