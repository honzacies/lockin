import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CreatePersistStorage } from "@lockin/shared/Platform/PersistStorage";

export type FocusColumn = "backlog" | "week" | "today";
export const FOCUS_COLUMNS: FocusColumn[] = ["backlog", "week", "today"];

export interface FocusTask {
  id: string;
  title: string;
  description?: string;
  column: FocusColumn;
  /** Skupina uvnitř sloupce; bez ní je úkol v nezařazené části nahoře. */
  groupId?: string;
  /** null = bez odhadu, čas se jen měří (stopky místo odpočtu). */
  estimateMin: number | null;
  /** Odpracováno bez právě běžícího úseku — ten se dopočítá z `runningSince`. */
  spentSec: number;
  done: boolean;
  /** Úkol importovaný z to-do listu jinde v aplikaci (kopie, ne živé propojení). */
  source?: { key: string; label: string; href: string };
}

/** Pojmenovaná skupina úkolů ve sloupci — obdoba kategorií v to-do listech. */
export interface FocusGroup {
  id: string;
  column: FocusColumn;
  title: string;
  icon?: string;
  /** ID zdrojového to-do listu, když skupina vznikla importem celého listu. */
  sourceListId?: string;
}

export type ImportedTask = Pick<FocusTask, "title" | "description"> & { source: NonNullable<FocusTask["source"]> };

/** Kam se úkol pustí: do sloupce/skupiny, vedle `anchorId` (nebo na konec). */
export interface DropTarget {
  column: FocusColumn;
  groupId?: string;
  anchorId: string | null;
  after: boolean;
}

type Board = Pick<FocusState, "tasks" | "groups" | "runningSince">;

export interface FocusState {
  tasks: FocusTask[];
  groups: FocusGroup[];
  /** Timestamp (ms), od kdy běží aktuální úkol; null = session stojí. */
  runningSince: number | null;
  AddTask: (column: FocusColumn, groupId?: string) => void;
  /** Přidá úkoly na konec sloupce; ty, které už tu jsou (stejný zdroj), přeskočí.
   * S `list` je dá do skupiny pojmenované po listu (existující se použije znovu). */
  ImportTasks: (items: ImportedTask[], column: FocusColumn, list?: { id: string; title: string }) => void;
  UpdateTask: (id: string, patch: Partial<Pick<FocusTask, "title" | "description" | "estimateMin">>) => void;
  RemoveTask: (id: string) => void;
  /** Smaže ze sloupce hotové úkoly, nebo s `all` úplně všechny (i skupiny). */
  ClearColumn: (column: FocusColumn, all: boolean) => void;
  /** Šipky na kartě — na konec sousedního sloupce, mimo skupinu. */
  MoveTask: (id: string, column: FocusColumn) => void;
  /** Drag & drop na konkrétní místo. */
  DropTask: (id: string, target: DropTarget) => void;
  ToggleDone: (id: string) => void;
  AddGroup: (column: FocusColumn) => void;
  UpdateGroup: (id: string, patch: Partial<Pick<FocusGroup, "title" | "icon">>) => void;
  /** Smaže skupinu; její úkoly zůstanou ve sloupci jako nezařazené. */
  RemoveGroup: (id: string) => void;
  /** Přesune skupinu i s úkoly do jiného sloupce. */
  MoveGroup: (id: string, column: FocusColumn) => void;
  Start: () => void;
  Pause: () => void;
  /** Označí aktuální úkol jako hotový, časovač jede dál na dalším. */
  CompleteCurrent: () => void;
  /** Odloží aktuální úkol na konec Today a pokračuje dalším. */
  SkipCurrent: () => void;
}

/** Úkoly sloupce v pořadí zobrazení: nezařazené, pak skupiny popořadě.
 * Uvnitř kontejneru rozhoduje pořadí v poli `tasks`. */
export function ColumnTasks(board: Pick<Board, "tasks" | "groups">, column: FocusColumn): FocusTask[] {
  const own = board.tasks.filter((t) => t.column === column);
  const groupIds = board.groups.filter((g) => g.column === column).map((g) => g.id);
  return [
    ...own.filter((t) => !t.groupId || !groupIds.includes(t.groupId)),
    ...groupIds.flatMap((id) => own.filter((t) => t.groupId === id)),
  ];
}

/** Úkol, na kterém se právě dělá — první nehotový v „Today". */
export function CurrentTask(board: Pick<Board, "tasks" | "groups">): FocusTask | undefined {
  return ColumnTasks(board, "today").find((task) => !task.done);
}

/** Odpracované sekundy včetně právě běžícího úseku. */
export function SpentSec(board: Board, task: FocusTask, now = Date.now()): number {
  const running = board.runningSince !== null && CurrentTask(board)?.id === task.id;
  return task.spentSec + (running ? Math.floor((now - board.runningSince!) / 1000) : 0);
}

/** Připíše běžící úsek aktuálnímu úkolu a posune start na `now`. Volá se před
 * každou změnou, která může změnit, co je „aktuální úkol". */
function Settle(board: Board, now = Date.now()): Board {
  if (board.runningSince === null) return board;
  const current = CurrentTask(board);
  return {
    ...board,
    tasks: board.tasks.map((task) =>
      task.id === current?.id ? { ...task, spentSec: SpentSec(board, task, now) } : task,
    ),
    runningSince: current ? now : null,
  };
}

