"use client";

import { useEffect, useState } from "react";
import { LogOut, ShieldCheck, User } from "lucide-react";
import { ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ApiFetch } from "@/Platform/ApiClient";
import { ClearSession, GetSessionUser, OnSessionChange, GetRefreshToken, type SessionUser } from "@/Platform/Session";

/**
 * Pata sidebaru na webu — kdo je přihlášený, odkaz do administrace (jen pro
 * admina) a odhlášení. Desktop tenhle slot nechává prázdný, žádné účty nemá.
 *
 * Drží kompaktní menu styl z DESIGN.md: řádky s ikonou a labelem, `text-[13px]`,
 * hover na wrapperu.
 */
export function AccountMenu() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(GetSessionUser());
    return OnSessionChange(setUser);
  }, []);

  if (!user) return null;

  async function HandleLogout() {
    const refreshToken = GetRefreshToken();
    // Odvolání na serveru je „nice to have" — když selže (offline, vypadlé
    // API), lokální session se zahodí tak jako tak, ať uživatel nezůstane
    // viset přihlášený.
    if (refreshToken) {
      await ApiFetch("/auth/logout", { method: "POST", body: { refreshToken } }).catch(() => {});
    }
    ClearSession();
    window.location.href = "/Login";
  }

  return (
    <Popover
      align="left"
      // Trigger sedí na spodní hraně sidebaru — panel musí vyjet nahoru,
      // dolů by skončil pod okrajem okna a nešel by na něj kliknout.
      side="top"
      panelClassName="w-52 p-1"
      trigger={(open) => (
        <div
          className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border border-[#f0efed] px-2 py-1.5 transition-colors ${
            open ? "bg-black/[0.04]" : "hover:bg-black/[0.03]"
          }`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2c2c2b] text-[11px] font-medium text-white">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-[13px] text-[#2c2c2b]">
            {user.username}
          </span>
          {user.role === "ADMIN" ? (
            <ShieldCheck size={13} strokeWidth={1.75} className="shrink-0 text-[#91918e]" />
          ) : null}
        </div>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-px">
          <ContextMenuLabel first>Účet</ContextMenuLabel>
          <ContextMenuItem icon={<User size={14} strokeWidth={1.75} className="text-[#5f5e59]" />} onClick={close}>
            {user.username}
          </ContextMenuItem>

          {user.role === "ADMIN" ? (
            <>
              <ContextMenuLabel>Správa</ContextMenuLabel>
              <ContextMenuItem
                icon={<ShieldCheck size={14} strokeWidth={1.75} className="text-[#5f5e59]" />}
                onClick={() => {
                  close();
                  window.location.href = "/Admin";
                }}
              >
                Administrace
              </ContextMenuItem>
            </>
          ) : null}

          <ContextMenuLabel>Relace</ContextMenuLabel>
          <ContextMenuItem
            danger
            icon={<LogOut size={14} strokeWidth={1.75} />}
            onClick={() => {
              close();
              void HandleLogout();
            }}
          >
            Odhlásit se
          </ContextMenuItem>
        </div>
      )}
    </Popover>
  );
}
