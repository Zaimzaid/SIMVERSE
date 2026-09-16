import type { Metadata } from "next";
import { Boxes, FolderKanban, Globe2, Sparkles, Swords, Wand2 } from "lucide-react";
import { PRODUCTS } from "@/lib/products";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Create" };

const CREATE_OPTIONS = [
  {
    icon: Swords,
    title: "New simulation",
    description: "Set up a scenario, add entities, and run it to an outcome.",
  },
  {
    icon: Boxes,
    title: "New entity",
    description: "Define a thing that lives in your worlds — traits and behaviors.",
  },
  {
    icon: Globe2,
    title: "New world",
    description: "Compose an environment and the rules that govern it.",
  },
  {
    icon: FolderKanban,
    title: "New project",
    description: "Organize related worlds, entities, and simulations together.",
  },
];

export default function CreatePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Creation hub"
        title="Create something new"
        description="Everything you build starts here. Creation tools arrive in a future phase — here’s what you’ll be able to make."
        icon={Sparkles}
      />

      <section>
        <div className="grid gap-4 sm:grid-cols-2">
          {CREATE_OPTIONS.map((option) => (
            <Card key={option.title} className="flex items-start gap-4 p-5">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background/50 text-accent">
                <option.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">
                    {option.title}
                  </h3>
                  <Badge variant="neutral">Soon</Badge>
                </div>
                <p className="mt-1 text-sm text-secondary">{option.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Wand2 className="size-4 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">Launch from a product</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((product) => (
            <Card key={product.name} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <span
                  className={`inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${product.gradient} text-foreground`}
                >
                  <product.icon className="size-5" />
                </span>
                <Badge variant={product.status === "In development" ? "accent" : "neutral"}>
                  {product.status}
                </Badge>
              </div>
              <h3 className="mt-3.5 text-base font-semibold text-foreground">
                {product.name}
              </h3>
              <p className="mt-1 flex-1 text-sm text-secondary">{product.tagline}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
