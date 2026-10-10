"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronDown, List, Maximize, Shuffle, Waypoints } from "@lockin/shared/Components/Shared/UiIcons";
import { ContextMenu, ContextMenuItem, ContextMenuLabel } from "@lockin/shared/Components/Shared/ContextMenu";
import { UseDataStore } from "@lockin/shared/Store/UseDataStore";
import { UseGraphStore, type GraphSettings } from "@lockin/shared/Store/UseGraphStore";
import { DocumentLinkTargets, FindWikiDocument } from "@lockin/shared/Lib/WikiLink";
import { ParseHexColor } from "@lockin/shared/Lib/Color";
import { GLASS_SURFACE, GraphSettingsPanel } from "./GraphSettingsPanel";

interface GraphNode {
  id: string;
  label: string;
  /** Cesta ve vaultu ("projects/lockin.md"), jinak název — na ni míří skupiny a hledání. */
  path: string;
  folder: string;
  href: string;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// Pořadí volené tak, aby sousední složky (podle abecedy) neměly podobné odstíny.
const GROUP_COLORS = ["#0088ff", "#e5484d", "#f5a524", "#8e4ec6", "#30a46c", "#d6409f", "#12a594", "#f76b15"];
const NO_GROUP_COLOR = "#91918e";

/** Příliš světlá barva (bílá, pastelová) by na bílém pozadí zmizela — pro
 * obrys teček a zvýraznění se použije její ztmavená verze. */
function IsLight(hex: string): boolean {
  const rgb = ParseHexColor(hex);
  return Boolean(rgb && (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 > 0.8);
}
function Readable(hex: string): string {
  const rgb = ParseHexColor(hex);
  if (!rgb || !IsLight(hex)) return hex;
  const Dark = (c: number) => Math.round(c * 0.55).toString(16).padStart(2, "0");
  return `#${Dark(rgb.r)}${Dark(rgb.g)}${Dark(rgb.b)}`;
}
const EDGE_COLOR = "#e4e3e0";
const ACCENT = "#0088ff";
/** Maximální posun tečky za snímek (px ve světě). */
const MAX_SPEED = 6;
/** Kolik kroků simulace proběhne mimo obrazovku, než se graf poprvé ukáže. */
const WARMUP_TICKS = 500;

/**
 * Graf poznámek jako v Obsidianu: tečka = dokument, čára = `[[wiki odkaz]]`,
 * barva podle vlastních skupin, jinak podle horní složky. Vlastní silová
 * simulace na canvasu; nastavení (UseGraphStore) se čte každý snímek přes
 * ref, takže posun slideru nerozhodí rozložení.
 * ponytail: O(n²) odpuzování, pro tisíce poznámek by chtělo quadtree (Barnes–Hut).
 */
export function GraphView() {
  const router = useRouter();
  const documents = UseDataStore((state) => state.documents);
  const projects = UseDataStore((state) => state.projects);
  const settings = UseGraphStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef<GraphSettings>(settings);
  // Pro kontextové menu: tečka pod kurzorem a přiblížení na celý graf (žijí uvnitř efektu).
  const hoverRef = useRef<GraphNode | null>(null);
  const fitRef = useRef<() => void>(() => {});
  const [menuNode, setMenuNode] = useState<GraphNode | null>(null);
  settingsRef.current = settings;

  const { nodes, edges, folders } = useMemo(() => {
    const docs = Object.values(documents);
    const index = new Map<string, number>();
    // "dir:resources/heroui" -> "resources"
    const TopFolder = (folderId: string | null) => folderId?.replace(/^dir:/, "").split("/")[0] ?? "";
    const startFolders = [...new Set(docs.map((doc) => TopFolder(doc.folderId)))].sort();
    const nodes: GraphNode[] = docs.map((doc, i) => {
      index.set(doc.id, i);
      const project = doc.projectId ? projects[doc.projectId] : undefined;
      const href = !doc.projectId
        ? `/Document?id=${encodeURIComponent(doc.id)}`
        : `/YourProjects/Project?id=${encodeURIComponent(doc.projectId)}${
            project?.rootDocumentId === doc.id ? "" : `&doc=${encodeURIComponent(doc.id)}`
          }`;
      // Start: každá složka má vlastní místo na kružnici a tečky kolem něj ve
      // spirále (zlatý úhel). Shluky tak začínají od sebe a nepropletou se;
      // bez náhody, takže se graf pokaždé usadí stejně.
      const slot = (startFolders.indexOf(TopFolder(doc.folderId)) / startFolders.length) * Math.PI * 2;
      const angle = i * 2.39996;
      const radius = 10 * Math.sqrt(i + 1);
      const label = project?.rootDocumentId === doc.id ? project.name || doc.name : doc.name || "Untitled";
      return {
        id: doc.id,
        label,
        path: doc.id.startsWith("md:") ? doc.id.slice(3) : label,
        folder: TopFolder(doc.folderId),
        href,
        degree: 0,
        x: Math.cos(slot) * 350 + Math.cos(angle) * radius,
        y: Math.sin(slot) * 350 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });
    const seen = new Set<string>();
    // Směr odkazu (from -> to) je kvůli šipkám; obousměrný odkaz je jedna čára.
    const edges: [number, number][] = [];
    docs.forEach((doc, from) => {
      for (const target of DocumentLinkTargets(doc)) {
        const to = index.get(FindWikiDocument(target, docs)?.id ?? "");
        if (to === undefined || to === from) continue;
        const key = from < to ? `${from}-${to}` : `${to}-${from}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([from, to]);
        nodes[from].degree++;
        nodes[to].degree++;
      }
    });
    const folders = [...new Set(nodes.map((n) => n.folder))].filter(Boolean).sort();
    return { nodes, edges, folders };
  }, [documents, projects]);

  const folderColor = useMemo(() => {
    const map = new Map(folders.map((f, i) => [f, GROUP_COLORS[i % GROUP_COLORS.length]]));
    return (folder: string) => map.get(folder) ?? NO_GROUP_COLOR;
  }, [folders]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d")!;
    const font = getComputedStyle(document.body).fontFamily;
    const neighbors = nodes.map(() => new Set<number>());
    for (const [a, b] of edges) {
      neighbors[a].add(b);
      neighbors[b].add(a);
    }
    const S = () => settingsRef.current;
    const Radius = (n: GraphNode) => (2 + Math.sqrt(n.degree) * 1.1) * S().nodeSize;
    const Visible = (i: number) => S().showOrphans || nodes[i].degree > 0;
    const Matches = (n: GraphNode) => {
      const q = S().search.trim().toLowerCase();
      return !q || n.path.toLowerCase().includes(q) || n.label.toLowerCase().includes(q);
    };
    const ColorOf = (n: GraphNode) => {
      if (S().ungrouped) return S().nodeColor;
      const path = n.path.toLowerCase();
      const group = S().groups.find((g) => g.query.trim() && path.includes(g.query.trim().toLowerCase()));
      return group?.color ?? folderColor(n.folder);
    };
    // Skutečná viditelnost teček a zvýraznění hran — každý snímek se přibližují
    // k cíli, takže hover i hledání plynule prolínají místo přeskoku.
    const fade = nodes.map(() => 1);
    const glow = edges.map(() => 0);
    const Ease = (value: number, target: number) => value + (target - value) * 0.18;

    const view = { x: 0, y: 0, k: 1 };
    // Plynulý zoom: kolečko mění jen cíl, přiblížení k němu dojede v Loop().
    const zoomGoal = { k: 1, sx: 0, sy: 0 };
    let width = 0;
    let height = 0;
    let alpha = 1;
    let hovered = -1;
    let dragging = -1;
    let panning = false;
    let moved = false;
    let last = { x: 0, y: 0 };
    let frame = 0;
    let settingsKey = "";
    // Pohupování jen při živém běhu, ne během předvýpočtu.
    let idle = false;
    let warmup = WARMUP_TICKS;
    // Poslední barva zvýraznění — drží se i během doznívání po odjetí kurzoru.
    let focusColor = ACCENT;

    /** Přiblížení tak, aby byl vidět celý graf (s okrajem) — po usazení a z kontextového menu. */
    function Fit() {
      const shown = nodes.filter((_, i) => Visible(i));
      if (!shown.length || !width || !height) return;
      const xs = shown.map((n) => n.x);
      const ys = shown.map((n) => n.y);
      const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      view.k = zoomGoal.k = Math.min(1.5, width / (maxX - minX + 160), height / (maxY - minY + 160));
      view.x = -((minX + maxX) / 2) * view.k;
      view.y = -((minY + maxY) / 2) * view.k;
    }
    fitRef.current = Fit;

    const ToWorld = (sx: number, sy: number) => ({
      x: (sx - width / 2 - view.x) / view.k,
      y: (sy - height / 2 - view.y) / view.k,
    });
    function NodeAt(sx: number, sy: number) {
      const p = ToWorld(sx, sy);
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (!Visible(i)) continue;
        const n = nodes[i];
        const r = Radius(n) + 4 / view.k;
        if ((n.x - p.x) ** 2 + (n.y - p.y) ** 2 <= r * r) return i;
      }
      return -1;
    }

    function Tick() {
      const { centerForce, repelForce, linkForce, linkDistance } = S();
      // Odpuzování všech dvojic, pružiny na hranách, tah do středu.
      for (let i = 0; i < nodes.length; i++) {
        if (!Visible(i)) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          if (!Visible(j)) continue;
          const a = nodes[i];
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          const d2 = Math.max(dx * dx + dy * dy, 30);
          const f = (400 * repelForce * alpha) / d2 / Math.sqrt(d2);
          dx *= f;
          dy *= f;
          a.vx += dx;
          a.vy += dy;
          b.vx -= dx;
          b.vy -= dy;
        }
      }
      for (const [i, j] of edges) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = ((d - linkDistance) / d) * 0.04 * linkForce * alpha;
        a.vx += dx * f;
        a.vy += dy * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
      }
      const time = performance.now();
      nodes.forEach((n, i) => {
        n.vx -= n.x * 0.004 * centerForce * alpha;
        n.vy -= n.y * 0.004 * centerForce * alpha;
        if (idle) {
          // Jemné pohupování kolem místa — každá tečka má vlastní fázi a tempo.
          n.vx += Math.sin(time * 0.0004 + i * 1.7) * 0.012;
          n.vy += Math.cos(time * 0.00033 + i * 2.3) * 0.012;
        }
        if (i === dragging) {
          n.vx = 0;
          n.vy = 0;
          return;
        }
        // Silné tlumení („med, ne led") + strop rychlosti — bez nich tečky
        // přestřelují a celý graf se třese.
        n.vx *= 0.6;
        n.vy *= 0.6;
        const speed = Math.hypot(n.vx, n.vy);
        if (speed > MAX_SPEED) {
          n.vx *= MAX_SPEED / speed;
          n.vy *= MAX_SPEED / speed;
        }
        n.x += n.vx;
        n.y += n.vy;
      });
      alpha = Math.max(alpha * 0.99, 0.003);
    }

    function Draw() {
      const s = S();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(width / 2 + view.x, height / 2 + view.y);
      ctx.scale(view.k, view.k);
      const focus = hovered >= 0 ? hovered : dragging;
      const lit = focus >= 0 ? neighbors[focus] : null;
      const searching = s.search.trim() !== "";
      // Zvýraznění má barvu tečky, na které je kurzor (skupina / jednotná barva).
      if (focus >= 0) focusColor = Readable(ColorOf(nodes[focus]));
      const Highlighted = (i: number) => i === focus || Boolean(lit?.has(i)) || (searching && Matches(nodes[i]));
      nodes.forEach((n, i) => {
        fade[i] = Ease(fade[i], lit ? (Highlighted(i) ? 1 : 0.12) : searching && !Matches(n) ? 0.12 : 1);
      });
      edges.forEach(([i, j], e) => {
        glow[e] = Ease(glow[e], focus >= 0 && (i === focus || j === focus) ? 1 : 0);
      });

      // Motiv se čte každý snímek, takže přepnutí světlý/tmavý se projeví hned.
      const dark = document.documentElement.dataset.theme === "dark";
      const edgeColor = dark ? "#3a3a38" : EDGE_COLOR;

      function Edge(i: number, j: number, color: string, opacity: number) {
        if (opacity < 0.01) return;
        const a = nodes[i];
        const b = nodes[j];
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const tip = Radius(b) + 1;
        const size = (4 + 2 * s.linkThickness) / Math.sqrt(view.k);
        // Se šipkou končí čára u základny hrotu, ne ve středu tečky — jinak
        // by jím prostřelila a hrot by vypadal rozmazaně.
        const end = s.arrows ? tip + size * Math.cos(0.45) : 0;
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x - cos * end, b.y - sin * end);
        ctx.stroke();
        if (!s.arrows) return;
        // Hrot na okraji cílové tečky.
        const tx = b.x - cos * tip;
        const ty = b.y - sin * tip;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - size * Math.cos(angle - 0.45), ty - size * Math.sin(angle - 0.45));
        ctx.lineTo(tx - size * Math.cos(angle + 0.45), ty - size * Math.sin(angle + 0.45));
        ctx.fill();
      }

      ctx.lineWidth = s.linkThickness / view.k;
      edges.forEach(([i, j], e) => {
        if (!Visible(i) || !Visible(j)) return;
        const base = Math.min(fade[i], fade[j]);
        Edge(i, j, edgeColor, base * (1 - glow[e]));
        Edge(i, j, focusColor, glow[e]);
      });
      nodes.forEach((n, i) => {
        if (!Visible(i)) return;
        const color = ColorOf(n);
        ctx.globalAlpha = fade[i];
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, Radius(n), 0, Math.PI * 2);
        ctx.fill();
        if (!dark && IsLight(color)) {
          // Světlá tečka dostane tenký tmavší obrys, jinak by na bílé splynula.
          ctx.strokeStyle = Readable(color);
          ctx.lineWidth = 1 / view.k;
          ctx.stroke();
        }
        if (i === focus) {
          // Obrys zvýrazněné tečky, jako v Obsidianu.
          ctx.strokeStyle = focusColor;
          ctx.lineWidth = 1.5 / view.k;
          ctx.beginPath();
          ctx.arc(n.x, n.y, Radius(n) + 2 / view.k, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Popisky jsou ve světových jednotkách (rostou se zoomem) a plynule se
      // objevují: velké rozcestníky dřív, malé poznámky až při přiblížení.
      // Práh (-3…3) posouvá, od jakého přiblížení se začnou ukazovat.
      // Text roste se zoomem jen do 15 px na obrazovce, pak už ne — jinak by
      // se při přiblížení popisky přes sebe tlačily.
      const fontSize = Math.min(s.labelSize, (s.labelSize * 15) / 11 / view.k);
      const weight = { regular: 400, medium: 500, bold: 600 }[s.labelWeight];
      ctx.font = `${weight} ${fontSize}px ${font}`;
      // Výchozí šedá popisků je v tmavém režimu světlejší; vlastní barvu necháme.
      const textColor = dark ? (s.labelColor.toLowerCase() === "#5f5e59" ? "#b3b1ab" : s.labelColor) : Readable(s.labelColor);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      nodes.forEach((n, i) => {
        if (!Visible(i)) return;
        const start = (1 + s.textFadeThreshold * 0.35) / (1 + Math.sqrt(n.degree) * 0.25);
        const byZoom = Math.min(1, Math.max(0, (view.k - start) / (start * 0.5)));
        const opacity = Math.max(byZoom, Highlighted(i) ? 1 : 0) * fade[i];
        if (opacity < 0.02) return;
        const y = n.y + Radius(n) + 3;
        ctx.globalAlpha = opacity;
        // Bílý lem, aby text zůstal čitelný přes čáry.
        if (s.labelHalo) {
          ctx.strokeStyle = dark ? "#191919" : "#ffffff";
          ctx.lineWidth = fontSize * 0.3;
          ctx.strokeText(n.label, n.x, y);
        }
        ctx.fillStyle = i === focus ? (dark ? "#ffffff" : "#0f0f0f") : textColor;
        ctx.fillText(n.label, n.x, y);
      });
      ctx.globalAlpha = 1;
    }

    function Loop() {
      // Změna sil / filtru znovu rozpohybuje simulaci, jinak by slider nic neudělal.
      const { centerForce, repelForce, linkForce, linkDistance, showOrphans } = S();
      const key = `${centerForce}|${repelForce}|${linkForce}|${linkDistance}|${showOrphans}`;
      if (key !== settingsKey) {
        if (settingsKey) alpha = Math.max(alpha, 0.3);
        settingsKey = key;
      }
      if (Math.abs(zoomGoal.k - view.k) > 0.0005) {
        // Bod pod kurzorem zůstává na místě po celou dobu dojezdu zoomu.
        const anchor = ToWorld(zoomGoal.sx, zoomGoal.sy);
        view.k += (zoomGoal.k - view.k) * 0.22;
        view.x = zoomGoal.sx - width / 2 - anchor.x * view.k;
        view.y = zoomGoal.sy - height / 2 - anchor.y * view.k;
      }
      if (warmup > 0) {
        // Předvýpočet po dávkách přes několik snímků (nezasekne UI); plátno
        // je zatím průhledné a graf se objeví až usazený.
        for (let t = 0; t < 70 && warmup > 0; t++, warmup--) Tick();
        if (warmup === 0) {
          idle = true;
          Fit();
          canvas!.style.opacity = "1";
        }
        frame = requestAnimationFrame(Loop);
        return;
      }
      // Běží pořád — při nízké alfě drží tvar a nese jemné pohupování.
      Tick();
      Draw();
      frame = requestAnimationFrame(Loop);
    }

    const unsubscribeShake = UseGraphStore.subscribe((state, prev) => {
      if (state.shakeNonce === prev.shakeNonce) return;
      for (const n of nodes) {
        n.vx += (Math.random() - 0.5) * 15;
        n.vy += (Math.random() - 0.5) * 15;
      }
      alpha = 1;
    });

    const observer = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    });
    observer.observe(container);

    function OnDown(e: PointerEvent) {
      canvas!.setPointerCapture(e.pointerId);
      dragging = NodeAt(e.offsetX, e.offsetY);
      panning = dragging < 0;
      moved = false;
      last = { x: e.offsetX, y: e.offsetY };
      if (dragging >= 0) alpha = Math.max(alpha, 0.3);
    }
    function OnMove(e: PointerEvent) {
      const dx = e.offsetX - last.x;
      const dy = e.offsetY - last.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      last = { x: e.offsetX, y: e.offsetY };
      if (dragging >= 0) {
        const p = ToWorld(e.offsetX, e.offsetY);
        nodes[dragging].x = p.x;
        nodes[dragging].y = p.y;
        alpha = Math.max(alpha, 0.3);
      } else if (panning) {
        view.x += dx;
        view.y += dy;
      } else {
        hovered = NodeAt(e.offsetX, e.offsetY);
        hoverRef.current = hovered >= 0 ? nodes[hovered] : null;
        canvas!.style.cursor = hovered >= 0 ? "pointer" : "grab";
      }
    }
    function OnUp() {
      if (dragging >= 0 && !moved) router.push(nodes[dragging].href);
      dragging = -1;
      panning = false;
    }
    function OnWheel(e: WheelEvent) {
      e.preventDefault();
      // Zoom kolem kurzoru — kolečko posune jen cíl, dojezd řeší Loop().
      zoomGoal.k = Math.min(6, Math.max(0.12, zoomGoal.k * Math.exp(-e.deltaY * 0.0015)));
      zoomGoal.sx = e.offsetX;
      zoomGoal.sy = e.offsetY;
    }
    function OnLeave() {
      hoverRef.current = null;
      hovered = -1;
    }

    canvas.addEventListener("pointerdown", OnDown);
    canvas.addEventListener("pointermove", OnMove);
    canvas.addEventListener("pointerup", OnUp);
    canvas.addEventListener("pointerleave", OnLeave);
    canvas.addEventListener("wheel", OnWheel, { passive: false });
    frame = requestAnimationFrame(Loop);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribeShake();
      observer.disconnect();
      canvas.removeEventListener("pointerdown", OnDown);
      canvas.removeEventListener("pointermove", OnMove);
      canvas.removeEventListener("pointerup", OnUp);
      canvas.removeEventListener("pointerleave", OnLeave);
      canvas.removeEventListener("wheel", OnWheel);
    };
  }, [nodes, edges, folderColor, router]);

  const visibleCount = settings.showOrphans ? nodes.length : nodes.filter((n) => n.degree > 0).length;

  return (
    <ContextMenu
      className="relative flex min-h-0 flex-1 flex-col"
      menu={(close) => (
        <>
          {menuNode ? (
            <>
              <ContextMenuLabel first>{menuNode.label}</ContextMenuLabel>
              <ContextMenuItem icon={<ArrowUpRight size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />} onClick={() => (router.push(menuNode.href), close())}>
                Open note
              </ContextMenuItem>
            </>
          ) : null}
          <ContextMenuLabel first={!menuNode}>Graph</ContextMenuLabel>
          <ContextMenuItem icon={<Maximize size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />} onClick={() => (fitRef.current(), close())}>
            Zoom to fit
          </ContextMenuItem>
          <ContextMenuItem icon={<Shuffle size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />} onClick={() => (settings.Shake(), close())}>
            Animate
          </ContextMenuItem>
          <ContextMenuItem
            icon={<List size={14} strokeWidth={1.75} className="text-[var(--lk-text2)]" />}
            onClick={() => (settings.Set({ legendOpen: !settings.legendOpen }), close())}
          >
            {settings.legendOpen ? "Hide legend" : "Show legend"}
          </ContextMenuItem>
        </>
      )}
    >
    <div ref={containerRef} onContextMenuCapture={() => setMenuNode(hoverRef.current)} className="relative min-h-0 flex-1 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 cursor-grab touch-none opacity-0 transition-opacity duration-500" />
      {/* Skleněná karta nad grafem: nadpis + legenda, sbalitelná jen na nadpis. */}
      <div className={`absolute left-4 top-4 flex max-h-[calc(100%-32px)] w-60 select-none flex-col rounded-2xl p-3 ${GLASS_SURFACE}`}>
        <button
          type="button"
          onClick={() => settings.Set({ legendOpen: !settings.legendOpen })}
          aria-expanded={settings.legendOpen}
          className="flex items-center gap-2 rounded-lg text-left"
        >
          <Waypoints size={26} strokeWidth={1.5} className="shrink-0 text-black" />
          <span className="flex-1 select-none text-[24px] font-medium tracking-[-0.48px] text-black">Graph</span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-[var(--lk-muted)] transition-transform ${settings.legendOpen ? "" : "-rotate-90"}`}
          />
        </button>
        {settings.legendOpen ? (
          <div className="mt-2.5 flex min-h-0 flex-col gap-1 overflow-y-auto border-t border-black/[0.06] pt-2.5 text-[13px] text-[var(--lk-text2)]">
            <p className="text-[var(--lk-muted)]">
              {visibleCount} notes · {edges.length} links
            </p>
            {settings.ungrouped ? (
              <p className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: settings.nodeColor }} />
                All notes
              </p>
            ) : null}
            {!settings.ungrouped && settings.groups
              .filter((g) => g.query.trim())
              .map((group) => (
                <p key={group.id} className="flex items-center gap-1.5">
                  <span className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: group.color }} />
                  <span className="truncate">{group.query}</span>
                </p>
              ))}
            {!settings.ungrouped && folders.map((folder) => (
              <p key={folder} className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: folderColor(folder) }} />
                <span className="truncate">{folder}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <GraphSettingsPanel />
    </div>
    </ContextMenu>
  );
}
