import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** A grid of upcoming capabilities, used on future-phase pages. */
export function FeaturePreview({
  heading = "What’s coming",
  items,
}: {
  heading?: string;
  items: FeatureItem[];
}) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
        {heading}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title} className="p-5">
            <span className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background/50 text-accent">
              <item.icon className="size-5" />
            </span>
            <h3 className="mt-3.5 text-sm font-semibold text-foreground">
              {item.title}
            </h3>
            <p className="mt-1 text-sm text-secondary">{item.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
