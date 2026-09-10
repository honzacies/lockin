import { freemem, loadavg, totalmem, uptime as osUptime } from "node:os";
import { statfs } from "node:fs/promises";
import { Env } from "../Env.js";

/**
 * Údaje o zdrojích pro administraci. Čte se přímo z OS, žádný Prometheus ani
 * jiná externí služba — na jednom VPS by to byla zbytečná vrstva navíc.
 */

export interface SystemMetrics {
  uptime: { process: number; system: number };
  memory: { total: number; free: number; used: number; processRss: number };
  disk: { total: number; free: number; used: number } | null;
  load: { one: number; five: number; fifteen: number };
}

export async function CollectSystemMetrics(): Promise<SystemMetrics> {
  const total = totalmem();
  const free = freemem();
  const [one, five, fifteen] = loadavg();

  // statfs je na Windows nedostupné/nespolehlivé — vývoj na Windows tedy
  // dostane `disk: null` místo pádu, produkce na Ubuntu má reálná čísla.
  let disk: SystemMetrics["disk"] = null;
  try {
    const fs = await statfs(Env.MEDIA_DIR);
    const diskTotal = fs.blocks * fs.bsize;
    const diskFree = fs.bavail * fs.bsize;
    disk = { total: diskTotal, free: diskFree, used: diskTotal - diskFree };
  } catch {
    disk = null;
  }

  return {
    uptime: { process: Math.floor(process.uptime()), system: Math.floor(osUptime()) },
    memory: {
      total,
      free,
      used: total - free,
      processRss: process.memoryUsage().rss,
    },
    disk,
    load: { one, five, fifteen },
  };
}
