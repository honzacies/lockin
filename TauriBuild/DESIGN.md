# Compact menu style

The reference implementation is the slash-command block-type menu
([Components/DocumentView/Editor/SlashCommand/SlashCommandMenu.tsx](Components/DocumentView/Editor/SlashCommand/SlashCommandMenu.tsx)).
This is the preferred look for any small floating menu in the app (context
menus, dropdowns, command palettes) — prefer it over a plain flat list of
items.

## What makes it read as "compact" and not just "small"

- **Grouped with tiny uppercase section labels**, not a flat list. Each
  group gets a heading: `text-[10px] font-semibold uppercase tracking-wider
  text-[#a5a49f]`, `px-2 pb-1`, `pt-2.5` above every group except the first
  (`pt-1`). The label text itself is content-defined (`TEXT`, `STYLING`,
  `LIST`, ...) — group items by what they *are*, not just alphabetically.
- **Every row pairs a small icon with the label** — never label-only, never
  icon-only. Icon: `size={15}` (or 13–16 depending on density),
  `strokeWidth={1.75}`, `text-[#5f5e59]`. Label: `text-[13px] font-medium
  text-[#2c2c2b]`. Gap between icon and label: `gap-2.5`.
- **Tight row padding**: `px-2 py-1` on the clickable button, `rounded-md`
  hover/active state — not the airier `px-2.5 py-1.5` used elsewhere.
  Rows sit in a `flex flex-col gap-px` stack (a hairline gap, not a real
  gap) so grouped rows read as one dense block.
- **Selection/hover state lives on a wrapper div around the button**, not
  the button itself (`bg-black/[0.04]` on `.group`), so a secondary
  per-row action (see below) can share the same highlighted background
  without being part of the same clickable button.
- **Panel chrome**: `rounded-xl border border-[#f0efed] bg-white p-1
  shadow-lg`, fixed width (`w-52`/`w-56` — pick a width, don't let it
  reflow per-item). `p-1` on the panel, not `p-2` — the row padding is
  what creates breathing room, the panel padding should be minimal.
- **Optional per-row secondary action**, revealed on hover/selection only
  (`opacity-0 group-hover:opacity-100`, forced `opacity-100` when the row
  is keyboard-selected) — e.g. the pencil "style this block" icon button
  that sits at the row's trailing edge without stealing the row's main
  click target.
- **Optional side preview panel** for menus where a live preview earns its
  keep (block-type picker shows a rendered example of the selected item) —
  own `rounded-xl border ... shadow-lg` panel, `gap-1.5` away from the main
  list, title (`text-[13px] font-medium`) + description
  (`mt-0.5 text-xs text-[#91918e]`) + a bordered preview swatch
  (`rounded-lg border border-[#f0efed] bg-[#f9f8f7] px-3 py-2.5`). Not
  needed for a plain action menu (rename/delete/etc.) — reserve it for
  pickers where seeing the option helps before committing.

## `ContextMenu`/`ContextMenuItem` already matches this

[Components/Shared/ContextMenu.tsx](Components/Shared/ContextMenu.tsx)
(the Sidebar's right-click menus, the project document pills' menu) has been
reconciled to this style: `w-52` panel, `gap-px` row stacking,
`ContextMenuLabel` for the tiny uppercase group headers, `ContextMenuItem`
rows at `px-2 py-1`/`gap-2.5` with the hover state on a wrapper div. Use it
as-is for any new right-click menu rather than hand-rolling another one.

# Use HeroUI v3 primitives, not native elements

The app has `@heroui/react` (v3) installed — `Button`, `Input`, `TextArea`,
`Checkbox`, `Menu`, `Popover`, `Dropdown`, `Tooltip`, `Modal`, `Select`,
`Tabs`, and more (see `node_modules/@heroui/react/dist/components` for the
full list). As of this pass, the whole app has been switched from
hand-styled native `<button>`/`<input>`/`<textarea>` (Tailwind classes
chosen to *look* like a real component) to the actual HeroUI components —
use `Button`/`Input`/`TextArea`/`Checkbox` for any new control rather than
reaching for a native element.

**`className` overrides reliably beat HeroUI's own defaults** — verified
directly (not assumed): HeroUI's component CSS ships in a `components`
Tailwind cascade layer, and Tailwind's own generated utility classes (i.e.
anything in a `className` you write) live in the `utilities` layer, which
is declared *after* `components` — so a plain `className="h-7 w-7
rounded-md p-0.5"` on a HeroUI `Button` wins over its default `h-9/h-10
rounded-3xl` sizing with zero `!important` needed. This holds for `Button`,
`Input`, and `Checkbox`'s `Control`/`Indicator` parts. (This directly
contradicts an earlier, apparently stale note about "unlayered HeroUI CSS
always winning" — that isn't how `@heroui/styles` is actually structured
today; trust a fresh check over an old assumption if this ever seems to
regress.) Practical pattern used throughout: `variant="ghost"` (or another
variant matching the intended look) plus `h-auto`/explicit `h-*`/`w-*` to
drop HeroUI's fixed height scale, `font-normal` when the original text
wasn't meant to be bold (`Button`'s default is `font-medium`), and
`isIconOnly` + `aria-label` for icon-only triggers instead of visible text.

**Two gotchas hit during the conversion, worth knowing up front:**
- `Button` doesn't accept a plain `title` attribute (its prop type is
  narrower than a native `<button>`) — use `aria-label` instead, which every
  icon-only button needs anyway.
- Never nest a real `<button>` inside another `<button>` (invalid HTML,
  and it silently breaks click handling) — react-aria's `Button` renders a
  genuine `<button>` under the hood same as a native one. Where an old
  native version nested one (e.g. `TabStrip.tsx`'s per-tab close "×" used to
  be a `<span role="button">` inside the tab's own `<button>` specifically
  to dodge this), restructure into sibling `Button`s inside a shared
  wrapper `<div>` instead of trying to preserve the nesting.

**Where a native element is still the right call**, because the
interaction itself is custom, not just the styling:
- The slash-command menu and `ContextMenu`/`ContextMenuItem` — bespoke
  compact menu system (see above), not a dropdown/select in the HeroUI
  sense.
- Anything driven by `BlockSelectionExtension.ts`'s pointer-event/drag
  machinery (marquee, block move, drag preview) — these need raw DOM
  elements it creates and positions itself outside React's render cycle.
- `ColorPicker.tsx`'s hue `<input type="range">` — a hand-built HSV picker
  with a custom gradient track; HeroUI's `Slider` has a different value
  model and no easy way to paint that gradient, not worth the rework for a
  single control.
- `IconPicker.tsx`'s hidden `<input type="file">` — no visible chrome to
  restyle (triggered programmatically), and HeroUI has no file-input
  equivalent.
- `contentEditable` elements (`NotesList.tsx`'s heading/body,
  `TodoListView.tsx`'s `InlineEditable` display state) — not form controls
  at all.
