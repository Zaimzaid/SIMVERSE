import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import type { CreateDestination } from "@/lib/create/catalog";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function CreationCard({
  destination,
  preview,
  available,
  featured = false,
}: {
  destination: CreateDestination;
  preview: React.ReactNode;
  available: boolean;
  featured?: boolean;
}) {
  const future = destination.status === "COMING_LATER";
  const content = (
    <Card
      as="article"
      interactive={available}
      aria-disabled={!available || undefined}
      className={cn(
        "relative h-full overflow-hidden p-4 sm:p-5",
        featured && "border-accent/25 bg-gradient-to-br from-surface via-surface to-accent-soft",
        !available && "opacity-85",
      )}
    >
      <div className={cn("grid h-full gap-5", featured && "lg:grid-cols-[0.9fr_1.1fr] lg:items-center")}>
        <div className={cn(featured ? "order-2 lg:order-1" : "order-2")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{destination.eyebrow}</span>
            {future ? <Badge variant="neutral">Coming later</Badge> : !available ? <Badge variant="outline">No access</Badge> : null}
          </div>
          <h2 className={cn("mt-2 font-display font-semibold text-foreground", featured ? "text-2xl sm:text-3xl" : "text-xl")}>{destination.title}</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">{destination.description}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {destination.examples.map((example) => <span key={example} className="rounded-full border border-border bg-background/55 px-2.5 py-1 text-[11px] text-muted">{example}</span>)}
          </div>
          {destination.note ? <p className="mt-3 text-xs leading-5 text-muted">{destination.note}</p> : null}
          <span className={cn("mt-5 inline-flex items-center gap-1.5 text-sm font-semibold", available ? "text-accent" : "text-muted")}>
            {available ? <>Open creator <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></> : future ? "Preview only" : <><LockKeyhole className="size-3.5" />Ask a workspace admin</>}
          </span>
        </div>
        <div className={cn(featured ? "order-1 lg:order-2" : "order-1")}>{preview}</div>
      </div>
    </Card>
  );

  return available && destination.href
    ? <Link href={destination.href} className="group block h-full">{content}</Link>
    : content;
}
