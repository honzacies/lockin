<p align="center">
  <img src="Brand/logo.svg" width="112" height="112" alt="LockIn logo">
</p>

<h1 align="center">LockIn</h1>

<p align="center">
  <b>Notes, to-dos and focus sessions in one desktop app.</b><br>
  Plan in your notes, pull the tasks onto a board, then lock in on one thing at a time.
</p>

<p align="center">
  Windows desktop app · built with Tauri 2, Next.js 16 and React 19 · <b>beta</b>
</p>

---

## What is LockIn?

"Lock in" is slang for getting fully focused: shutting out distractions and committing to the task
in front of you. LockIn is built around that moment.

Most productivity setups are split across three apps: one for notes, one for to-do lists and one for
a focus timer. LockIn puts them in one place and connects them:

1. **Write.** Notes and project documents in a block editor (Notion-style), with rich to-do lists
   wherever you need them.
2. **Plan.** Every to-do list across all your notes shows up in one **To-do Home**. From there you
   send tasks to a **focus board**: *Today*, *This week* and *Backlog*.
3. **Lock in.** Start a session and LockIn takes the first open task in *Today*. A small window stays
   pinned on top of your other apps and shows the one task you're on, with its timer.

Your data lives on your own disk as plain files. There is no account and no cloud, and it works
offline. You can also point LockIn at an existing folder of Markdown files, such as an
**Obsidian vault**, and work on it directly.

> **Beta.** LockIn is under active development. Things can break and formats can still change, so
> keep backups of anything important.

## Features

### Notes and documents
- **Block editor** with a `/` slash menu: headings, quotes, code blocks, dividers, bulleted / dashed /
  numbered lists, tables, links and `[[wiki links]]`.
- **Rich blocks**:
  - **To-do list**: title, deadline, groups, task descriptions and a progress bar.
  - **Image or video**: upload with crop, alignment and width.
  - **YouTube** embeds.
  - **Color palette**: named groups of swatches, click to copy as HEX / RGB / HSL.
  - **Scenario**: timestamped script beats for videos, with a word count.
- **Per-block styling**: font, size, weight and color for each block type, optionally applied to all
  future documents.
- **Per-document themes**, small-text mode, lock against edits.
- **Sketch mode**: a freehand canvas inside any document and in Quick Notes.
- **Quick Notes**: a scratchpad with its own to-do lists, for anything that doesn't belong to a
  project yet.

### Projects
- Projects with **status, priority, progress, deadline** and a root document plus sub-documents.
- Custom status and priority options with your own colors.

### To-dos and focus
- **To-do Home** collects every to-do list from every note and project, with progress and deadlines.
  Reusable checklists (templates) can be hidden from it.
- **Focus board** with *Today / This week / Backlog* columns and groups. Tasks can come from any list.
- **Focus sessions**: give a task a time estimate for a countdown, or leave it empty for a stopwatch.
  LockIn tracks the time you spend on each task.
- **Session window**: a small always-on-top window on the monitor you choose, so the current task
  stays in sight while you work in other apps.

### Library and navigation
- **Library** with folders, colored tags, favorites, recents, filters and a side-panel preview.
- **Graph view** of how your notes and projects link to each other.
- **Canvas** boards.
- Tabs, a customizable sidebar and a custom window chrome.

