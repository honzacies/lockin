import { marked, type Token, type Tokens } from "marked";
import type { JSONContent } from "@tiptap/core";
import { IsWikiHref, WikiDisplay, WikiHref, WikiInner } from "./WikiLink";
import { DEFAULT_TODO_LIST_STYLE } from "@lockin/shared/Types/QuickNotes";

/**
 * Markdown <-> Tiptap JSON pro složkové workspacy (.md soubory na disku).
 *
 * Priorita je neztratit obsah cizího souboru, ne dokonalé vykreslení: prostý
 * text se bere z `raw` (escapy, entity i [[wiki odkazy]] zůstanou beze změny),
 * obrázky a HTML zůstanou jako doslovný text a bloky, které markdown vyjádřit
 * neumí (to-do karty, palety, média...), se uloží jako ```lockin JSON blok.
 *
 * ponytail: barvy/fonty/zarovnání (textStyle, textAlign) se do .md neukládají.
 */

export const PROJECT_MARKER = "{lockin.project}";

/** Obsahuje dokument značku `{lockin.project}`? */
export function HasProjectMarker(doc: JSONContent | undefined): boolean {
  return (doc?.content ?? []).some((node) => node.type === "hiddenRaw" && node.attrs?.raw === PROJECT_MARKER);
}

/**
 * Komponenty v .md jako `{lockin.<název> <JSON nastavení>}` na samostatném
 * odstavci, např. `{lockin.todolist {"title": "Launch"}}`. Nastavení
 * to-do listu je jeho config, u ostatních rovnou atributy uzlu.
 * Starší ```lockin bloky (celý uzel jako JSON) se pořád čtou.
 */
const COMPONENTS: Record<string, string> = {
  todolist: "richTodoList",
  palette: "colorPalette",
  scenario: "scenario",
  media: "media",
  youtube: "youtubeEmbed",
};
const COMPONENT = /^\{lockin\.([\w-]+)(?:\s+([\s\S]*))?\}$/;

type Json = Record<string, unknown>;

/** Ručně psaný to-do list smí být neúplný — doplní se výchozí hodnoty.
 * ID bez zadání se odvodí z pořadí, aby byla po každém načtení stejná. */
function NormalizeTodoList(raw: Json): Json {
  const Tasks = (tasks: unknown, prefix: string) =>
    (Array.isArray(tasks) ? tasks : []).map((task: Json | string, i) => {
      const t = typeof task === "string" ? { title: task } : task;
      return { id: `${prefix}${i}`, title: "", description: "", done: false, ...t };
    });
  return {
    id: "todo",
    title: "",
    deadline: null,
    deadlineTime: null,
    ...raw,
    // vnořené styly (heading, taskTitle…) se slučují po polích, ne celé
    style: Object.fromEntries(
      Object.entries({ ...DEFAULT_TODO_LIST_STYLE, ...(raw.style as Json | undefined) }).map(([key, value]) => {
        const base = (DEFAULT_TODO_LIST_STYLE as unknown as Json)[key];
        return [key, base && typeof base === "object" ? { ...base, ...(value as Json) } : value];
      }),
    ),
    tasks: Tasks(raw.tasks, "t"),
    groups: (Array.isArray(raw.groups) ? raw.groups : []).map((group: Json, i) => ({
      id: `g${i}`,
      title: "",
      ...group,
      tasks: Tasks(group.tasks, `g${i}t`),
    })),
  };
}

function ParseComponent(raw: string): JSONContent | null {
  const match = raw.match(COMPONENT);
  const type = match && COMPONENTS[match[1]];
  if (!type) return null;
  try {
    const settings = (match[2] ? JSON.parse(match[2]) : {}) as Json;
    return type === "richTodoList"
      ? { type, attrs: { config: NormalizeTodoList(settings) } }
      : { type, attrs: settings };
  } catch {
    return null; // rozbitý JSON zůstane jako obyčejný text, nic se neztratí
  }
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n)*/;

/** YAML hlavičku (Obsidian) necháme bokem a při uložení ji vrátíme zpět. */
export function SplitFrontmatter(md: string): { frontmatter: string; body: string } {
  const match = md.match(FRONTMATTER);
  return match
    ? { frontmatter: match[0], body: md.slice(match[0].length) }
    : { frontmatter: "", body: md };
}

type Mark = NonNullable<JSONContent["marks"]>[number];

function Text(text: string, marks: Mark[]): JSONContent[] {
  if (!text) return [];
  return [marks.length ? { type: "text", text, marks } : { type: "text", text }];
}

