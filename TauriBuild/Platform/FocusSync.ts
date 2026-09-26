import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { UseFocusStore } from "@lockin/shared/Store/UseFocusStore";

/**
 * Hlavní okno a okno session mají každé vlastní JS kontext, tedy vlastní
 * kopii UseFocusStore. Tohle je drží shodné: každá lokální změna se rozešle
 * ostatním oknům, a okno session si po startu vyžádá aktuální stav (disk může
 * být o zápis pozadu).
 */
let applyingRemote = false;
let started = false;

type Snapshot = Pick<ReturnType<typeof UseFocusStore.getState>, "tasks" | "groups" | "runningSince">;

export async function StartFocusSync(): Promise<void> {
  if (started) return;
  started = true;
  let self: string;
  try {
    self = getCurrentWindow().label;
  } catch {
    return; // mimo Tauri (obyčejná záložka při vývoji)
  }

  const Broadcast = () => {
    const { tasks, groups, runningSince } = UseFocusStore.getState();
    emit("focus-sync", { from: self, state: { tasks, groups, runningSince } }).catch(() => {});
  };

  UseFocusStore.subscribe(() => {
    if (!applyingRemote) Broadcast();
  });

  // Posluchače se musí zaregistrovat dřív, než okno session požádá o stav —
  // jinak by odpověď mohla dorazit do prázdna.
  await Promise.all([
    listen<{ from: string; state: Snapshot }>("focus-sync", ({ payload }) => {
      if (payload.from === self) return;
      applyingRemote = true;
      UseFocusStore.setState(payload.state);
      applyingRemote = false;
    }),
    listen<{ from: string }>("focus-sync-request", ({ payload }) => {
      if (payload.from !== self) Broadcast();
    }),
  ]).catch(() => {});

  if (self !== "main") await emit("focus-sync-request", { from: self }).catch(() => {});
}
