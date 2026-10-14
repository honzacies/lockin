"use client";

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Popover } from "@lockin/shared/Components/Shared/Popover";
import { CALLOUT_KINDS, CalloutStyle } from "./CalloutExtension";

/**
 * Rámeček calloutu: ikona (klikem se mění druh), vlastní nadpis a pod ním
 * normální obsah editoru. Hlavička je `contentEditable={false}`, jinak by ji
 * ProseMirror považoval za součást textu uzlu.
 */
export function CalloutNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const kind = String(node.attrs.kind ?? "note");
  const style = CalloutStyle(kind);
  const Icon = style.icon;
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper
      data-callout={kind}
      className="my-2 overflow-hidden rounded-xl border"
      style={{ borderColor: `${style.color}40`, background: `${style.color}0f` }}
    >
      <div contentEditable={false} className="flex items-center gap-2 px-3 pt-2.5">
        {editable ? (
          <Popover
            panelClassName="w-44 p-1"
            trigger={() => (
              <button type="button" title="Callout type" className="rounded-md p-0.5 hover:bg-black/[0.06]" style={{ color: style.color }}>
                <Icon size={17} />
              </button>
            )}
          >
            {(close) => (
              <div className="flex flex-col">
                {Object.entries(CALLOUT_KINDS).map(([id, meta]) => {
                  const ItemIcon = meta.icon;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => (updateAttributes({ kind: id }), close())}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 text-left text-[14px] hover:bg-black/[0.04] ${
                        id === kind ? "bg-black/[0.04]" : ""
                      }`}
                    >
                      <ItemIcon size={15} style={{ color: meta.color }} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            )}
          </Popover>
        ) : (
          <Icon size={17} style={{ color: style.color }} />
        )}
        <input
          value={String(node.attrs.title ?? "")}
          readOnly={!editable}
          onChange={(e) => updateAttributes({ title: e.target.value })}
          placeholder={style.label}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:font-semibold placeholder:opacity-60"
          style={{ color: style.color }}
        />
      </div>
      <NodeViewContent className="px-3 pt-1 pb-2.5 text-[var(--lk-text)]" />
    </NodeViewWrapper>
  );
}