function Inline(tokens: Token[] | undefined, marks: Mark[] = []): JSONContent[] {
  const out: JSONContent[] = [];
  for (const token of tokens ?? []) {
    switch (token.type) {
      case "strong":
        out.push(...Inline(token.tokens, [...marks, { type: "bold" }]));
        break;
      case "em":
        out.push(...Inline(token.tokens, [...marks, { type: "italic" }]));
        break;
      case "del":
        out.push(...Inline(token.tokens, [...marks, { type: "strike" }]));
        break;
      case "codespan":
        out.push(...Text(token.text, [...marks, { type: "code" }]));
        break;
      case "link":
        out.push(...Inline(token.tokens, [...marks, { type: "link", attrs: { href: token.href } }]));
        break;
      case "br":
        out.push({ type: "hardBreak" });
        break;
      case "checkbox":
        break;
      case "text":
        if ("tokens" in token && token.tokens?.length) out.push(...Inline(token.tokens, marks));
        else out.push(...Text(token.raw, marks));
        break;
      default:
        // image, html, escape, ... — doslovně, ať se nic neztratí
        out.push(...Text(token.raw, marks));
    }
  }
  return WikiLinks(out);
}

const WIKI = /\[\[([^[\]\n]+)\]\]/g;

/** Slepí sousední text se stejnými značkami (marked `[[x]]` občas rozseká)
 * a z `[[…]]` udělá link mark s href `wiki:…`. Kód se nechává být. */
function WikiLinks(nodes: JSONContent[]): JSONContent[] {
  const merged: JSONContent[] = [];
  for (const node of nodes) {
    const last = merged[merged.length - 1];
    if (last?.type === "text" && node.type === "text" && JSON.stringify(last.marks) === JSON.stringify(node.marks)) {
      merged[merged.length - 1] = { ...last, text: (last.text ?? "") + (node.text ?? "") };
    } else merged.push(node);
  }
  return merged.flatMap((node) => {
    const text = node.text ?? "";
    if (node.type !== "text" || !text.includes("[[") || node.marks?.some((m) => m.type === "code" || m.type === "link")) return [node];
    const out: JSONContent[] = [];
    let at = 0;
    for (const match of text.matchAll(WIKI)) {
      out.push(...Text(text.slice(at, match.index), node.marks ?? []));
      out.push(...Text(WikiDisplay(match[1]), [...(node.marks ?? []), { type: "link", attrs: { href: WikiHref(match[1]) } }]));
      at = match.index + match[0].length;
    }
    out.push(...Text(text.slice(at), node.marks ?? []));
    return out;
  });
}

