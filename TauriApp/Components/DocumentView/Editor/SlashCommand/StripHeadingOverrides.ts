import type { Schema } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

/**
 * Headings carry their own size/weight via CSS — an inline `fontSize` (set
 * via the selection toolbar's size stepper) or an explicit `bold` mark
 * surviving a "turn into heading" conversion would silently fight that,
 * making the heading render at whatever size/weight the original text
 * happened to have instead of the heading's own natural look. Clears both
 * across `[from, to)`, but only `fontSize` specifically off the `textStyle`
 * mark — any `color`/`fontFamily` also riding on it is left alone, since
 * removing the whole mark would wipe those too.
 *
 * Mutates `tr` in place without dispatching — meant to run inside a chain's
 * `.command(({ tr, state }) => {...})` step, right after `.setNode(...)`,
 * so the node-type change and the mark cleanup land as one transaction.
 */
export function StripHeadingOverrides(
  tr: Transaction,
  schema: Schema,
  from: number,
  to: number,
) {
  const boldType = schema.marks.bold;
  if (boldType) tr.removeMark(from, to, boldType);

  const textStyleType = schema.marks.textStyle;
  if (!textStyleType) return;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    const mark = textStyleType.isInSet(node.marks);
    if (!mark?.attrs.fontSize) return;
    const nodeFrom = Math.max(pos, from);
    const nodeTo = Math.min(pos + node.nodeSize, to);
    tr.removeMark(nodeFrom, nodeTo, textStyleType);
    const rest = { ...mark.attrs, fontSize: null };
    if (Object.values(rest).some(Boolean)) {
      tr.addMark(nodeFrom, nodeTo, textStyleType.create(rest));
    }
  });
}
