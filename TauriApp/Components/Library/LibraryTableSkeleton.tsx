import { Skeleton } from "@/Components/Shared/Skeleton";
import { HEADER_CELLS } from "./LibraryTable";

const ROW_COUNT = 6;

/** Placeholder rows shaped like LibraryTable.tsx's real ones — shown while
 * UseDataStore hasn't hydrated from disk yet, instead of flashing an empty
 * "nothing here" state that a moment later gets replaced by real rows. */
export function LibraryTableSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 border-b border-[#f0efed] px-2.5 py-2 text-xs font-medium text-[#91918e]">
        {HEADER_CELLS.map((cell) => (
          <span key={cell.label} className={cell.width}>
            {cell.label}
          </span>
        ))}
      </div>
      {Array.from({ length: ROW_COUNT }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-[#f0efed]/60 px-2.5 py-2.5"
        >
          <span className="flex w-[260px] items-center gap-2">
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" style={{ maxWidth: 160 }} />
          </span>
          <span className="w-[300px]">
            <Skeleton className="h-4 w-4/5" />
          </span>
          <span className="w-[150px]">
            <Skeleton className="h-5 w-16 rounded-lg" />
          </span>
          <span className="w-[130px]">
            <Skeleton className="h-5 w-20 rounded-xl" />
          </span>
          <span className="w-[100px]">
            <Skeleton className="h-4 w-12" />
          </span>
          <span className="w-[110px]">
            <Skeleton className="h-4 w-16" />
          </span>
          <span className="flex-1">
            <Skeleton className="h-4 w-16" />
          </span>
        </div>
      ))}
    </div>
  );
}