function Paragraph(content: JSONContent[]): JSONContent {
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function ListItemContent(item: Tokens.ListItem): JSONContent[] {
  const blocks = Blocks(item.tokens);
  return blocks.length ? blocks : [Paragraph([])];
}

function Block(token: Token): JSONContent[] {
  switch (token.type) {
    case "space":
    case "checkbox":
      return [];
    case "heading":
      return [{ type: "heading", attrs: { level: token.depth }, content: Inline(token.tokens) }];
    case "paragraph": {
      // `{lockin.project}` = soubor je LockIn projekt; v editoru se neukazuje
      if (token.raw.trim() === PROJECT_MARKER) return [{ type: "hiddenRaw", attrs: { raw: PROJECT_MARKER } }];
      const component = ParseComponent(token.raw.trim());
      if (component) return [component];
      return [Paragraph(Inline(token.tokens))];
    }
    case "text":
      // volný text uvnitř položky seznamu
      return [Paragraph(Inline(token.tokens ?? [{ type: "text", raw: token.raw, text: token.text }]))];
    case "blockquote":
      return [{ type: "blockquote", content: Blocks(token.tokens) }];
    case "hr":
      return [{ type: "horizontalRule" }];
    case "code": {
      if (token.lang === "lockin") {
        try {
          return [JSON.parse(token.text) as JSONContent];
        } catch {
          // poškozený JSON — spadne níž jako obyčejný code block
        }
      }
      return [
        {
          type: "codeBlock",
          attrs: { language: token.lang || null },
          content: Text(token.text, []),
        },
      ];
    }
    case "list": {
      const list = token as Tokens.List;
      if (list.items.some((item) => item.task)) {
        return [
          {
            type: "taskList",
            content: list.items.map((item) => ({
              type: "taskItem",
              attrs: { checked: Boolean(item.checked) },
              content: ListItemContent(item),
            })),
          },
        ];
      }
      return [
        {
          type: list.ordered ? "orderedList" : "bulletList",
          ...(list.ordered ? { attrs: { start: Number(list.start) || 1 } } : {}),
          content: list.items.map((item) => ({ type: "listItem", content: ListItemContent(item) })),
        },
      ];
    }
    case "table": {
      const table = token as Tokens.Table;
      const Row = (cells: Tokens.TableCell[], cellType: string): JSONContent => ({
        type: "tableRow",
        content: cells.map((cell) => ({ type: cellType, content: [Paragraph(Inline(cell.tokens))] })),
      });
      return [
        {
          type: "table",
          content: [Row(table.header, "tableHeader"), ...table.rows.map((row) => Row(row, "tableCell"))],
        },
      ];
    }
    case "html":
      // <!-- komentář --> se v editoru skryje, ale do souboru se vrátí
      if (/^<!--[\s\S]*-->$/.test(token.raw.trim())) return [{ type: "hiddenRaw", attrs: { raw: token.raw.trim() } }];
      return token.raw.trim() ? [Paragraph(Text(token.raw.trim(), []))] : [];
    default:
      // html, def, ... — doslovně jako odstavec
      return token.raw.trim() ? [Paragraph(Text(token.raw.trim(), []))] : [];
  }
}

function Blocks(tokens: Token[] | undefined): JSONContent[] {
  return (tokens ?? []).flatMap(Block);
}

export function MarkdownToDoc(md: string): JSONContent {
  const content = Blocks(marked.lexer(md));
  return { type: "doc", content: content.length ? content : [Paragraph([])] };
}

// ---------------------------------------------------------------------------

// Pořadí vnoření zvenku dovnitř; `code` je vždy nejvnitřnější a jen per uzel.
const MARK_ORDER = ["link", "bold", "italic", "strike"];
const DELIMITER: Record<string, string> = { bold: "**", italic: "*", strike: "~~" };

const MarkKey = (mark: Mark) => (mark.type === "link" ? `link:${mark.attrs?.href}` : mark.type);
const OpenMark = (mark: Mark) => (mark.type === "link" ? "[" : DELIMITER[mark.type]);
const CloseMark = (mark: Mark) =>
  mark.type === "link" ? `](${mark.attrs?.href ?? ""})` : DELIMITER[mark.type];

/** Značky se otevírají/zavírají jen při změně mezi sousedními běhy textu,
 * jinak by dva tučné běhy vedle sebe daly nevalidní `**a****b**`. */
function InlineMd(nodes: JSONContent[] | undefined): string {
  let out = "";
  let open: Mark[] = [];
  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") {
      out += "  \n";
      continue;
    }
    if (node.type !== "text") {
      out += InlineMd(node.content);
      continue;
    }
    const wiki = node.marks?.find((mark) => mark.type === "link" && IsWikiHref(mark.attrs?.href));
    const wanted = MARK_ORDER.map((type) =>
      node.marks?.find((mark) => mark.type === type && mark !== wiki),
    ).filter((mark): mark is Mark => Boolean(mark));
    let same = 0;
    while (same < open.length && same < wanted.length && MarkKey(open[same]) === MarkKey(wanted[same])) same++;
    for (let i = open.length - 1; i >= same; i--) out += CloseMark(open[i]);
    for (let i = same; i < wanted.length; i++) out += OpenMark(wanted[i]);
    open = wanted;

    const text = node.text ?? "";
    if (wiki) {
      out += WikiMd(WikiInner(wiki.attrs!.href), text);
      continue;
    }
    const isCode = node.marks?.some((mark) => mark.type === "code");
    out += !isCode ? text : text.includes("`") ? `\`\` ${text} \`\`` : `\`${text}\``;
  }
  for (let i = open.length - 1; i >= 0; i--) out += CloseMark(open[i]);
  return out;
}

/** Nezměněný text -> původní `[[…]]`; přepsaný text se uloží jako alias. */
function WikiMd(inner: string, text: string): string {
  if (text === WikiDisplay(inner)) return `[[${inner}]]`;
  return `[[${inner.split("|")[0]}|${text}]]`;
}

/** První řádek dostane prefix, další řádky odsazení stejné šířky. */
function Prefix(text: string, first: string): string {
  const indent = " ".repeat(first.length);
  return text
    .split("\n")
    .map((line, index) => (index === 0 ? first + line : line ? indent + line : line))
    .join("\n");
}

function ItemMd(item: JSONContent, marker: string): string {
  return Prefix((item.content ?? []).map(BlockMd).join("\n"), marker);
}