### Workspaces
- **In-app workspace** (default): data is stored as JSON in the app data folder.
- **Folder workspaces**: open any folder of `.md` files, for example an Obsidian vault. LockIn reads
  and writes the files themselves. Notes you didn't touch stay byte-for-byte identical, and
  frontmatter and `[[wiki links]]` are preserved. Blocks that Markdown can't express are stored as
  one-line `{lockin.…}` components (see [Markdown format](#markdown-format)).

### AI assistant integration (MCP)
LockIn includes an [MCP](https://modelcontextprotocol.io) server. An AI assistant such as Claude can:
- read your projects, documents, to-do lists and board,
- **pick what to work on next**, with a reason for each pick (board position, deadlines, priority,
  nearly finished lists),
- tick tasks off, add or rename them, plan them onto the board and start sessions,
- **write whole documents** that mix any of the editor blocks.

See [MCP server](#mcp-server) for setup.

## Install

Pre-built installers are published on the **[Releases](../../releases)** page:

- `Lockin_x.y.z_x64-setup.exe`: the regular installer (NSIS)
- `Lockin_x.y.z_x64_en-US.msi`: an MSI package, for managed installs

The installers are **not code-signed** yet, so Windows SmartScreen may warn you the first time. Choose
*More info → Run anyway*.

LockIn currently targets **Windows 10/11 (x64)**. Tauri also supports macOS and Linux, but those
builds aren't tested yet.

## Build from source

### Prerequisites
- [Bun](https://bun.sh) 1.2+ (package manager and script runner)
- [Rust](https://rustup.rs) (stable) and the
  [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS. On Windows that's
  the *Microsoft C++ Build Tools* and *WebView2* (WebView2 is already part of Windows 11).

### Run in development

```bash
git clone https://github.com/honzacies/lockin.git
cd lockin
bun install
bun run tauri:dev
```

`tauri:dev` starts the Next.js dev server on `http://localhost:3000` and opens the desktop window
with hot reload. To work on the UI in a normal browser, without the native window, run `bun run dev`.
The desktop-only features (windows, file system) are then unavailable.

### Release build

```bash
bun run tauri:build
```

This produces a statically exported frontend (`TauriBuild/out`) and the installers in:

```
TauriBuild/src-tauri/target/release/bundle/nsis/Lockin_0.1.0_x64-setup.exe
TauriBuild/src-tauri/target/release/bundle/msi/Lockin_0.1.0_x64_en-US.msi
```

> On Windows, close any running `target/release/app.exe` before building. Windows locks the file
> while it's running, and the build fails with `Access is denied`.

### Checks

```bash
bun run typecheck                 # TypeScript across all packages
bun Shared/Lib/Markdown.check.ts  # Markdown <-> editor round-trip
bun Mcp/Mcp.check.ts              # MCP server end-to-end (reads your real data)
```

`Markdown.check.ts` can also take a folder path. It then checks that every `.md` file in it survives
a load and save unchanged, which is useful before you point LockIn at an existing vault.

## Where your data lives

| Workspace | Location |
| --- | --- |
| In-app (default) | `%APPDATA%\app.lockin.desktop\` on Windows: `Documents/`, `Projects/`, `Media/` and a few `*.json` stores |
| Folder | Your `.md` files stay in your folder. LockIn keeps small metadata files (icons, favorites, board) in the app data folder, prefixed with the workspace ID |

Writes are atomic: LockIn writes a temp file and renames it, so a crash never leaves a half-written
document behind. Media that no document references any more is cleaned up on start.

To back up, copy the app data folder (and your vault, if you use one).

## Markdown format

In folder workspaces, LockIn uses plain Markdown for everything Markdown can express:

```markdown
# Heading
Text with **bold**, *italic*, ~~strike~~, `code`, [links](https://example.com) and [[Wiki links]].

- bulleted list
+ dashed list   ← "+ " is LockIn's dashed list; other apps show it as normal bullets
1. numbered list
- [ ] simple checklist

| tables | work |
| --- | --- |
```

Rich blocks are stored as one-line components, each in its own paragraph. Every field is optional,
and missing ones get defaults:

```markdown
{lockin.todolist {"title": "Launch", "deadline": "2026-10-10", "tasks": ["Write copy", {"title": "Ship", "done": true}]}}

{lockin.palette {"title": "Brand", "groups": [{"title": "Primary", "swatches": ["#0088ff", {"color": "#2c2c2b", "label": "Ink"}]}]}}

{lockin.scenario {"name": "Intro video", "beats": [{"time": "0:00–0:10", "title": "Hook", "text": "Words to say"}]}}

{lockin.media {"path": "Media/media-123.png", "align": "center", "width": 80}}

{lockin.youtube {"url": "https://youtu.be/dQw4w9WgXcQ"}}
```

A file with `{lockin.project}` on its own line is treated as a LockIn **project**. The marker is
hidden in the editor.

Other Markdown apps show components as a line of text. They don't break the file, and LockIn reads
them back exactly.

## MCP server

The MCP server lives in [`Mcp/`](Mcp) and runs locally over stdio. It needs no API key and no
network. It reads LockIn's files on your machine and talks to the running app.

### Connect an AI agent

**1. Get the code and install dependencies** (once):

```bash
git clone https://github.com/honzacies/lockin.git
cd lockin
bun install
```

**2. Register the server in your agent.** Every client runs the same command,
`bun <absolute path to>/lockin/Mcp/index.ts`. Use forward slashes in the path, also on Windows.

<details open>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add --scope user lockin -- bun D:/Projects/lockin/Mcp/index.ts
```

`--scope user` makes LockIn available in every project. Check it with `claude mcp get lockin`, then
start a new session. Inside a clone of this repo you don't need this step: Claude Code picks up the
server from [`.mcp.json`](.mcp.json) and asks once whether to enable it.
</details>

<details>
<summary><b>Claude Desktop</b></summary>

Open *Settings → Developer → Edit Config* (`%APPDATA%\Claude\claude_desktop_config.json` on
Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS) and add:

```json
{
  "mcpServers": {
    "lockin": {
      "command": "bun",
      "args": ["D:/Projects/lockin/Mcp/index.ts"]
    }
  }
}
```

Then restart Claude Desktop.
</details>

<details>
<summary><b>Cursor</b></summary>

Add the server to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "lockin": {
      "command": "bun",
      "args": ["D:/Projects/lockin/Mcp/index.ts"]
    }
  }
}
```
</details>

<details>
<summary><b>VS Code (GitHub Copilot agent mode)</b></summary>

Add to `.vscode/mcp.json` in your workspace, or run *MCP: Add Server* from the command palette:

```json
{
  "servers": {
    "lockin": {
      "type": "stdio",
      "command": "bun",
      "args": ["D:/Projects/lockin/Mcp/index.ts"]
    }
  }
}
```
</details>

<details>
<summary><b>OpenAI Codex CLI</b></summary>

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.lockin]
command = "bun"
args = ["D:/Projects/lockin/Mcp/index.ts"]
```
</details>

<details>
<summary><b>Any other MCP client</b></summary>

Configure a **stdio** server with command `bun` and argument `<path>/lockin/Mcp/index.ts`. No
environment variables are required.
</details>

**3. Try it.** Open LockIn, then ask your agent:

> *What should I work on next in LockIn?*

The agent should call `lockin_next` and answer with a ranked list of tasks, each with a reason.
To test writing, ask:

> *Create a LockIn note called "MCP test" with a to-do list of three tasks and a color palette.*

The note appears in LockIn right away.

**Troubleshooting**
- *`bun` not found* (common for GUI apps such as Claude Desktop on Windows): use the full path to
  the Bun executable as `command`. Run `where bun` (Windows) or `which bun` (macOS/Linux) to find it.
- *"LockIn desktop isn't running"*: writing needs the app open. Reading still works without it.
- *"LockIn has another workspace open"*: switch to that workspace in the app, or pass `workspace`
  to the tool.
- *"Unknown command … update it"*: the app is older than the MCP server. Update or rebuild LockIn
  so both come from the same version.
- *Custom data location*: set `LOCKIN_APPDATA` to the folder that holds LockIn's data.
- Check the server without an agent: `bun Mcp/Mcp.check.ts`.

### How it works

- **Reading** works any time. The server reads the same files the app does.
- **Writing** needs the LockIn desktop app open on the same workspace. The server hands each change
  to the app, which applies it the same way a click would. This way the app never overwrites a
  change it didn't know about. A document open in the editor reloads when its content changes from
  outside.

| Area | Tools |
| --- | --- |
| Overview | `lockin_workspaces`, `lockin_overview`, `lockin_next`, `lockin_graph`, `lockin_canvases`, `lockin_options` |
| Documents | `lockin_document`, `lockin_write_document`, `lockin_set_document`, `lockin_delete_document` |
| To-do lists | `lockin_tasks`, `lockin_add_task`, `lockin_rename_task`, `lockin_complete_task`, `lockin_move_task`, `lockin_delete_task`, `lockin_add_group`, `lockin_delete_group`, `lockin_set_list`, `lockin_ignore_list` |
| Board and sessions | `lockin_board`, `lockin_send_to_board`, `lockin_board_move`, `lockin_board_complete`, `lockin_board_remove`, `lockin_board_clear`, `lockin_session` |
| Projects | `lockin_set_project`, `lockin_set_option`, `lockin_add_option`, `lockin_remove_option` |

`lockin_write_document` accepts the [Markdown format](#markdown-format) above, so an assistant can
create a note that mixes text, tables, to-do lists, palettes, scenarios, images and videos in a
single call.

## Project structure

LockIn is a Bun workspace monorepo:

```
Shared/       UI, editor, stores and logic shared by every build (React, Tiptap, Zustand)
  Components/   app shell, editor blocks, library, focus board, …
  Pages/        page components, mounted by the app routes of each build
  Lib/          Markdown <-> editor conversion, workspaces, to-do actions, …
  Platform/     interfaces each build implements (storage, media, windows)
TauriBuild/   desktop app: Next.js static export + Tauri 2 (Rust) shell
  Platform/     Tauri implementations: file storage, vault storage, media, windows, MCP bridge
  src-tauri/    Rust side, config, icons
Mcp/          MCP server (Bun, stdio)
Brand/        logo source (SVG)
```

The desktop app has **no backend**. Next.js runs as a static export (`output: "export"`): no server
components and no API routes. All data access goes through the `Platform` adapters.

## Tech stack

- **Shell**: [Tauri 2](https://tauri.app) with the `fs`, `store` and `log` plugins
- **Frontend**: [Next.js 16](https://nextjs.org) (static export), React 19, TypeScript,
  Tailwind CSS 4, [HeroUI 3](https://heroui.com)
- **Editor**: [Tiptap 3](https://tiptap.dev) with custom node extensions
- **State**: [Zustand 5](https://zustand.docs.pmnd.rs)
- **Markdown**: [marked](https://marked.js.org)
- **Icons**: [Lucide](https://lucide.dev)
- **MCP**: [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)

## Contributing

Issues and pull requests are welcome. Since LockIn is in beta, please open an issue before a larger
change so we can agree on the approach first.

Before you open a PR, run:

```bash
bun run typecheck
bun Shared/Lib/Markdown.check.ts
```

When you change the Markdown format, make sure existing notes still round-trip unchanged. That's
what `Markdown.check.ts` guards.

## License

LockIn is licensed under the [Apache License 2.0](LICENSE).

You're free to use, modify and redistribute the code, including in commercial projects, as long as
you:
- keep the [LICENSE](LICENSE) and [NOTICE](NOTICE) files, which credit the original author,
- state which files you changed,
- **don't present LockIn as your own work**, and don't use the **LockIn name or logo** for your
  version. The license does not grant rights to them (Section 6), so a fork needs its own name and
  logo.

Copyright 2026 Honza Cieslar.
