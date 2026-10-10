export type LibraryFilter =
  | { kind: "recents" }
  | { kind: "favorites" }
  | { kind: "folder-all" }
  | { kind: "folder"; id: string }
  | { kind: "tag-all" }
  | { kind: "tag"; id: string }
  | { kind: "project-all" }
  /** Projekty podle statusu nebo priority (jedno z nich). */
  | { kind: "project"; status?: string; priority?: string };

/** Whether two filters represent the "same pill" for toggle-off purposes —
 * a specific folder/tag/status selection still counts as its group being
 * active, so re-clicking the group's own label button clears it too. */
export function IsSameFilterGroup(a: LibraryFilter, b: LibraryFilter): boolean {
  if (a.kind === b.kind) return true;
  const Group = (f: LibraryFilter) => f.kind.split("-")[0];
  return Group(a) === Group(b);
}
