import type { Metadata } from "next";
import { BarChart3, LineChart, PieChart, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { FeaturePreview } from "@/components/platform/feature-preview";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="Understand what happens across your simulations — trends, outcomes, and patterns over time."
      />

      <Card className="relative overflow-hidden p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Outcome trends</h2>
            <p className="mt-1 text-sm text-secondary">
              Charts populate once you start running simulations.
            </p>
          </div>
          <Badge variant="accent">Coming in a future phase</Badge>
        </div>
        <div
          className="mt-6 flex h-56 items-end gap-3 rounded-lg border border-dashed border-border bg-background/40 p-6"
          aria-hidden
        >
          {[38, 62, 45, 78, 54, 88, 67].map((height, index) => (
            <div
              key={index}
              className="flex-1 rounded-t-md bg-gradient-to-t from-accent/10 to-accent/25"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </Card>

      <FeaturePreview
        items={[
          { icon: TrendingUp, title: "Run metrics", description: "Track how outcomes shift as you tune your setups." },
          { icon: PieChart, title: "Distribution insights", description: "See how results break down across many runs." },
          { icon: LineChart, title: "Exportable reports", description: "Take your findings out as data and visuals." },
        ]}
      />
    </div>
  );
}
