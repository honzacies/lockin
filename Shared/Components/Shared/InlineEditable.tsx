"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Input, TextArea } from "@heroui/react";

/** Shared by TodoListView.tsx, ColorPaletteView.tsx, and ScenarioView.tsx —
 * click-to-edit text that renders as a plain span until clicked, then swaps
 * to an Input/TextArea. */
export function InlineEditable({
  value,
  onCommit,
  placeholder,
  className,
  multiline,
  style,
  seamless,
  seamlessBackground,
  seamlessRadius,
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  style?: CSSProperties;
  /** No border/background while editing — the field should look like plain
   * text the whole time, not visibly "become an input" on click. */
  seamless?: boolean;
  /** Only meaningful with `seamless` — overrides the (default: none)
   * background/radius the reset above would otherwise force, so a field
   * that shows its own background pill in display mode (e.g. a Scenario
   * beat's time badge) can keep that same pill while editing too, instead
   * of visibly losing it the moment you click in. */
  seamlessBackground?: string;
  seamlessRadius?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // HeroUI's TextArea isn't `forwardRef`-wrapped (it spreads props onto the
  // real react-aria TextArea underneath, but a `ref` passed to a plain
  // function component never reaches that far) — so getting the actual DOM
  // node to measure/resize means finding it ourselves via its `data-slot`,
  // through a wrapping element's own ref instead.
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-grows a multiline field's height to fit everything typed so far —
  // resetting to "auto" first is what lets scrollHeight shrink back down
  // too (measuring against the *previous* height would only ever grow).
  useEffect(() => {
    if (!multiline) return;
    const el = containerRef.current?.querySelector<HTMLTextAreaElement>('[data-slot="textarea"]');
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [multiline, draft]);

  if (editing) {
    // HeroUI's own focus styling (a `box-shadow` ring + `background-color`
    // swap, set on `[data-slot=input]:focus`) outranks a plain Tailwind
    // class by CSS specificity alone (attribute+pseudo-class beats a lone
    // class), so neither this nor `seamless` below can be done as a
    // className override — only an inline style, which always wins
    // regardless of the other rule's specificity, actually zeroes it out.
    // The ring is dropped unconditionally (every InlineEditable input, not
    // just seamless ones) — border/background stay for a non-seamless field
    // so it still visibly "becomes an input," just without HeroUI's shadow.
    const seamlessStyle: CSSProperties = {
      boxShadow: "none",
      ...(seamless
        ? {
            background: seamlessBackground ?? "transparent",
            border: "none",
            borderRadius: seamlessRadius ?? 0,
            outline: "none",
          }
        : {}),
    };
    const commonProps = {
      autoFocus: true,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: () => {
        setEditing(false);
        const trimmed = draft.trim();
        if (trimmed !== value) onCommit(trimmed);
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !multiline) e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      },
      className: `select-text outline-none shadow-none ${
        seamless ? "p-0" : "rounded border border-[#d9d9d9] bg-white px-1 py-0.5 focus:border-[#0485f7]"
      } ${multiline ? "w-full resize-none overflow-hidden" : ""} ${className ?? ""}`,
      // Sized in `ch` off the draft's own length (not a fixed/flex width) so
      // the field visibly grows with every keystroke — the whole point
      // being "you always see everything you've typed," never a scrollable
      // clipped window into a fixed-width box. Multiline grows in height
      // instead (see the effect above), so it keeps a normal flexible width.
      style: multiline
        ? ({
            ...style,
            ...seamlessStyle,
            // Native content-driven sizing (Chromium 123+, so it's covered
            // by Tauri's WebView2) — the imperative scrollHeight measuring
            // in the effect above is a fallback for anything older, but
            // this is what actually does the growing wherever it's
            // supported, no measuring/reflow required.
            fieldSizing: "content",
          } as CSSProperties)
        : { ...style, ...seamlessStyle, width: `${Math.max(draft.length, placeholder?.length ?? 1) + 1}ch` },
    };
    return multiline ? (
      <div ref={containerRef}>
        <TextArea rows={1} {...commonProps} />
      </div>
    ) : (
      <Input {...commonProps} />
    );
  }

  // An unset field (no preset value) stays fully invisible — not just its
  // placeholder text, but any background/padding chrome the caller passed
  // in too (e.g. a beat's time pill) — until the nearest ancestor `group`
  // (each of TodoListView/ColorPaletteView/ScenarioView's own root) is
  // hovered, at which point the whole thing fades in as a hint that the
  // field can be filled in. A field that already has a value is always
  // shown normally, hover or not.
  const isEmpty = !value;

  return (
    <span
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      data-block-drag-ignore="true"
      // A plain <span> defaults to `white-space: normal`, which collapses
      // blank lines/runs of spaces — fine for a single-line field, but for
      // a multiline one it meant paragraph breaks only survived while the
      // textarea was actually focused, then flattened back to one run the
      // moment you clicked away. `pre-wrap` keeps them, matching what a
      // textarea already preserves natively while editing.
      //
      // `hidden` (display:none) rather than an opacity fade for an empty
      // field — opacity still reserves the placeholder text's own layout
      // width/height, which for a field sitting next to other content (a
      // beat's time pill before its title) showed up as a permanent gap
      // even while fully invisible. display:none removes it from layout
      // entirely; `group-hover:inline`/`:block` puts it back the instant
      // the card is hovered, no reserved space either way.
      className={`cursor-text rounded px-0.5 hover:bg-black/[0.03] ${
        multiline ? "whitespace-pre-wrap" : ""
      } ${isEmpty ? `hidden ${multiline ? "group-hover:block" : "group-hover:inline"}` : ""} ${className ?? ""}`}
      style={style}
    >
      {value || <span className="text-[#c9c8c4]">{placeholder}</span>}
    </span>
  );
}
