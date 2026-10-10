"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Columns3, House } from "@lockin/shared/Components/Shared/UiIcons";

const TABS = [
  { href: "/Todo", label: "Home", icon: House },
  { href: "/Todo/Board", label: "Board", icon: Columns3 },
];

/** Přepínač Home / Board pod nadpisem To-do (stejný tvar jako Notes / To-do v sidebaru). */
export function TodoTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1.5">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex select-none items-center gap-1.5 rounded-[20px] px-2.5 py-[3px] text-sm ${
              active ? "bg-black/[0.04] text-[var(--lk-ink)]" : "text-[var(--lk-muted)] hover:bg-black/[0.03] hover:text-[var(--lk-text2)]"
            }`}
          >
            <Icon size={16} strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
