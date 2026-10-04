import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
export function AssetPagination({ page, pageCount, total, hrefForPage }: { page: number; pageCount: number; total: number; hrefForPage(page: number): string }) {
  if (pageCount <= 1) return null;
  return <nav aria-label="Asset Library pages" className="flex items-center justify-between gap-4"><p className="text-sm text-muted">Page {page} of {pageCount} · {total} assets</p><div className="flex gap-2">
    {page > 1 ? <Link href={hrefForPage(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}><ChevronLeft className="size-4" />Previous</Link> : null}
    {page < pageCount ? <Link href={hrefForPage(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>Next<ChevronRight className="size-4" /></Link> : null}
  </div></nav>;
}
