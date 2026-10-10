import { Skeleton } from "@lockin/shared/Components/Shared/Skeleton";

/** Loosely echoes a document/project's own layout (the "Updated ..." pill,
 * a big title, a description line, then a few paragraph-width bars for the
 * editor body) — shown in place of the real header+editor while
 * UseDataStore is still hydrating from disk. */
export function DocumentSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[850px] flex-col gap-4 px-[50px] pt-8">
      <Skeleton className="h-[26px] w-40 rounded-[60px]" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-6 w-1/2" />
      <div className="flex flex-col gap-3 pt-8">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
