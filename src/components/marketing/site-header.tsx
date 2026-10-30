import Link from "next/link";
import { Globe2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

/** Public site header. Auth-aware primary CTA. */
export function SiteHeader({ authed }: { authed: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo size="md" />

        <nav className="hidden items-center gap-8 text-sm font-medium text-secondary md:flex">
          <Link href="/#platform" className="transition-colors hover:text-foreground">
            Platform
          </Link>
          <Link href="/planet" className="text-accent transition-colors hover:text-accent-hover">
            Explore SIMVERSE
          </Link>
          <Link href="/#products" className="transition-colors hover:text-foreground">
            Products
          </Link>
          <Link href="/#how" className="transition-colors hover:text-foreground">
            How it works
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/planet"
            aria-label="Explore SIMVERSE"
            className={`${buttonClasses({ variant: "ghost", size: "sm" })} md:hidden`}
          >
            <Globe2 className="size-4" />
            <span className="hidden sm:inline">Explore SIMVERSE</span>
          </Link>
          {authed ? (
            <Link href="/dashboard" className={buttonClasses({ variant: "primary", size: "sm" })}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <span className="hidden sm:contents">
                <Link
                  href="/login"
                  className={buttonClasses({ variant: "ghost", size: "sm" })}
                >
                  Log in
                </Link>
              </span>
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
