# LockIn design guidelines

How LockIn looks and why. Read this before you add or restyle a component, and keep it up to
date when a pattern changes. All paths are relative to the repo root. Last full review: 2026-10-10.

The one rule above all others: **one pattern per job.** When three components solve the same
problem three different ways, the app stops feeling like one app. Before you build something,
look for the shared component below and use it.

## 1. Colors and themes

LockIn has a light and a dark theme (Settings → Appearance, or follow the system). Every color
comes from tokens in [Shared/Styles/globals.css](Shared/Styles/globals.css):

| Token | Use |
| --- | --- |
| `--lk-bg` / `--lk-fg` | Page background / strongest text |
| `--lk-ink` | Normal text |
| `--lk-text2` | Secondary text, icons in menus |
| `--lk-muted`, `--lk-subtle`, `--lk-faint` | Hints, placeholders, disabled, tiny labels |
| `--lk-line`, `--lk-line2` | Borders and dividers (line2 is stronger) |
| `--lk-panel`, `--lk-raised`, `--lk-nav`, `--lk-pill` | Surfaces: side panels, cards, sidebar, pills |

- Tailwind's `white` and `black` are remapped to `--lk-bg` / `--lk-fg`, so `bg-white`,
  `text-black` and `bg-black/[0.04]` all flip with the theme. Use them freely.
- For a color that must **not** flip (white text on a blue button), write `#fff` / `#000`.
- **Never hardcode a light hex** such as `#f4f8fe` or `#fdf4f4`. In dark mode it becomes a bright
  patch with unreadable text. Tint with the accent instead: `bg-[#0088ff]/[0.06]`,
  `bg-[#e5484d]/[0.06]`.
- Accent colors (the same in both themes): blue `#0088ff` (hover `#0077e0`), red `#e5484d`,
  green `#30a46c`, amber `#e5a000` (favorite star).
- `THEME_BOOT_SCRIPT` ([Shared/Lib/ThemeBoot.ts](Shared/Lib/ThemeBoot.ts)) sets the theme before
  the first paint, so dark mode never flashes white.

## 2. Type scale

| Where | Classes |
| --- | --- |
| Page and document title | `text-[40px] font-medium tracking-[-0.8px]` |
| Panel title (preview, graph, palette) | `text-[24px] font-medium tracking-[-0.48px]` |
| Body | `text-[16px]` (small-text mode `text-[14px]`) |
| Menus and rows | `text-[13px] font-medium` |
| Pills and chips | `text-xs font-medium` |
| Section label | `text-[10px] font-semibold uppercase tracking-wider text-[var(--lk-subtle)]` |

Titles are a `textarea` with `[field-sizing:content]` and `overflow-hidden`, so a long name
wraps and never shows a scrollbar.

## 3. Pills and chips

- **Meta pills** above a title ("Updated …", "Deadline …"): `UpdatedPill` and `DeadlinePill` in
  [Shared/Components/Shared/MetaPills.tsx](Shared/Components/Shared/MetaPills.tsx). Documents and
  projects use the same ones in the same order. The label is **Updated**, never "Last edited".
- **Value chips** (tags, priority, status) share one size, `PILL_CLASS` in
  [PriorityStatusPicker.tsx](Shared/Components/Shared/PriorityStatusPicker.tsx). Priority and
  status render as `OptionPill`: a filled color, a 14px icon and a chevron when clickable.

## 4. Pickers and menus

Every "choose one or more" control is a **compact menu**: a trigger, then a
[Popover](Shared/Components/Shared/Popover.tsx) with rows.

- Header: `PickerHeader`, a tiny uppercase title ("YOUR TAGS", "YOUR PRIORITIES", "YOUR STATUSES").
  If the options are managed somewhere else, put a mini cog (`ManageOptionsButton`) on the right
  that opens that Settings section.
