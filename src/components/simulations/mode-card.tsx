"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SimulationMode } from "@/lib/simulations/modes";
import { Badge } from "@/components/ui/badge";

export interface ModeCardProps {
  mode: SimulationMode;
  selected: boolean;
  onSelect: () => void;
}

/**
 * A selectable mode card in the builder's Mode step. Purely presentational —
 * it carries a mode's label, blurb and minimum participant count from the Mode
 * Catalog, and no mechanics. "Coming soon" modes render disabled.
 */
export function ModeCard({ mode, selected, onSelect }: ModeCardProps) {
  const Icon = mode.icon;
  const comingSoon = mode.availability !== "available";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={comingSoon}
      aria-pressed={selected}
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all",
        comingSoon
          ? "cursor-not-allowed border-border bg-surface opacity-60"
          : "bg-surface hover:border-accent/40 hover:bg-surface-hover",
        selected ? "border-accent ring-1 ring-accent" : "border-border-strong",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-lg border",
            selected
              ? "border-accent bg-accent/10 text-accent"
              : "border-border-strong bg-background/60 text-accent",
          )}
        >
          <Icon className="size-5" />
        </span>
        {selected ? (
          <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-foreground">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : comingSoon ? (
          <Badge variant="neutral">Soon</Badge>
        ) : null}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{mode.label}</h3>
        <p className="mt-0.5 text-xs text-secondary">{mode.description}</p>
      </div>
      <p className="mt-auto text-xs text-muted">
        Configuration {mode.availability === "available" ? "available" : "future"} · Execution {mode.executionAvailability === "available" ? "available" : "future"}
        <br />Needs at least {mode.minEntities} entities
      </p>
    </button>
  );
}
