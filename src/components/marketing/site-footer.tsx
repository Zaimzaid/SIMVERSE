import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <Logo size="md" />
            <p className="mt-3 max-w-sm text-sm text-secondary">
              Build Your Civilization. Explore the fictional planet, connect with citizens,
              and help shape the future of SIMVERSE communities.
            </p>
          </div>
          <div className="text-sm text-muted">
            <p className="font-medium text-secondary">Platform preview</p>
            <p className="mt-1">The citizen-led civilization experience is in active development.</p>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} SIMVERSE. All rights reserved.</p>
          <p>Build Your Civilization.</p>
        </div>
      </div>
    </footer>
  );
}