- Rows: `ContextMenuItem` from [ContextMenu.tsx](Shared/Components/Shared/ContextMenu.tsx), an icon
  or color dot plus a label. `selected` adds the blue check on the right.
- Panel chrome: `rounded-xl border border-[var(--lk-line)] bg-white p-1 shadow-xl`, fixed width
  (`w-52` / `w-56`).
- Floating panels never leave the window. `Popover` is `position: fixed`, opens on the side with
  more room, slides inward horizontally and scrolls inside itself when it's taller than the space.
  `ContextMenu` clamps to the window the same way. Don't hand-roll an `absolute` dropdown.
- Tags can be created right in the picker ("New tag…" input at the bottom).
- Status and priority rows use `OptionIcon`: the option's icon in its color, or an empty
  16px slot when it has none, so labels always line up.
- Library filters: each group is a chip plus a chevron. Only the chip gets the active
  background, never the chevron, so there is a single layer of color. Panels: "Available
  folders", "Your tags" (same as in a project), "Available statuses" + "Available priorities".
- Defaults for new users: priorities Low (green, arrow down), Medium (amber, line), High (red,
  arrow up); statuses Not Started (grey circle), In Progress (blue spinner), Done (green check).
  A migration upgrades only options the user never changed.
- Priorities and statuses can be reordered by dragging the grip in Settings.
- Settings uses the same pattern for its selects (`Select` in
  [SettingsDialog.tsx](Shared/Components/Settings/SettingsDialog.tsx)). Don't introduce a
  different-looking dropdown.

### Compact menu details (right-click menus, slash menu)

The reference is the slash menu
([SlashCommandMenu.tsx](Shared/Components/DocumentView/Editor/SlashCommand/SlashCommandMenu.tsx)).

- Group rows under `ContextMenuLabel` headers (`pt-1` for the first group, `pt-2.5` for the rest).
- Every row has a small icon (`size 14–15`, `strokeWidth 1.75`, `text-[var(--lk-text2)]`) and a
  label. Use `gap-2.5`, rows `px-2 py-1`, stack `flex flex-col gap-px`.
- The hover state lives on a wrapper div, so a row can grow a trailing secondary action.
- Right-click menus use `ContextMenu` as is. While a menu is open the page under it doesn't
  scroll, and the editor's bubble toolbar stays hidden.

## 4b. Project properties

- One field system for the project header (later also the Your Projects table, filters and
  templates). Built-in fields (tags, priority, status, progress, deadline) plus the workspace's
  own fields ([UseFieldStore](Shared/Store/UseFieldStore.ts), values in `project.fields`).
- The header looks exactly as before until you use something new. The properties button (sliders
  icon) only appears on hover at the end of the field row.
- Properties panel: check a field to show or hide it (the value is kept). Reorder by dragging the
  grip, and only there, so nothing gets reordered by accident in the header itself.
- **Left click** on a custom field pill edits the value. Select and multi-select show the
  options panel ("Available …"), date shows the calendar, text / number / link show an input.
  A checkbox toggles right in the pill.
- **Right click** opens the field settings: icon (the type icon when there is no custom one) and
  name, Type chips, the value, then Delete (removes the field from this project) on the left
  and Clear / Save on the right. Everything is a draft until Save. Name, icon and type apply to
  all projects, and a type change converts their values too
  ([ConvertValue](Shared/Lib/ProjectFields.ts)). `Popover` supports this with
  `contextChildren`.
