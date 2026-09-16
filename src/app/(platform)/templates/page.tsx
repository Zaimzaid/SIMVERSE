import type { Metadata } from "next";
import { LayoutTemplate, Swords, Sprout, Trophy, Bot, Globe2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FeaturePreview } from "@/components/platform/feature-preview";

export const metadata: Metadata = { title: "Templates" };

const TEMPLATE_CONCEPTS = [
  { icon: Swords, name: "Battle arena", description: "Two sides, a ruleset, and a winner. The classic head-to-head setup." },
  { icon: Sprout, name: "Growth economy", description: "Resources, production, and expansion over many turns." },
  { icon: Trophy, name: "Tournament season", description: "A field of entities competing across a full bracket." },
  { icon: Bot, name: "Agent sandbox", description: "Autonomous entities reacting to each other and the world." },
  { icon: Globe2, name: "Open world", description: "A large environment with emergent, unscripted behavior." },
  { icon: Users, name: "Team scenario", description: "Cooperating groups pursuing competing objectives." },
];

export default function TemplatesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={LayoutTemplate}
        title="Templates"
        description="Start faster with prebuilt worlds, entities, and rulesets. Pick a template and make it your own."
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Template concepts
          </h2>
          <Badge variant="accent">Coming in a future phase</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATE_CONCEPTS.map((template) => (
            <Card key={template.name} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <span className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background/50 text-accent">
                  <template.icon className="size-5" />
                </span>
                <Badge variant="neutral">Soon</Badge>
              </div>
              <h3 className="mt-3.5 text-base font-semibold text-foreground">
                {template.name}
              </h3>
              <p className="mt-1 flex-1 text-sm text-secondary">{template.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <FeaturePreview
        heading="How templates will work"
        items={[
          { icon: LayoutTemplate, title: "One-click start", description: "Spin up a working setup from any template." },
          { icon: Swords, title: "Fully editable", description: "Change entities, worlds, and rules to fit your idea." },
          { icon: Users, title: "Community templates", description: "Publish your own and build on others’ work." },
        ]}
      />
    </div>
  );
}
