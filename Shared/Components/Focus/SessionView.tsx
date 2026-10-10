"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { UseSettingsStore } from "@lockin/shared/Store/UseSettingsStore";
import { PlayChime } from "@lockin/shared/Lib/Chime";
import { Button } from "@heroui/react";
import { InlineEditable } from "@lockin/shared/Components/Shared/InlineEditable";
import { Check, Maximize2, Minimize2, Pause as PauseIcon, Play, Plus, SkipForward, X } from "@lockin/shared/Components/Shared/UiIcons";
import {
  ColumnTasks,
  CurrentTask,
  FormatClock,
  FormatMinutes,
  SpentSec,
  UseFocusStore,
} from "@lockin/shared/Store/UseFocusStore";

/** Překreslí komponentu každou sekundu, dokud `active` platí. */
export function UseNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0088ff] to-[#5ac8fa] transition-[width]"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lk-muted)]">
        {done}/{total} done
      </span>
    </div>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Button
      variant="ghost"
      isIconOnly
      aria-label={label}
      onPress={onPress}
      className="h-8 w-8 min-w-0 rounded-lg text-[var(--lk-text2)] hover:bg-black/[0.05] hover:text-[#0088ff]"
    >
      {children}
    </Button>
  );
}

/** Zvýrazněný aktuální úkol s časem; po najetí myší se přepne na ovládání. */
function CurrentCard({ compact, extra }: { compact?: boolean; extra?: ReactNode }) {
  const state = UseFocusStore();
  const { runningSince, Start, Pause, CompleteCurrent, SkipCurrent } = state;
  const now = UseNow(runningSince !== null);
  const current = CurrentTask(state);
  const spent = current ? SpentSec(state, current, now) : 0;
  // Bez odhadu stopky (nahoru), s odhadem odpočet — po překročení do minusu.
  const clock = current?.estimateMin == null ? spent : current.estimateMin * 60 - spent;

  // Jednou za úkol zazní signál, když mu vyprší odhadovaný čas (Settings → Focus sessions).
  const timeUp = current?.estimateMin != null && clock <= 0;
  const chimedFor = useRef<string | null>(timeUp ? (current?.id ?? null) : null);
  useEffect(() => {
    if (!timeUp || runningSince === null || !current || chimedFor.current === current.id) return;
    chimedFor.current = current.id;
    if (UseSettingsStore.getState().timeUpSound) PlayChime();
  }, [timeUp, runningSince, current]);

  return (
    <div
      className={`group/cur rounded-2xl bg-gradient-to-r from-[#0088ff] to-[#5ac8fa] p-[1.5px] ${
        runningSince === null ? "opacity-80" : ""
      } ${compact ? "flex-1" : ""}`}
    >
      <div className={`relative flex items-center rounded-[14.5px] bg-white px-3.5 ${compact ? "h-10" : "h-14"}`}>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 transition-opacity group-hover/cur:opacity-0">
          <p className={`min-w-0 truncate font-medium text-[var(--lk-ink)] ${compact ? "text-[13px]" : "text-[15px]"}`}>
            {current ? current.title || "Untitled task" : "All done for today"}
          </p>
          {current && (
            <p
              className={`shrink-0 font-semibold tabular-nums tracking-[-0.4px] ${compact ? "text-[15px]" : "text-[22px]"} ${
                clock < 0 ? "text-[#e5484d]" : "text-black"
              }`}
            >
              {FormatClock(clock)}
            </p>
          )}
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover/cur:opacity-100">
          {current && (
            <>
              <RoundButton label={runningSince === null ? "Resume" : "Pause"} onPress={runningSince === null ? Start : Pause}>
                {runningSince === null ? <Play size={17} /> : <PauseIcon size={17} />}
              </RoundButton>
              <RoundButton label="Skip" onPress={SkipCurrent}>
                <SkipForward size={17} />
              </RoundButton>
              <RoundButton label="Done" onPress={CompleteCurrent}>
                <Check size={17} />
              </RoundButton>
            </>
          )}
          {extra}
        </div>
      </div>
    </div>
  );
}