function CellText(cell: JSONContent): string {
  return (cell.content ?? [])
    .map((block) => InlineMd(block.content))
    .join(" ")
    .replace(/\|/g, "\\|");
}

function BlockMd(node: JSONContent): string {
  const content = node.content ?? [];
  switch (node.type) {
    case "paragraph":
      return InlineMd(content);
    case "heading":
      return `${"#".repeat(Number(node.attrs?.level) || 1)} ${InlineMd(content)}`;
    case "blockquote":
      return content
        .map(BlockMd)
        .join("\n\n")
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "horizontalRule":
      return "---";
    case "hiddenRaw":
      return String(node.attrs?.raw ?? "");
    case "codeBlock":
      return `\`\`\`${node.attrs?.language ?? ""}\n${InlineMd(content)}\n\`\`\``;
    case "bulletList":
      return content.map((item) => ItemMd(item, "- ")).join("\n");
    case "orderedList": {
      const start = Number(node.attrs?.start) || 1;
      return content.map((item, index) => ItemMd(item, `${start + index}. `)).join("\n");
    }
    case "taskList":
      return content
        .map((item) => ItemMd(item, item.attrs?.checked ? "- [x] " : "- [ ] "))
        .join("\n");
    case "table": {
      const rows = content.map((row) => `| ${(row.content ?? []).map(CellText).join(" | ")} |`);
      const columns = content[0]?.content?.length ?? 0;
      rows.splice(1, 0, `|${" --- |".repeat(columns)}`);
      return rows.join("\n");
    }
    default: {
      const short = Object.entries(COMPONENTS).find(([, type]) => type === node.type)?.[0];
      if (short && !node.content?.length) {
        const settings = short === "todolist" ? node.attrs?.config : node.attrs;
        return `{lockin.${short} ${JSON.stringify(settings ?? {}, null, 2)}}`;
      }
      // cokoliv jiného (neznámý blok s obsahem) — celý uzel jako JSON
      return `\`\`\`lockin\n${JSON.stringify(node)}\n\`\`\``;
    }
  }
}

export function DocToMarkdown(doc: JSONContent): string {
  const blocks = (doc.content ?? []).map(BlockMd);
  // prázdné odstavce na konci dokumentu nechceme propisovat do souboru
  while (blocks.length && blocks[blocks.length - 1] === "") blocks.pop();
  return blocks.join("\n\n") + "\n";
}

/**
 * Uloží dokument tak, aby bloky, na které uživatel nesáhl, zůstaly v souboru
 * bajt po bajtu stejné (včetně mezer mezi nimi) — jinak by první uložení
 * přeformátovalo celou cizí poznámku. Blok se páruje s originálem podle toho,
 * že se oba serializují stejně; párování jde popořadě.
 */
export function PatchMarkdown(original: string, doc: JSONContent): string {
  // marked čte CRLF jako LF — Windows konce řádků se vrátí až na výstupu
  if (original.includes("\r\n")) return PatchMarkdown(original.replace(/\r\n/g, "\n"), doc).replace(/\n/g, "\r\n");
  let lead = "";
  const orig: { md: string; body: string; after: string }[] = [];
  for (const token of marked.lexer(original)) {
    if (token.type === "space") {
      if (orig.length) orig[orig.length - 1].after += token.raw;
      else lead += token.raw;
      continue;
    }
    const body = token.raw.replace(/\n+$/, "");
    orig.push({ md: Block(token).map(BlockMd).join("\n\n"), body, after: token.raw.slice(body.length) });
  }

  const blocks = (doc.content ?? []).map(BlockMd);
  while (blocks.length && blocks[blocks.length - 1] === "") blocks.pop();

  let out = lead;
  let next = 0; // první ještě nespárovaný blok originálu
  let prev = -1; // index originálu spárovaného s předchozím blokem, -1 = nový/změněný blok
  blocks.forEach((md, i) => {
    let k = next;
    while (k < orig.length && orig[k].md !== md) k++;
    const matched = k < orig.length;
    // Mezi dvěma bloky, které v originálu sousedily, zůstane původní mezera.
    if (i > 0) out += matched && prev >= 0 && k === prev + 1 ? orig[prev].after : "\n\n";
    out += matched ? orig[k].body : md;
    prev = matched ? k : -1;
    if (matched) next = k + 1;
  });
  if (!blocks.length && !orig.length) return original; // poznámka jen s frontmatterem
  out += prev >= 0 && prev === orig.length - 1 ? orig[prev].after : "\n";
  return out;
}
