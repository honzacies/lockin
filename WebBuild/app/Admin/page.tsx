"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@heroui/react";
import { Copy, Loader2, Plus, ShieldX, Ticket } from "lucide-react";
import { ApiFetch } from "@/Platform/ApiClient";
import { GetSessionUser } from "@/Platform/Session";
import { AdminMetrics } from "@/Components/AdminMetrics";
import { FormatBytes } from "@/Components/FormatBytes";

interface Invite {
  id: string;
  code: string;
  note: string | null;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  usedBy: { id: string; username: string } | null;
  state: "active" | "used" | "expired" | "revoked";
}

interface AdminUser {
  id: string;
  username: string;
  role: "USER" | "ADMIN";
  storageQuota: string;
  storageUsed: string;
  createdAt: string;
  lastSeenAt: string | null;
  counts: { projects: number; documents: number; media: number };
}

const STATE_STYLE: Record<Invite["state"], string> = {
  active: "bg-[#30a46c]/10 text-[#30a46c]",
  used: "bg-black/[0.06] text-[#5f5e59]",
  expired: "bg-[#e5a000]/10 text-[#e5a000]",
  revoked: "bg-[#e5484d]/10 text-[#e5484d]",
};

const STATE_LABEL: Record<Invite["state"], string> = {
  active: "active",
  used: "used",
  expired: "expired",
  revoked: "revoked",
};

