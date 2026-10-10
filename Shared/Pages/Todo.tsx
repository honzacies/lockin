"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { ListTodo, Monitor, Play } from "@lockin/shared/Components/Shared/UiIcons";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { TodoSearch } from "@lockin/shared/Components/Focus/TodoSearch";
import { TodoTabs } from "@lockin/shared/Components/Focus/TodoTabs";
import { FocusBoard, FocusDragProvider } from "@lockin/shared/Components/Focus/FocusBoard";
import { SessionView } from "@lockin/shared/Components/Focus/SessionView";
import { DocumentPreview } from "@lockin/shared/Components/Focus/DocumentPreview";
import { CurrentTask, UseFocusStore } from "@lockin/shared/Store/UseFocusStore";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { GetPlatform } from "@lockin/shared/Platform/Platform";
import { UseSettingsStore } from "@lockin/shared/Store/UseSettingsStore";

export default function TodoPage() {
  const openTab = UseUiStore((state) => state.OpenTab);
  const win = GetPlatform().window;
  const [monitors, setMonitors] = useState<string[]>([]);
  const sessionMonitor = UseSettingsStore((s) => s.sessionMonitor);
  const primaryMonitor = Math.max(0, monitors.findIndex((name) => name.includes("(primary)")));
  // Jen web: session se tam ukazuje jako karta na stránce, ne jako okno.
  // Session spuštěná odjinud (▶ u listu na Home) se tu rovnou ukáže.
  const [webSessionOpen, setWebSessionOpen] = useState(() => !win.isAvailable && UseFocusStore.getState().runningSince !== null);

  useEffect(() => {
    openTab({ id: "todo", title: "To-do", href: "/Todo/Board" });
    win.ListMonitors().then(setMonitors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function StartSession(monitorIndex = 0) {
    UseFocusStore.getState().Start();
    if (win.isAvailable) win.OpenSessionWindow(monitorIndex).catch((error: unknown) => console.warn("OpenSessionWindow failed", error));
    else setWebSessionOpen(true);
  }

  return (
    <FocusDragProvider>
    <div className="flex h-full">
    <div className="h-full min-w-0 flex-1 overflow-y-auto px-[50px] pb-16 pt-8">
      <div className="mb-8 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <ListTodo size={56} strokeWidth={1.5} className="text-black" />
          <p className="select-none text-[40px] font-medium tracking-[-0.8px] text-black">To-do</p>
        </div>
        <p className="select-none text-[20px] leading-[32px] text-[var(--lk-text2)]">
          Plan what matters, pull it into today, then lock in.
        </p>
        <TodoTabs />
        <TodoSearch />
      </div>

      <div className="flex items-start gap-4">
        <FocusBoard
          todayFooter={
            monitors.length > 1 && sessionMonitor === "ask" ? (
                <Popover
                  side="top"
                  panelClassName="w-52 p-1"
                  trigger={() => <StartButton />}
                >
                  {(close) => (
                    <div className="flex flex-col gap-px">
                      <ContextMenuLabel first>Open session on</ContextMenuLabel>
                      {monitors.map((name, i) => (
                        <ContextMenuItem
                          key={name}
                          icon={<Monitor size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />}
                          onClick={() => {
                            StartSession(i);
                            close();
                          }}
                        >
                          {name}
                        </ContextMenuItem>
                      ))}
                    </div>
                  )}
                </Popover>
              ) : (
                <StartButton onPress={() => StartSession(primaryMonitor)} />
              )
          }
        />

        {webSessionOpen && (
          <div className="w-[320px] shrink-0 overflow-hidden rounded-xl border border-[var(--lk-line)]">
            <SessionView
              onClose={() => {
                UseFocusStore.getState().Pause();
                setWebSessionOpen(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
    {/* Dokument otevřený ze sidebaru — jen pro čtení. */}
    <DocumentPreview />
    </div>
    </FocusDragProvider>
  );
}

function StartButton({ onPress }: { onPress?: () => void }) {
  const hasTask = UseFocusStore((state) => CurrentTask(state) !== undefined);
  return (
    <Button
      onPress={onPress}
      isDisabled={!hasTask}
      className="h-9 w-full gap-1.5 rounded-lg bg-[#0088ff] text-sm font-medium text-[#fff] hover:bg-[#0077e0]"
    >
      <Play size={15} />
      Start session
    </Button>
  );
}
