import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="aurora" aria-hidden />
      <div className="grid-overlay" aria-hidden />
      <div className="relative z-10 flex flex-col items-center">
        <Logo size="md" />
        <span className="mt-10 inline-flex size-14 items-center justify-center rounded-2xl border border-border bg-surface text-accent">
          <Compass className="size-6" />
        </span>
        <p className="mt-6 font-display text-5xl font-semibold text-foreground">404</p>
        <h1 className="mt-2 text-lg font-semibold text-foreground">Page not found</h1>
        <p className="mt-1.5 max-w-md text-sm text-secondary">
          This corner of the universe doesn’t exist yet. Let’s get you back on course.
        </p>
        <Link href="/" className={buttonClasses({ className: "mt-6" })}>
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
      </div>
    </main>
  );
}
