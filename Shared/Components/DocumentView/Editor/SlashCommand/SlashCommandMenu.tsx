import {
  forwardRef,
  Fragment,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { ListChecks, Palette, Pencil } from "lucide-react";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import type { SlashCommandItem } from "./SlashCommandItems";

export interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuHandle,
  SlashCommandMenuProps
>(function SlashCommandMenu({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  function SelectItem(index: number) {
    const item = items[index];
    if (item) command(item);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((index) => (index + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        SelectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-56 rounded-xl border border-[var(--lk-line)] bg-white p-3 text-sm text-[var(--lk-muted)] shadow-lg">
        No matching blocks
      </div>
    );
  }

  const activeItem = items[selectedIndex] ?? items[0];

  return (
    <div className="flex items-start gap-1.5">
      <div className="flex w-52 flex-col gap-px rounded-xl border border-[var(--lk-line)] bg-white p-1 shadow-lg">
        {items.map((item, index) => {
          const showHeader =
            index === 0 || items[index - 1]?.group !== item.group;
          return (
            <Fragment key={item.title}>
              {showHeader ? (
                <div
                  className={`px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--lk-subtle)] ${index === 0 ? "pt-1" : "pt-2.5"
                    }`}
                  style={{ fontFamily: "Inter, system-ui, sans-serif" }}
                >
                  {item.group}
                </div>
              ) : null}
              <div
                onMouseEnter={() => setSelectedIndex(index)}
                className={`group flex items-center rounded-md ${index === selectedIndex ? "bg-black/[0.04]" : ""
                  }`}
              >
                <button
                  type="button"
                  onClick={() => SelectItem(index)}
                  className="flex flex-1 items-center gap-2.5 px-2 py-1 text-left"
                >
                  {typeof item.icon === "string" ? (
                    <div dangerouslySetInnerHTML={{ __html: item.icon }} />
                  ) : (
                    <item.icon
                      size={15}
                      strokeWidth={1.75}
                      className="shrink-0 text-[var(--lk-text2)]"
                    />
                  )}
                  <span className="text-[13px] font-medium text-[var(--lk-ink)]">
                    {item.title}
                  </span>
                </button>
                {item.blockType ? (
                  <button
                    type="button"
                    title="Style this block"
                    aria-label={`Style ${item.title}`}
                    onMouseDown={(e) => {
                      // Keep the editor focused so this menu stays mounted while
                      // the modal (rendered in the app tree) opens on top.
                      e.preventDefault();
                      e.stopPropagation();
                      UseUiStore.getState().OpenStyleEditor(item.blockType!);
                    }}
                    className={`mr-1 shrink-0 rounded p-1 text-[var(--lk-muted)] transition-opacity hover:bg-black/[0.06] hover:text-[var(--lk-ink)] group-hover:opacity-100 ${index === selectedIndex ? "opacity-100" : "opacity-0"
                      }`}
                  >
                    <Pencil size={13} strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>

      {activeItem ? (
        <div className="flex w-60 flex-col gap-2.5 rounded-xl border border-[var(--lk-line)] bg-white p-3 shadow-lg">
          <div>
            <div className="text-[13px] font-medium text-[var(--lk-ink)]">
              {activeItem.title}
            </div>
            <div className="mt-0.5 text-xs text-[var(--lk-muted)]">
              {activeItem.description}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--lk-line)] bg-[var(--lk-panel)] px-3 py-2.5">
            <BlockPreview title={activeItem.title} />
          </div>
        </div>
      ) : null}
    </div>
  );
});

function BlockPreview({ title }: { title: string }): ReactNode {
  switch (title) {
    case "Heading 1":
      return (
        <div className="text-lg font-bold leading-tight text-[var(--lk-ink)]">
          Big heading
        </div>
      );
    case "Heading 2":
      return (
        <div className="text-base font-semibold leading-tight text-[var(--lk-ink)]">
          Medium heading
        </div>
      );
    case "Heading 3":
      return (
        <div className="text-sm font-semibold leading-tight text-[var(--lk-ink)]">
          Small heading
        </div>
      );
    case "Link":
      return (
        <p className="text-[13px] leading-relaxed text-[var(--lk-ink)]">
          Visit the{" "}
          <span className="text-[#3b7cff] underline decoration-[#3b7cff]/40 underline-offset-2">
            documentation
          </span>{" "}
          for more.
        </p>
      );
    case "Bulleted list":
      return (
        <ul className="space-y-1 text-[13px] text-[var(--lk-ink)]">
          {["First item", "Second item"].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-[var(--lk-muted)]">•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      );
    case "Dashed list":
      return (
        <ul className="space-y-1 text-[13px] text-[var(--lk-ink)]">
          {["First item", "Second item"].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-[var(--lk-muted)]">–</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      );
    case "Numbered list":
      return (
        <ol className="space-y-1 text-[13px] text-[var(--lk-ink)]">
          {["First item", "Second item"].map((t, i) => (
            <li key={t} className="flex gap-2">
              <span className="text-[var(--lk-muted)]">{i + 1}.</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      );
    case "To-do list":
      return (
        <div className="flex flex-col gap-2 text-[13px] text-[var(--lk-ink)]">
          <div className="flex items-center gap-1.5 font-medium">
            <ListChecks size={14} strokeWidth={1.5} className="text-[var(--lk-text2)]" />
            My To-Do List
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-start gap-2">
              <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-[4px] bg-[#0485f7] text-[8px] text-[#fff]">
                ✓
              </span>
              <span className="text-[var(--lk-muted)] line-through">Rebrand the hero page</span>
            </label>
            <label className="flex items-start gap-2">
              <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border border-[var(--lk-faint)] bg-white" />
              <span>Ship the changes</span>
            </label>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--lk-gray)]">
                <div className="h-full w-1/2 rounded-full bg-[#eab308]" />
              </div>
              <span className="text-[10px] text-[var(--lk-muted)]">1/2</span>
            </div>
            <span className="rounded-md bg-[var(--lk-line)] px-1.5 py-0.5 text-[10px] text-[var(--lk-text2)]">
              Today, 18:00
            </span>
          </div>
        </div>
      );
    case "Color Palette":
      return (
        <div className="flex flex-col gap-2 text-[13px] text-[var(--lk-ink)]">
          <div className="flex items-center gap-1.5 font-medium">
            <Palette size={14} strokeWidth={1.5} className="text-[var(--lk-text2)]" />
            Primary colors
          </div>
          <div className="flex gap-1.5">
            <div className="h-10 w-12 rounded-lg" style={{ background: "#00bfb6" }} />
            <div className="h-10 w-12 rounded-lg" style={{ background: "#006a65" }} />
          </div>
        </div>
      );
    case "Table":
      return (
        <table className="w-full border-collapse text-[12px] text-[var(--lk-ink)]">
          <thead>
            <tr>
              {["Name", "Status"].map((h) => (
                <th
                  key={h}
                  className="border border-[var(--lk-line)] bg-[var(--lk-panel)] px-2 py-1 text-left font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Landing page", "Done"],
              ["Rezervace", "In progress"],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((cell) => (
                  <td key={cell} className="border border-[var(--lk-line)] px-2 py-1">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "Quote":
      return (
        <div className="border-l-2 border-[var(--lk-line2)] pl-3 text-[13px] italic text-[var(--lk-text2)]">
          A quote worth remembering.
        </div>
      );
    case "Code block":
      return (
        <pre className="overflow-hidden font-mono text-xs leading-relaxed text-[var(--lk-ink)]">
          <span className="text-[var(--lk-muted)]">const</span> answer = 42;
        </pre>
      );
    case "Divider":
      return (
        <div className="flex flex-col gap-2 py-1">
          <div className="h-px w-1/2 rounded bg-[var(--lk-line2)]" />
          <div className="h-px rounded bg-[var(--lk-ink)]/70" />
          <div className="h-px w-2/3 rounded bg-[var(--lk-line2)]" />
        </div>
      );
    default:
      return (
        <p className="text-[13px] leading-relaxed text-[var(--lk-ink)]">
          The quick brown fox jumps over the lazy dog.
        </p>
      );
  }
}
