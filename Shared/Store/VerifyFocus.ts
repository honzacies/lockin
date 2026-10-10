// Ověření logiky To-do režimu (časovač, import): `bun Shared/Store/VerifyFocus.ts`
import { CurrentTask, SpentSec, UseFocusStore } from "./UseFocusStore";
import { CollectTodoSources } from "../Lib/CollectTodoSources";

function Check(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const s = UseFocusStore.getState;
s().AddTask("today");
s().AddTask("today");
const [a, b] = s().tasks;
s().Start();
UseFocusStore.setState({ runningSince: Date.now() - 90_000 });
s().Start();
s().CompleteCurrent();
Check(s().tasks.find((t) => t.id === a.id)?.spentSec === 90, "odpracovaný čas se připíše dokončenému úkolu");
Check(CurrentTask(s())?.id === b.id, "po dokončení je aktuální další úkol");
Check(s().runningSince !== null, "časovač běží dál na dalším úkolu");
s().Pause();
Check(SpentSec(s(), s().tasks[1]) < 2, "pauza zastaví přičítání");
s().CompleteCurrent();
Check(s().runningSince === null, "po posledním úkolu se session zastaví");
const source = { key: "list:task", label: "Doc", href: "/" };
s().ImportTasks([{ title: "A", source }, { title: "A", source }], "backlog");
s().ImportTasks([{ title: "A", source }], "backlog");
Check(s().tasks.filter((t) => t.source?.key === "list:task").length === 1, "import nepřidá duplicitu");
const task = (id: string, done = false) => ({ id, title: id, description: "", done });
const list = { id: "L", title: "Launch", deadline: null, deadlineTime: null, style: {} as never,
  tasks: [task("a"), task("b", true)], groups: [{ id: "g", title: "G", tasks: [task("c")] }] };
const doc = { id: "D", projectId: null, name: "Plan", text: { json: { type: "doc", content: [
  { type: "paragraph" }, { type: "richTodoList", attrs: { config: list } }] } } } as never;
const [found] = CollectTodoSources([], [doc], {});
Check(found?.label === "Plan" && found.href === "/Document?id=D", "najde list v dokumentu");
Check(found.tasks.map((t) => t.id).join() === "a,c", "bere nehotové úkoly včetně skupin");
UseFocusStore.setState({ tasks: [], runningSince: null });
s().AddTask("today");
s().AddTask("today");
s().ToggleDone(s().tasks[0].id);
s().ClearColumn("today", false);
Check(s().tasks.length === 1 && !s().tasks[0].done, "clear done nechá nehotové");
s().ClearColumn("today", true);
Check(s().tasks.length === 0, "clear all smaže vše");
// Drag & drop a skupiny
UseFocusStore.setState({ tasks: [], groups: [], runningSince: null });
s().AddTask("today");
s().AddTask("today");
s().AddGroup("today");
const [x, y] = s().tasks;
const g = s().groups[0];
s().DropTask(y.id, { column: "today", anchorId: x.id, after: false });
Check(CurrentTask(s())?.id === y.id, "drop před jiný úkol změní pořadí");
s().DropTask(y.id, { column: "today", groupId: g.id, anchorId: null, after: false });
Check(CurrentTask(s())?.id === x.id, "nezařazené úkoly jdou před skupinami");
s().MoveGroup(g.id, "week");
Check(s().tasks.find((t) => t.id === y.id)?.column === "week", "skupina se přesune i s úkoly");
s().RemoveGroup(g.id);
Check(s().tasks.find((t) => t.id === y.id)?.groupId === undefined, "smazaná skupina úkoly nezahodí");
s().ImportTasks([{ title: "I", source: { key: "L2:t", label: "D", href: "/" } }], "backlog", { id: "L2", title: "List" });
Check(s().groups.some((gr) => gr.title === "List" && gr.sourceListId === "L2"), "import listu založí skupinu");
UseFocusStore.setState({ tasks: [], groups: [], runningSince: null });
s().AddTask("today");
s().AddTask("today");
const first = s().tasks[0].id;
s().SkipCurrent();
Check(CurrentTask(s())?.id !== first && ColumnTasksLast() === first, "skip odloží úkol na konec");
console.log("OK");

function ColumnTasksLast() {
  const today = s().tasks.filter((t) => t.column === "today");
  return today[today.length - 1].id;
}

// ▶ Start session u listu: jeho otevřené úkoly jdou na začátek Today a session začne jimi.
{
  const { StartListSession } = await import("../Lib/TodoActions");
  UseFocusStore.setState({ tasks: [], groups: [], runningSince: null });
  s().AddTask("today"); // cizí úkol, který v Today už byl
  const other = s().tasks[0].id;
  const src = { listId: "L2", title: "Launch", label: "Doc", href: "/", tasks: [
    { id: "a", title: "A", description: "", done: false },
    { id: "b", title: "B", description: "", done: true },
    { id: "c", title: "C", description: "", done: false },
  ] };
  s().ImportTasks([{ title: "C", source: { key: "L2:c", label: "Doc", href: "/" } }], "backlog", { id: "L2", title: "Launch" });
  Check(StartListSession(src), "session se spustí");
  Check(CurrentTask(s())?.source?.key === "L2:a", "session začíná prvním otevřeným úkolem listu");
  Check(s().tasks.filter((t) => t.source?.key?.startsWith("L2:")).every((t) => t.column === "today"), "i úkol z Backlogu se přesune do Today");
  Check(!s().tasks.some((t) => t.source?.key === "L2:b"), "hotový úkol se nepřidá");
  Check(!s().groups.some((g) => g.sourceListId === "L2"), "prázdná skupina listu zmizí");
  Check(s().tasks.some((t) => t.id === other) && s().runningSince !== null, "cizí úkol zůstal, časovač běží");
  Check(!StartListSession({ ...src, tasks: [src.tasks[1]] }), "list bez otevřených úkolů session nespustí");
  console.log("StartListSession OK");
}
