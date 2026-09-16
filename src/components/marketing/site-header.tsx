import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

/** Public site header. Auth-aware primary CTA. */
export function SiteHeader({ authed }: { authed: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo size="md" />

        <nav className="hidden items-center gap-8 text-sm font-medium text-secondary md:flex">
          <a href="#platform" className="transition-colors hover:text-foreground">
            Platform
          </a>
          <a href="#products" className="transition-colors hover:text-foreground">
            Products
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {authed ? (
            <Link href="/dashboard" className={buttonClasses({ variant: "primary", size: "sm" })}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                Log in
              </Link>
              <Link
                href="/register"
                className={buttonClasses({ variant: "primary", size: "sm" })}
              >
                Enter SIMVERSE
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