export default function AdminPage() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [count, setCount] = useState("1");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const Load = useCallback(async () => {
    try {
      const [nextInvites, nextUsers] = await Promise.all([
        ApiFetch<Invite[]>("/admin/invites"),
        ApiFetch<AdminUser[]>("/admin/users"),
      ]);
      setInvites(nextInvites);
      setUsers(nextUsers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load.");
    }
  }, []);

  useEffect(() => {
    const user = GetSessionUser();
    if (!user) {
      window.location.href = "/Login";
      return;
    }
    if (user.role !== "ADMIN") {
      setError("You do not have access to this page.");
      return;
    }
    void Load();
  }, [Load]);

  async function HandleCreate() {
    setCreating(true);
    setError(null);
    try {
      await ApiFetch("/admin/invites", {
        method: "POST",
        body: {
          count: Math.max(1, Math.min(50, Number(count) || 1)),
          note: note.trim() || undefined,
        },
      });
      setNote("");
      setCount("1");
      await Load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create codes.");
    } finally {
      setCreating(false);
    }
  }

  async function HandleRevoke(id: string) {
    try {
      await ApiFetch(`/admin/invites/${id}/revoke`, { method: "POST" });
      await Load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not revoke the code.");
    }
  }

  async function HandleCopy(code: string) {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  if (error && !invites) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-[50px]">
        <p className="text-sm text-[#e5484d]">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-[50px] pt-6 pb-16">
      <div className="flex items-center gap-1.5 text-sm text-[#91918e]">
        <ShieldX size={16} strokeWidth={1.5} />
        Admin
      </div>
      <div className="flex items-center gap-2.5">
        <ShieldX size={56} strokeWidth={1.5} className="text-black" />
        <p className="text-[40px] font-medium tracking-[-0.8px] text-black">Admin</p>
      </div>

      <AdminMetrics />

      <section className="flex flex-col gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
          Invite codes
        </span>

        <div className="flex items-end gap-1.5">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#91918e]">Count</span>
            <Input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-20 rounded-lg border border-[#f0efed] px-2 py-1.5 text-sm outline-none focus:border-[#c9c8c4]"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-[#91918e]">Note (optional)</span>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. for Pavel"
              className="w-full rounded-lg border border-[#f0efed] px-2 py-1.5 text-sm outline-none focus:border-[#c9c8c4]"
            />
          </label>
          <Button
            variant="primary"
            isDisabled={creating}
            onPress={HandleCreate}
            className="h-auto justify-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-[13px] font-normal text-white"
          >
            {creating ? (
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
            ) : (
              <Plus size={14} strokeWidth={1.75} />
            )}
            Generate
          </Button>
        </div>

        {error ? <p className="text-xs text-[#e5484d]">{error}</p> : null}

        <div className="overflow-x-auto rounded-xl border border-[#f0efed]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["Code", "State", "Note", "Used by", "Created", ""].map((header) => (
                  <th
                    key={header}
                    className="border-b border-[#f0efed] bg-[#f9f8f7] px-3 py-2 text-left font-medium text-[#5f5e59]"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invites === null ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[#91918e]">
                    Loading…
                  </td>
                </tr>
              ) : invites.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[#91918e]">
                    No codes yet.
                  </td>
                </tr>
              ) : (
                invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-black/[0.02]">
                    <td className="border-b border-[#f0efed] px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Ticket size={13} strokeWidth={1.5} className="shrink-0 text-[#91918e]" />
                        <code className="font-mono text-xs text-[#2c2c2b]">{invite.code}</code>
                        <button
                          type="button"
                          onClick={() => HandleCopy(invite.code)}
                          aria-label="Copy code"
                          className="rounded p-0.5 text-[#c9c8c4] hover:bg-black/[0.06] hover:text-[#2c2c2b]"
                        >
                          <Copy size={12} strokeWidth={1.75} />
                        </button>
                        {copied === invite.code ? (
                          <span className="text-[10px] text-[#30a46c]">copied</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="border-b border-[#f0efed] px-3 py-2">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${STATE_STYLE[invite.state]}`}
                      >
                        {STATE_LABEL[invite.state]}
                      </span>
                    </td>
                    <td className="border-b border-[#f0efed] px-3 py-2 text-[#5f5e59]">
                      {invite.note ?? "—"}
                    </td>
                    <td className="border-b border-[#f0efed] px-3 py-2 text-[#5f5e59]">
                      {invite.usedBy?.username ?? "—"}
                    </td>
                    <td className="border-b border-[#f0efed] px-3 py-2 text-[#91918e]">
                      {new Date(invite.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="border-b border-[#f0efed] px-3 py-2 text-right">
                      {invite.state === "active" ? (
                        <button
                          type="button"
                          onClick={() => HandleRevoke(invite.id)}
                          className="text-xs text-[#91918e] underline underline-offset-2 hover:text-[#e5484d]"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
          Users
        </span>
        <div className="overflow-x-auto rounded-xl border border-[#f0efed]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["Name", "Role", "Storage", "Documents", "Projects", "Last seen"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-[#f0efed] bg-[#f9f8f7] px-3 py-2 text-left font-medium text-[#5f5e59]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users === null ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[#91918e]">
                    Loading…
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const used = Number(user.storageUsed);
                  const quota = Number(user.storageQuota);
                  const percent = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
                  return (
                    <tr key={user.id} className="hover:bg-black/[0.02]">
                      <td className="border-b border-[#f0efed] px-3 py-2 font-medium text-[#2c2c2b]">
                        {user.username}
                      </td>
                      <td className="border-b border-[#f0efed] px-3 py-2 text-[#5f5e59]">
                        {user.role === "ADMIN" ? "admin" : "user"}
                      </td>
                      <td className="border-b border-[#f0efed] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-[80px] overflow-hidden rounded-full bg-black/[0.06]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${percent}%`,
                                background: percent > 90 ? "#e5484d" : "#30a46c",
                              }}
                            />
                          </div>
                          <span className="text-xs text-[#5f5e59]">
                            {FormatBytes(used)} / {FormatBytes(quota)}
                          </span>
                        </div>
                      </td>
                      <td className="border-b border-[#f0efed] px-3 py-2 text-[#5f5e59]">
                        {user.counts.documents}
                      </td>
                      <td className="border-b border-[#f0efed] px-3 py-2 text-[#5f5e59]">
                        {user.counts.projects}
                      </td>
                      <td className="border-b border-[#f0efed] px-3 py-2 text-[#91918e]">
                        {user.lastSeenAt
                          ? new Date(user.lastSeenAt).toLocaleDateString("en-GB")
                          : "never"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