/** Když změna odebrala poslední nehotový úkol v Today, session se zastaví. */
function StopIfEmpty(board: Board): Board {
  return board.runningSince !== null && !CurrentTask(board) ? { ...board, runningSince: null } : board;
}

function NewTask(column: FocusColumn, patch: Partial<FocusTask> = {}): FocusTask {
  return { id: crypto.randomUUID(), title: "New task", column, estimateMin: null, spentSec: 0, done: false, ...patch };
}

export function FormatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}hr` : "", m || !h ? `${m}min` : ""].filter(Boolean).join(" ");
}

export function FormatClock(sec: number): string {
  const sign = sec < 0 ? "-" : "";
  const abs = Math.abs(sec);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}${pad(Math.floor(abs / 3600))}:${pad(Math.floor((abs % 3600) / 60))}:${pad(abs % 60)}`;
}

export const UseFocusStore = create<FocusState>()(
  persist(
    (set) => {
      /** Každá změna, která může posunout „aktuální úkol", jde přes Settle. */
      const change = (fn: (board: Board) => Partial<Board>) =>
        set((state) => {
          const settled = Settle(state);
          return StopIfEmpty({ ...settled, ...fn(settled) });
        });

      return {
        tasks: [],
        groups: [],
        runningSince: null,
        AddTask: (column, groupId) => change((s) => ({ tasks: [...s.tasks, NewTask(column, { groupId })] })),
        ImportTasks: (items, column, list) =>
          change((s) => {
            const existing = new Set(s.tasks.map((t) => t.source?.key));
            const fresh = items.filter((item) => !existing.has(item.source.key) && existing.add(item.source.key));
            let groups = s.groups;
            let group = list && groups.find((g) => g.sourceListId === list.id);
            if (list && !group && fresh.length) {
              group = { id: crypto.randomUUID(), column, title: list.title, sourceListId: list.id };
              groups = [...groups, group];
            }
            const tasks = fresh.map((item) => NewTask(group?.column ?? column, { ...item, groupId: group?.id }));
            return { groups, tasks: [...s.tasks, ...tasks] };
          }),
        UpdateTask: (id, patch) =>
          set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
        RemoveTask: (id) => change((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
        ClearColumn: (column, all) =>
          change((s) => ({
            tasks: s.tasks.filter((t) => t.column !== column || (!all && !t.done)),
            groups: all ? s.groups.filter((g) => g.column !== column) : s.groups,
          })),
        MoveTask: (id, column) =>
          change((s) => {
            const task = s.tasks.find((t) => t.id === id);
            if (!task) return {};
            return { tasks: [...s.tasks.filter((t) => t.id !== id), { ...task, column, groupId: undefined }] };
          }),
        DropTask: (id, { column, groupId, anchorId, after }) =>
          change((s) => {
            const task = s.tasks.find((t) => t.id === id);
            if (!task || id === anchorId) return {};
            const rest = s.tasks.filter((t) => t.id !== id);
            const anchor = anchorId ? rest.findIndex((t) => t.id === anchorId) : -1;
            const at = anchor === -1 ? rest.length : anchor + (after ? 1 : 0);
            rest.splice(at, 0, { ...task, column, groupId });
            return { tasks: rest };
          }),
        ToggleDone: (id) => change((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
        AddGroup: (column) =>
          set((state) => ({ groups: [...state.groups, { id: crypto.randomUUID(), column, title: "New group" }] })),
        UpdateGroup: (id, patch) =>
          set((state) => ({ groups: state.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
        RemoveGroup: (id) =>
          change((s) => ({
            groups: s.groups.filter((g) => g.id !== id),
            tasks: s.tasks.map((t) => (t.groupId === id ? { ...t, groupId: undefined } : t)),
          })),
        MoveGroup: (id, column) =>
          change((s) => {
            const group = s.groups.find((g) => g.id === id);
            if (!group) return {};
            return {
              // Na konec cílového sloupce, ať se neobjeví nad jeho skupinami.
              groups: [...s.groups.filter((g) => g.id !== id), { ...group, column }],
              tasks: s.tasks.map((t) => (t.groupId === id ? { ...t, column } : t)),
            };
          }),
        Start: () => set((state) => (CurrentTask(state) ? { runningSince: state.runningSince ?? Date.now() } : {})),
        Pause: () => set((state) => ({ ...Settle(state), runningSince: null })),
        CompleteCurrent: () =>
          change((s) => {
            const current = CurrentTask(s);
            return { tasks: s.tasks.map((t) => (t.id === current?.id ? { ...t, done: true } : t)) };
          }),
        SkipCurrent: () =>
          change((s) => {
            const today = ColumnTasks(s, "today");
            const current = CurrentTask(s);
            const last = today[today.length - 1];
            if (!current || last.id === current.id) return {};
            const rest = s.tasks.filter((t) => t.id !== current.id);
            rest.splice(rest.findIndex((t) => t.id === last.id) + 1, 0, { ...current, groupId: last.groupId });
            return { tasks: rest };
          }),
      };
    },
    {
      name: "lockin-focus",
      storage: createJSONStorage(() => CreatePersistStorage("focus.json")),
      skipHydration: true,
      // Starší uložený stav skupiny nemá.
      merge: (persisted, current) => {
        const saved = persisted as Partial<FocusState> | undefined;
        return { ...current, ...saved, groups: saved?.groups ?? current.groups };
      },
    },
  ),
);
