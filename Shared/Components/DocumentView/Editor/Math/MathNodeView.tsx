"use client";

import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";

/** KaTeX do HTML. Chyba se nevyhazuje — rozepsaný vzorec se ukáže červeně
 * a píše se dál, místo aby editor spadl na každém druhém stisku. */
function Render(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex, { displayMode, throwOnError: false, output: "html" });
}

function MathNodeViewBase({ node, updateAttributes, editor, selected, block }: NodeViewProps & { block: boolean }) {
  const latex = String(node.attrs.latex ?? "");
  const [editing, setEditing] = useState(() => editor.isEditable && latex === "");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    // Až po snímku: ProseMirror si po vložení uzlu bere fokus zpátky sám,
    // takže synchronní focus() by hned sebral blur a pole by se zavřelo.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  if (editing) {
    return (
      <NodeViewWrapper as={block ? "div" : "span"} className={block ? "my-2 block" : "inline-block"}>
        <textarea
          ref={inputRef}
          rows={block ? 2 : 1}
          value={latex}
          spellCheck={false}
          onChange={(e) => updateAttributes({ latex: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey && !block)) {
              e.preventDefault();
              setEditing(false);
              editor.commands.focus();
            }
          }}
          placeholder="\frac{a}{b}"
          className={`resize-none rounded-md border border-[#0485f7] bg-[var(--lk-panel)] px-1.5 py-0.5 font-mono text-[13px] outline-none ${
            block ? "w-full" : "w-48 align-middle"
          }`}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as={block ? "div" : "span"}
      onClick={() => editor.isEditable && setEditing(true)}
      className={`${block ? "my-2 block overflow-x-auto text-center" : "inline-block align-middle"} ${
        editor.isEditable ? "cursor-pointer" : ""
      } ${selected ? "rounded bg-[#0088ff]/15" : ""}`}
      // KaTeX vrací vlastní HTML; `trust` je ve výchozím stavu vypnuté, takže
      // z něj nemůže vypadnout cizí značkování.
      dangerouslySetInnerHTML={
        latex ? { __html: Render(latex, block) } : { __html: '<span class="text-[var(--lk-faint)]">Empty formula</span>' }
      }
    />
  );
}

export function MathInlineNodeView(props: NodeViewProps) {
  return <MathNodeViewBase {...props} block={false} />;
}

export function MathBlockNodeView(props: NodeViewProps) {
  return <MathNodeViewBase {...props} block />;
}
