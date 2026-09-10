"use client";

import { useEffect, useState } from "react";
import { Activity, Cpu, HardDrive, MemoryStick, Users } from "lucide-react";
import { ApiFetch } from "@/Platform/ApiClient";
import { FormatBytes, FormatUptime } from "./FormatBytes";

interface Metrics {
  system: {
    uptime: { process: number; system: number };
    memory: { total: number; free: number; used: number; processRss: number };
    disk: { total: number; free: number; used: number } | null;
    load: { one: number; five: number; fifteen: number };
  };
  storage: { mediaBytes: number; mediaFiles: number };
  counts: { users: number; documents: number; projects: number };
}

const REFRESH_MS = 15_000;

export function AdminMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const Load = async () => {
      try {
        const next = await ApiFetch<Metrics>("/admin/metrics");
        if (!cancelled) {
          setMetrics(next);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load metrics.");
        }
      }
    };

    void Load();
    const timer = setInterval(Load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error) {
    return <p className="text-xs text-[#e5484d]">{error}</p>;
  }

  if (!metrics) {
    return (
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[88px] animate-pulse rounded-xl bg-black/[0.06]" />
        ))}
      </div>
    );
  }

  const { system, storage, counts } = metrics;
  const memoryPercent = (system.memory.used / system.memory.total) * 100;
  const diskPercent = system.disk ? (system.disk.used / system.disk.total) * 100 : null;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
        Server resources
      </span>

      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
        <Tile icon={<Activity size={14} strokeWidth={1.75} />} label="Uptime">
          <p className="text-[20px] font-medium text-[#2c2c2b]">
            {FormatUptime(system.uptime.process)}
          </p>
          <p className="text-xs text-[#91918e]">
            host {FormatUptime(system.uptime.system)}
          </p>
        </Tile>

        <Tile icon={<MemoryStick size={14} strokeWidth={1.75} />} label="Memory">
          <p className="text-[20px] font-medium text-[#2c2c2b]">
            {FormatBytes(system.memory.used)}
          </p>
          <Bar percent={memoryPercent} />
          <p className="text-xs text-[#91918e]">
            of {FormatBytes(system.memory.total)} · API {FormatBytes(system.memory.processRss)}
          </p>
        </Tile>

        <Tile icon={<HardDrive size={14} strokeWidth={1.75} />} label="Disk">
          {system.disk ? (
            <>
              <p className="text-[20px] font-medium text-[#2c2c2b]">
                {FormatBytes(system.disk.used)}
              </p>
              <Bar percent={diskPercent ?? 0} />
              <p className="text-xs text-[#91918e]">
                {FormatBytes(system.disk.free)} free
              </p>
            </>
          ) : (
            // statfs není na Windows k dispozici — ve vývoji tedy chybí.
            <p className="text-xs text-[#91918e]">Not available on this system.</p>
          )}
        </Tile>

        <Tile icon={<Cpu size={14} strokeWidth={1.75} />} label="Load">
          <p className="text-[20px] font-medium text-[#2c2c2b]">
            {system.load.one.toFixed(2)}
          </p>
          <p className="text-xs text-[#91918e]">
            5m {system.load.five.toFixed(2)} · 15m{" "}
            {system.load.fifteen.toFixed(2)}
          </p>
        </Tile>
      </div>

      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
        <Tile icon={<Users size={14} strokeWidth={1.75} />} label="Users">
          <p className="text-[20px] font-medium text-[#2c2c2b]">{counts.users}</p>
        </Tile>
        <Tile icon={<HardDrive size={14} strokeWidth={1.75} />} label="Media">
          <p className="text-[20px] font-medium text-[#2c2c2b]">
            {FormatBytes(storage.mediaBytes)}
          </p>
          <p className="text-xs text-[#91918e]">{storage.mediaFiles} files</p>
        </Tile>
        <Tile icon={<Activity size={14} strokeWidth={1.75} />} label="Documents">
          <p className="text-[20px] font-medium text-[#2c2c2b]">{counts.documents}</p>
        </Tile>
        <Tile icon={<Activity size={14} strokeWidth={1.75} />} label="Projects">
          <p className="text-[20px] font-medium text-[#2c2c2b]">{counts.projects}</p>
        </Tile>
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[#f0efed] bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[#91918e]">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a5a49f]">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.min(100, percent)}%`,
          background: percent > 90 ? "#e5484d" : percent > 70 ? "#e5a000" : "#30a46c",
        }}
      />
    </div>
  );
}
