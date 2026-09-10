import { Skeleton } from "@/Components/Shared/Skeleton";
import { HEADER_CELLS } from "./ProjectsTable";

const ROW_COUNT = 5;

/** Placeholder rows shaped like ProjectsTable.tsx's real ones — shown while
 * UseDataStore hasn't hydrated from disk yet, instead of flashing an empty
 * "no projects yet" state right before real ones pop in. */
export function ProjectsTableSkeleton() {
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
          <span className="flex w-[220px] items-center gap-2">
            <Skeleton className="size-4 shrink-0 rounded-md" />
            <Skeleton className="h-4 flex-1" style={{ maxWidth: 130 }} />
          </span>
          <span className="w-[260px]">
            <Skeleton className="h-4 w-4/5" />
          </span>
          <span className="w-[140px]">
            <Skeleton className="h-5 w-20 rounded-full" />
          </span>
          <span className="w-[120px]">
            <Skeleton className="h-5 w-16 rounded-full" />
          </span>
          <span className="w-[160px]">
            <Skeleton className="h-2 w-full rounded-full" />
          </span>
          <span className="w-[150px]">
            <Skeleton className="h-4 w-20" />
          </span>
          <span className="w-[130px]">
            <Skeleton className="h-5 w-16 rounded-xl" />
          </span>
          <span className="flex-1">
            <Skeleton className="h-4 w-16" />
          </span>
        </div>
      ))}
    </div>
  );
}