- Dates use the same HeroUI calendar as the deadline (`DateCalendar`).
- Zustand selectors must return stable references. `s.list ?? []` creates a new array on every
  call and loops React forever (error #185). Select the object and default outside.

## 5. Controls

- **HeroUI v3 first.** Use `Button`, `Input`, `Switch`, `ToggleButtonGroup` (segmented choices),
  `Kbd` (keyboard shortcuts) and `Tooltip`, not native elements styled to look like them.
  `className` overrides HeroUI defaults (component CSS sits in an earlier cascade layer), with
  two exceptions:
  - `[data-slot=…]:focus` styles need an inline style.
  - `Button` forces SVGs to 16px, which is why `IconGlyph` sets its size inline.
- `Button` has no `title`. Give icon-only buttons an `aria-label`. Never nest a `<button>` in a
  `<button>`.
- **Checkbox:** always [AppCheckbox](Shared/Components/Shared/AppCheckbox.tsx). Unchecked shows
  only an outline; checked is a blue (or the list's own color) fill with a white check. Never
  draw a check on an unchecked box.
- **Tooltips:** [GlobalTooltip](Shared/Components/Shared/GlobalTooltip.tsx) shows the
  `aria-label` of any icon-only button or link after ~0.45 s. To give a button with text a hint,
  add `data-tooltip="…"`. Every new icon button needs an `aria-label`. That is its tooltip too.
- **Native elements are fine** where the interaction is custom: the slash menu, `ContextMenu`
  rows, `ColorPicker`'s hue slider, hidden file inputs, `contentEditable` text, and overlay
  buttons inside the editor (table controls, media toolbar).

## 6. Layout and scrolling

- **Text selection** works only in document text and in inputs. The rest of the UI (menus,
  labels, tables, blocks inside the editor) can't be selected, like a native app. Opt a
  specific element back in with `select-text`.

- The window never scrolls. `html` and `body` have `overflow: hidden`, the shell uses
  `overflow-clip`, and AppShell resets any document scroll to 0. A touchpad can't drag the UI up
  or sideways.
- **No `overscroll-behavior` on `html`/`body` or globally.** In WebView2 it broke touchpad
  scrolling (inner columns stopped receiving the gesture).
- Vertical scrollers (`overflow-y-auto`) never scroll sideways; a base-layer rule clips their
  x-axis. Anything that genuinely needs horizontal scrolling gets its **own** `overflow-x-auto`.
  Today that is the focus board and wide tables.
- Use `overscroll-contain` on scroll columns inside overlays (the Settings dialog).
- Overlays (Settings) keep the titlebar usable: a drag strip and `WindowControls` sit above the
  blur, and the wheel is blocked outside the dialog panel.

## 7. Tabs

[TabStrip.tsx](Shared/Components/AppShell/TabStrip.tsx): each tab is as wide as its name (up to
200px). When they don't fit, [FitTabs](Shared/Lib/FitTabs.ts) shrinks the **leftmost** tabs first,
each down to 56px. The active tab always shows its full name. Only after that does the strip
scroll.

## 8. Editor blocks

- **Tables** use @tiptap/extension-table's own DOM (`.tableWrapper` > `table` > `colgroup`), which
  column resizing depends on. Add/delete controls are an overlay,
  [TableControls.tsx](Shared/Components/DocumentView/Editor/Table/TableControls.tsx), outside the
  table's DOM, so they never overflow it. The last column takes the remaining width and isn't
  draggable. Column widths are saved in Markdown as the separator-row dash count (`|------|`,
  about 10px per dash). Prettier-style `| ------ |` and `| --- |` mean "no width".
- **Locked documents** (and the read-only preview on the To-do page): to-do lists render
  read-only, with a single "Import N to Backlog" button.

## 9. Testing UI without the desktop app

The static export can run with a mocked Tauri IPC backed by a copy of your app data:

1. Build with `NEXT_PUBLIC_LOCKIN_MOCK=1 bun run build` in `TauriBuild/`.
2. Write `TauriBuild/out/mock-fixture.json`: a `{ "relative/path": "file text" }` map of the
   default workspace's AppData files.
3. Serve `TauriBuild/out`. The `tauri-export` preview config uses port 3002.

The mock ([TauriBuild/Platform/DevMock.ts](TauriBuild/Platform/DevMock.ts)) keeps its files in
localStorage, so edits survive a reload. Release builds don't contain it.
