import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectPaginationProps {
  page: number;
  pageCount: number;
  total: number;
  /** Builds the href for a given page, preserving current filters. */
  hrefForPage: (page: number) => string;
}

/** Simple, accessible prev/next pagination for the Project Library. */
export function ProjectPagination({ page, pageCount, total, hrefForPage }: ProjectPaginationProps) {
  if (pageCount <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < pageCount;
  const linkBase =
    "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors";

  return (
    <nav
      className="flex items-center justify-between gap-4 pt-2"
      aria-label="Project library pages"
    >
      <p className="text-sm text-muted">
        Page {page} of {pageCount} · {total} total
      </p>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={hrefForPage(page - 1)}
            className={cn(linkBase, "border-border-strong text-secondary hover:text-foreground hover:border-accent/40")}
            rel="prev"
          >
            <ChevronLeft className="size-4" />
            Previous
          </Link>
        ) : (
          <span className={cn(linkBase, "cursor-not-allowed border-border text-muted opacity-50")}>
            <ChevronLeft className="size-4" />
            Previous
          </span>
        )}
        {hasNext ? (
          <Link
            href={hrefForPage(page + 1)}
            className={cn(linkBase, "border-border-strong text-secondary hover:text-foreground hover:border-accent/40")}
            rel="next"
          >
            Next
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(linkBase, "cursor-not-allowed border-border text-muted opacity-50")}>
            Next
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