/** Focus session — v Tauri obsah připnutého okna, na webu karta vedle boardu.
 * `onMiniChange` přepne okno mezi plným panelem a mini lištou (velikost okna
 * mění jen desktop, web jen obsah). */
export function SessionView({ onClose, onMiniChange }: { onClose: () => void; onMiniChange?: (mini: boolean) => void }) {
  const state = UseFocusStore();
  const { AddTask, UpdateTask } = state;
  const [mini, setMini] = useState(false);
  const today = ColumnTasks(state, "today");
  const current = CurrentTask(state);
  const upcoming = today.filter((t) => !t.done && t.id !== current?.id);
  const done = today.filter((t) => t.done);
  const estimate = today.filter((t) => !t.done).reduce((sum, t) => sum + (t.estimateMin ?? 0), 0);

  function SetMini(next: boolean) {
    setMini(next);
    onMiniChange?.(next);
  }

  if (mini) {
    return (
      <div data-tauri-drag-region className="flex h-full items-center bg-[var(--lk-panel)] px-1.5">
        <CurrentCard
          compact
          extra={
            <RoundButton label="Expand" onPress={() => SetMini(false)}>
              <Maximize2 size={15} />
            </RoundButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 bg-[var(--lk-panel)] p-3">
      <div data-tauri-drag-region className="flex items-center justify-between">
        <p data-tauri-drag-region className="text-[17px] font-semibold tracking-[-0.34px] text-black">
          Today
        </p>
        <div className="flex items-center text-[var(--lk-muted)]">
          <RoundButton label="Collapse to mini bar" onPress={() => SetMini(true)}>
            <Minimize2 size={15} />
          </RoundButton>
          <RoundButton label="End session" onPress={onClose}>
            <X size={16} />
          </RoundButton>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {estimate > 0 && <p className="text-xs text-[var(--lk-muted)]">Est: {FormatMinutes(estimate)}</p>}
        <ProgressBar done={done.length} total={today.length} />
      </div>

      <CurrentCard />

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {upcoming.map((task, i) => (
          <div key={task.id} className="group rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05]">
            <div className="flex items-baseline gap-2 text-[13.5px] font-medium text-[var(--lk-ink)]">
              <span className="text-xs tabular-nums text-[var(--lk-faint)]">{i + 2}</span>
              <div className="min-w-0 flex-1 truncate">
                <InlineEditable value={task.title} placeholder="Untitled task" onCommit={(title) => UpdateTask(task.id, { title })} />
              </div>
            </div>
            <div className="mt-1 flex justify-between pl-[18px] text-[11px] tabular-nums text-[var(--lk-muted)]">
              <span>{task.estimateMin === null ? "No estimate" : FormatMinutes(task.estimateMin)}</span>
              <span>{FormatMinutes(Math.floor(task.spentSec / 60))}</span>
            </div>
          </div>
        ))}

        <Button
          variant="ghost"
          onPress={() => AddTask("today")}
          className="h-8 justify-start gap-1.5 rounded-lg px-2 text-[13px] font-normal text-[var(--lk-muted)] hover:bg-black/[0.04] hover:text-[var(--lk-ink)]"
        >
          <Plus size={15} />
          Add task
        </Button>

        {done.length > 0 && (
          <>
            <div className="mt-1 flex justify-between border-t border-black/[0.06] px-1 pt-3 text-[13px] text-[var(--lk-muted)]">
              <span>{done.length} Done</span>
              <span className="tabular-nums">{FormatMinutes(Math.floor(done.reduce((sum, t) => sum + t.spentSec, 0) / 60))}</span>
            </div>
            {done.map((task) => (
              <div key={task.id} className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 ring-1 ring-black/[0.04]">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0088ff] to-[#5ac8fa] text-[#fff]">
                  <Check size={10} strokeWidth={3} />
                </span>
                <p className="min-w-0 flex-1 truncate text-[13px] text-[var(--lk-subtle)] line-through">{task.title || "Untitled task"}</p>
                <span className="shrink-0 text-[11px] tabular-nums text-[var(--lk-muted)]">
                  {FormatMinutes(Math.floor(task.spentSec / 60))}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
