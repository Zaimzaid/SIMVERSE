import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
export function ExperiencePagination({ page, pageCount, total, hrefForPage }: { page: number; pageCount: number; total: number; hrefForPage(page: number): string }) {
  if (pageCount <= 1) return <p className="text-sm text-muted">{total} Experience Profile{total === 1 ? "" : "s"}</p>;
  return <div className="flex items-center justify-between"><p className="text-sm text-muted">Page {page} of {pageCount} · {total} Profiles</p><div className="flex gap-2">{page > 1 ? <Link href={hrefForPage(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}><ChevronLeft className="size-4" />Previous</Link> : null}{page < pageCount ? <Link href={hrefForPage(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>Next<ChevronRight className="size-4" /></Link> : null}</div></div>;
}
